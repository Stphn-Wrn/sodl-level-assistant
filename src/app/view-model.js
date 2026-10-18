import { stepKey } from "../constants.js";
import { selectionErrors, stepMagic, stepSlots } from "../rules/level-selection.js";
import { groupTraditions, isDark, walkSlots } from "../rules/magic-choices.js";

const DEFAULT_ICON = "icons/svg/book.svg";

// `names` maps a nested entry id to what the compendium says about it: translated name, description and icon.
function display(entry, names) {
  const known = names[entry.id];
  return {
    id: entry.id,
    name: known?.name ?? entry.name,
    description: known?.description ?? "",
    img: known?.img ?? DEFAULT_ICON,
    owned: entry.owned
  };
}

function attributeOption(key, value, attributeValues, t) {
  const current = Number(attributeValues?.[key]) || 0;
  return { key, value, label: t(`SODLLEVELUP.Attributes.${key}`), current, next: current + value };
}

function attributeView(choice, selection, attributeValues, t) {
  if (!choice) {
    return null;
  }
  if (choice.kind === "sets") {
    return {
      sets: choice.sets.map((set, index) => ({
        index,
        legend: t("SODLLEVELUP.ChooseSet", { value: set.value }),
        options: set.options.map((key, position) => ({
          ...attributeOption(key, set.value, attributeValues, t),
          position,
          checked: selection.sets?.[index] === position
        }))
      }))
    };
  }
  const picked = selection.attributes ?? [];
  return {
    legend: t("SODLLEVELUP.ChooseAttributes", { count: choice.count, chosen: picked.length }),
    full: picked.length >= choice.count,
    options: choice.options.map((option) => ({
      ...attributeOption(option.key, option.value, attributeValues, t),
      checked: picked.includes(option.key)
    }))
  };
}

// A talent or spell list to pick from; a single entry is shown among the gains instead.
function itemView(choice, chosenId, names) {
  if (choice?.kind !== "pick") {
    return null;
  }
  return { options: choice.options.map((entry) => ({ ...display(entry, names), checked: entry.id === chosenId })) };
}

function automaticItems(choice) {
  if (choice?.kind !== "automatic") {
    return [];
  }
  return choice.items;
}

// Everything the level gives without asking: characteristics, fixed attributes, talents, languages,
// and the talent or spell that is the only one "to pick".
function grantedView(choices, names, t) {
  const { granted } = choices;
  const entries = [...granted.talents, ...automaticItems(choices.talents), ...automaticItems(choices.spells), ...granted.languages];
  return {
    stats: [
      ...granted.characteristics.map(({ key, value }) => `${t(`SODLLEVELUP.Characteristics.${key}`)} +${value}`),
      ...granted.attributes.map(({ key, value }) => `${t(`SODLLEVELUP.Attributes.${key}`)} +${value}`)
    ],
    items: entries.map((entry) => display(entry, names))
  };
}

// Tradition names are stored in English; translated when the language file knows them.
function traditionLabel(tradition, t) {
  const key = `SODLLEVELUP.Traditions.${tradition}`;
  const label = t(key);
  if (label === key) {
    return tradition;
  }
  return label;
}

// Dark magic traditions get the book's asterisk.
function traditionTitle(tradition, catalog, t) {
  const dark = catalog.some((spell) => spell.tradition === tradition && isDark(spell)) || isDark({ tradition });
  if (dark) {
    return `${traditionLabel(tradition, t)}*`;
  }
  return traditionLabel(tradition, t);
}

function spellCard(spell, choice, t) {
  return {
    uuid: spell.uuid,
    name: spell.name,
    img: spell.img,
    description: spell.description,
    rank: spell.rank,
    tradition: traditionLabel(spell.tradition, t),
    dark: isDark(spell),
    checked: spell.uuid === choice.spell
  };
}

// Spells to learn, one folding panel per tradition: the one holding the chosen spell is open,
// and so are those the player opened (`openGroups`, kept by the window across redraws).
function spellGroups(spells, choice, groupKey, openGroups, catalog, t) {
  const groups = [];
  for (const spell of spells) {
    let group = groups.find((candidate) => candidate.tradition === spell.tradition);
    if (!group) {
      group = { tradition: spell.tradition, key: `${groupKey}|${spell.tradition}`, label: traditionTitle(spell.tradition, catalog, t), spells: [] };
      groups.push(group);
    }
    group.spells.push(spellCard(spell, choice, t));
  }
  return groups.map((group) => ({
    ...group,
    count: group.spells.length,
    open: group.spells.some((spell) => spell.checked) || Boolean(openGroups?.has(group.key))
  }));
}

