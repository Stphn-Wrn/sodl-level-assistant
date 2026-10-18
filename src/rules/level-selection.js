import { magicErrors, magicSlots } from "./magic-choices.js";

// `selection` is what the player chose for one level: { attributes: ["strength", "will"] } or { sets: [0, 1] },
// plus { talent: id } and { spell: id } when the level offers several, and { magic: [{ mode, tradition, spell }] },
// one entry per magic slot.

function pickedOption(choice, id) {
  return choice.options.find((option) => option.id === id && !option.owned);
}

// One check per kind of attribute choice.
const ATTRIBUTE_CHECKS = {
  pick: (choice, selection) => {
    const picked = selection.attributes ?? [];
    const allowed = choice.options.map((option) => option.key);
    return picked.length === choice.count && picked.every((key) => allowed.includes(key)) && new Set(picked).size === picked.length;
  },
  sets: (choice, selection) => {
    const picked = selection.sets ?? [];
    return choice.sets.every((set, index) => [0, 1].includes(picked[index]));
  }
};

// The talents whose magic applies: the one picked, or those granted outright.
function magicTalents(choices, selection) {
  const talents = choices.talents;
  if (talents?.kind === "pick") {
    return talents.options.filter((option) => option.id === selection.talent && option.magic);
  }
  if (talents?.kind === "automatic") {
    return talents.items.filter((item) => item.magic);
  }
  return [];
}

// The magic slots of a level: its own sentence first, then the magic of the talent chosen (Legendary Magic…).
// Each part keeps its own tradition restriction.
export function stepSlots(choices, selection) {
  const parts = [choices.magic, ...magicTalents(choices, selection).map((talent) => talent.magic)].filter(Boolean);
  return parts.flatMap((magic) => magicSlots(magic));
}

// The same, as one summary: how many discoveries, choices and spells in all.
export function stepMagic(choices, selection) {
  const parts = [choices.magic, ...magicTalents(choices, selection).map((talent) => talent.magic)].filter(Boolean);
  if (!parts.length) {
    return null;
  }
  return parts.reduce((total, magic) => ({
    discover: total.discover + magic.discover,
    choose: total.choose + magic.choose,
    learn: total.learn + magic.learn,
    traditions: total.traditions ?? magic.traditions,
    religious: total.religious || magic.religious
  }));
}

function magicComplete(slots, selection, context) {
  if (!context) {
    return false;
  }
  return magicErrors({ ...context, slots, chosen: selection.magic ?? [] }).length === 0;
}

// The parts of the selection still missing or wrong: "attributes", "talent", "spell", "magic".
// Magic needs the spells on offer: `magicContext` is { catalog, known, power, knownSpells } (see magic-choices.js).
export function selectionErrors(choices, selection, magicContext = null) {
  const errors = [];
  if (choices.attributes && !ATTRIBUTE_CHECKS[choices.attributes.kind](choices.attributes, selection)) {
    errors.push("attributes");
  }
  if (choices.talents?.kind === "pick" && !pickedOption(choices.talents, selection.talent)) {
    errors.push("talent");
  }
  if (choices.spells?.kind === "pick" && !pickedOption(choices.spells, selection.spell)) {
    errors.push("spell");
  }
  const slots = stepSlots(choices, selection);
  if (slots.length && !magicComplete(slots, selection, magicContext)) {
    errors.push("magic");
  }
  return errors;
}

// Writes the choice the way the system reads it, as the path sheet's checkboxes would.
const ATTRIBUTE_WRITERS = {
  pick: (level, selection) => {
    for (const [key, attribute] of Object.entries(level.attributes)) {
      attribute.selected = (selection.attributes ?? []).includes(key);
    }
  },
  // The system keeps "the second attribute of the pair" as true.
  sets: (level, selection) => {
    level.attributeSelectTwoSetSelectedValue1 = selection.sets?.[0] === 1;
    level.attributeSelectTwoSetSelectedValue2 = selection.sets?.[1] === 1;
  }
};

function markSelected(entries, choice, chosenId) {
  return (entries ?? []).map((entry) => {
    const id = entry.id ?? entry._id;
    if (choice?.kind === "automatic" || id === chosenId) {
      return { ...entry, selected: true };
    }
    return entry;
  });
}

// A copy of the level with the choices ticked; the level itself is left untouched.
export function applySelection(level, choices, selection) {
  const applied = structuredClone(level);
  if (choices.attributes) {
    ATTRIBUTE_WRITERS[choices.attributes.kind](applied, selection);
  }
  applied.talentspick = markSelected(level.talentspick, choices.talents, selection.talent);
  applied.spells = markSelected(level.spells, choices.spells, selection.spell);
  return applied;
}

// What the system adds to the character for a level: its talents and languages, and what is ticked
// among the talents and spells to pick (the system's own _getLevelItemsToTransfer).
export function itemsToAdd(level) {
  const ticked = [...(level.spells ?? []), ...(level.talentspick ?? [])].filter((entry) => entry.selected);
  return [...(level.talents ?? []), ...(level.languages ?? []), ...ticked];
}