// One block per magic slot: the mode (when the player may choose), the tradition to discover, the spells on offer.
// The level's own magic comes first, then the magic of the talent chosen (Legendary Magic…).
function magicView(choices, selection, context, stepKeyValue, openGroups, t) {
  const magic = stepMagic(choices, selection);
  if (!magic || !context) {
    return null;
  }
  const walked = walkSlots({ ...context, slots: stepSlots(choices, selection), chosen: selection.magic ?? [] });
  const shown = walked.flatMap(({ options }) => [...options.traditions.map((tradition) => ({ tradition })), ...options.spells]);
  return {
    darkLegend: shown.some((entry) => isDark(entry) || context.catalog.some((spell) => spell.tradition === entry.tradition && isDark(spell))),
    restriction: (magic.traditions ?? []).map((tradition) => traditionLabel(tradition, t)).join(", "),
    religious: magic.religious,
    power: context.power,
    slots: walked.map(({ slot, choice, mode, options, valid }, index) => ({
      index,
      label: t(`SODLLEVELUP.Magic.Slot.${slot.kind}`, { number: index + 1 }),
      canChoose: slot.kind === "choose",
      discovering: mode === "discover",
      learning: mode === "learn",
      modes: ["discover", "learn"].map((value) => ({ value, label: t(`SODLLEVELUP.Magic.Modes.${value}`), checked: value === mode })),
      traditionGroups: groupTraditions(context.catalog, options.traditions).map((group) => ({
        label: t(`SODLLEVELUP.Magic.Groups.${group.attribute}`),
        options: group.traditions.map((tradition) => ({ value: tradition, label: traditionTitle(tradition, context.catalog, t), selected: tradition === choice.tradition }))
      })),
      needsTradition: mode === "discover" && !choice.tradition,
      spells: options.spells.map((spell) => spellCard(spell, choice, t)),
      spellGroups: spellGroups(options.spells, choice, `${stepKeyValue}|${index}`, openGroups, context.catalog, t),
      complete: valid
    }))
  };
}

// What still stops the level up, in the player's words, one hint per missing choice.
function missingFor(step, selection, magicContext, t) {
  const errors = selectionErrors(step.choices, selection, magicContext);
  const hints = [];
  if (errors.includes("attributes") && step.choices.attributes.kind === "pick") {
    const remaining = step.choices.attributes.count - (selection.attributes ?? []).length;
    if (remaining === 1) {
      hints.push(t("SODLLEVELUP.Missing.Attribute"));
    }
    if (remaining > 1) {
      hints.push(t("SODLLEVELUP.Missing.Attributes", { count: remaining }));
    }
  }
  if (errors.includes("attributes") && step.choices.attributes.kind === "sets") {
    hints.push(t("SODLLEVELUP.Missing.Sets"));
  }
  if (errors.includes("talent")) {
    hints.push(t("SODLLEVELUP.Missing.Talent"));
  }
  if (errors.includes("spell")) {
    hints.push(t("SODLLEVELUP.Missing.Spell"));
  }
  if (errors.includes("magic")) {
    hints.push(t("SODLLEVELUP.Missing.Magic"));
  }
  return hints;
}

function stepView(step, selections, names, attributeValues, magicContext, openGroups, t) {
  const key = stepKey(step);
  const selection = selections[key] ?? {};
  const missing = missingFor(step, selection, magicContext, t);
  const granted = grantedView(step.choices, names, t);
  return {
    key,
    title: step.itemName,
    kind: t(`SODLLEVELUP.ItemTypes.${step.itemType}`),
    img: step.itemImg ?? DEFAULT_ICON,
    granted,
    hasGains: granted.stats.length > 0 || granted.items.length > 0,
    attributes: attributeView(step.choices.attributes, selection, attributeValues, t),
    talents: itemView(step.choices.talents, selection.talent, names),
    spells: itemView(step.choices.spells, selection.spell, names),
    magic: magicView(step.choices, selection, magicContext, key, openGroups, t),
    reminders: step.choices.reminders.map((reminder) => ({ ...reminder, label: t(`SODLLEVELUP.Reminders.${reminder.kind}`) })),
    missing
  };
}

// Everything the window shows. `plan` includes the path chosen in the window; `neededPath` is the tier the character
// itself lacks, so the list of paths stays on screen to change one's mind. The level-up button only works once
// that path is chosen and every step has its choices made; until then it says what is missing.
// `magicContext` is { catalog, known, power, knownSpells }: the spells on offer and what the character knows.
// `target` is the level the player wants to reach, one level after the other, up to `maxLevel`.
function targetOptions(to, target, maxLevel) {
  const options = [];
  for (let level = to; level <= maxLevel; level++) {
    options.push({ value: level, selected: level === target });
  }
  return options;
}

export function buildViewModel({ actorName, actorImg, plan, neededPath, selections, names, paths, chosenPath, attributeValues, magicContext, openGroups, target, maxLevel, t }) {
  if (!plan) {
    return { actorName, actorImg, maxed: true };
  }
  const steps = plan.steps.map((step) => stepView(step, selections, names, attributeValues, magicContext, openGroups, t));
  const pathLabel = t(`SODLLEVELUP.PathTypes.${neededPath ?? plan.missingPath ?? "novice"}`);
  const missing = [];
  if (plan.missingPath) {
    missing.push(t("SODLLEVELUP.Missing.Path", { type: pathLabel }));
  }
  missing.push(...steps.flatMap((step) => step.missing));
  return {
    actorName,
    actorImg,
    from: plan.from,
    to: plan.to,
    pathChoice: Boolean(neededPath),
    pathLabel,
    paths: (paths ?? []).map((path) => ({ ...path, selected: path.uuid === chosenPath?.uuid })),
    chosenPath,
    steps,
    nothingToChoose: !plan.missingPath && steps.length === 0,
    ready: missing.length === 0,
    missing,
    hint: missing[0] ?? "",
    targets: targetOptions(plan.to, target ?? plan.to, maxLevel ?? plan.to),
    remaining: Math.max(0, (target ?? plan.to) - plan.to),
    buttonLabel: t("SODLLEVELUP.LevelUp", { to: plan.to })
  };
}
