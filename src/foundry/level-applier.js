import { NEW_PATH_ID, stepKey } from "../constants.js";
import { buildLevelUpPlan } from "../rules/level-plan.js";
import { applySelection, itemsToAdd, stepSlots } from "../rules/level-selection.js";
import { darkMagicCorruption, isDark, isPossessedBy, risksPossession } from "../rules/magic-choices.js";

// The system's own way of finding a nested item (getNestedDocument): its uuid, its pack, then the world.
async function nestedDocument(entry) {
  const id = entry.id ?? entry._id;
  if (entry.uuid) {
    const document = await fromUuid(entry.uuid);
    if (document) {
      return document;
    }
  }
  if (entry.pack && id) {
    const document = await game.packs.get(entry.pack)?.getDocument(id);
    if (document) {
      return document;
    }
  }
  return game.items.get(id) ?? game.items.find((item) => item.name === entry.name) ?? null;
}

async function nestedItemData(entry) {
  const document = await nestedDocument(entry);
  if (document) {
    return document.toObject();
  }
  // Last resort, as the system does: the copy kept inside the path.
  if (entry.data?.type) {
    return foundry.utils.deepClone(entry.data);
  }
  return null;
}

// Adds the level's items with the flags the system puts on them, so that lowering the level removes them again.
async function addNestedItems(actor, entries, parentItemId, levelRequired) {
  // Already added for this very level (a second click, for instance). A talent taken again at another level,
  // such as a cumulative legendary talent, is a new copy.
  const present = new Set(actor.items
    .filter((item) => item.flags?.demonlord?.parentItemId === parentItemId && Number(item.flags.demonlord.levelRequired) === levelRequired)
    .map((item) => item.flags.demonlord.nestedItemId));
  const toCreate = [];
  for (const entry of entries) {
    const nestedItemId = entry.id ?? entry._id;
    if (present.has(nestedItemId)) {
      continue;
    }
    const data = await nestedItemData(entry);
    if (!data) {
      ui.notifications.warn(game.i18n.format("SODLLEVELUP.Errors.MissingItem", { name: entry.name }));
      continue;
    }
    delete data._id;
    data.flags = { ...data.flags, demonlord: { ...data.flags?.demonlord, nestedItemId, parentItemId, levelRequired } };
    toCreate.push(data);
  }
  if (!toCreate.length) {
    return [];
  }
  return actor.createEmbeddedDocuments("Item", toCreate);
}

// The spells chosen in the magic slots, in order, with the traditions they discover.
function chosenMagic(plan, selections, catalog) {
  const byUuid = new Map(catalog.map((spell) => [spell.uuid, spell]));
  const picks = [];
  for (const step of plan.steps) {
    const selection = selections[stepKey(step)] ?? {};
    const chosen = selection.magic ?? [];
    stepSlots(step.choices, selection).forEach((slot, index) => {
      let mode = slot.kind;
      if (slot.kind === "choose") {
        mode = chosen[index]?.mode;
      }
      const spell = byUuid.get(chosen[index]?.spell);
      if (spell) {
        picks.push({ mode, spell });
      }
    });
  }
  return picks;
}

// Learns the chosen spells (removed again if the level is lowered, like the path's own items),
// and applies the dark magic Corruption: 1 per dark tradition discovered, a d6 per dark spell learned.
async function learnMagic(actor, plan, selections, catalog) {
  const picks = chosenMagic(plan, selections, catalog);
  if (!picks.length) {
    return { spells: [], traditions: [], corruption: null, possession: null };
  }
  const data = [];
  for (const { spell } of picks) {
    const document = await fromUuid(spell.uuid);
    if (!document) {
      ui.notifications.warn(game.i18n.format("SODLLEVELUP.Errors.MissingItem", { name: spell.name }));
      continue;
    }
    const itemData = document.toObject();
    delete itemData._id;
    itemData.flags = { ...itemData.flags, demonlord: { ...itemData.flags?.demonlord, levelRequired: plan.to } };
    data.push(itemData);
  }
  const darkKnown = actor.items.filter((item) => item.type === "spell" && isDark({ tradition: item.system.tradition, dark: item.system.isDarkMagic })).length;
  const spells = await actor.createEmbeddedDocuments("Item", data);

  const traditions = picks.filter((pick) => pick.mode === "discover").map((pick) => pick.spell.tradition);
  const darkLearned = picks.filter((pick) => pick.mode === "learn" && isDark(pick.spell));
  const learnedDark = darkLearned.map((pick, index) => darkKnown + index + 1);
  const rolls = [];
  while (rolls.length < learnedDark.length) {
    const roll = await new Roll("1d6").evaluate();
    rolls.push(roll.total);
  }
  const discoveredDark = picks.filter((pick) => pick.mode === "discover" && isDark(pick.spell)).length;
  const value = darkMagicCorruption({ discoveredDark, learnedDark, rolls });
  const total = (Number(actor.system.characteristics?.corruption?.value) || 0) + value;
  if (value) {
    await actor.update({ "system.characteristics.corruption.value": total });
  }
  let corruption = null;
  if (discoveredDark || rolls.length) {
    corruption = { value, rolls };
  }
  return { spells, traditions, corruption, possession: await checkPossession(actor, picks, total) };
}

// A roll only the GM sees: "messageMode" since Foundry v14, "rollMode" before.
function blindRoll() {
  if (CONFIG.ChatMessage.modes) {
    return { messageMode: "blind" };
  }
  return { rollMode: "blindroll" };
}

// The GM rolls in secret: a blind roll the player cannot see, compared with the Corruption after this level's.
// Null when no Demonology spell was gained.
async function checkPossession(actor, picks, corruption) {
  const risky = picks.filter((pick) => risksPossession(pick.spell));
  if (!risky.length) {
    return null;
  }
  const rolls = [];
  for (const pick of risky) {
    const roll = await new Roll("1d6").evaluate();
    await roll.toMessage(
      { speaker: ChatMessage.getSpeaker({ actor }), flavor: game.i18n.format("SODLLEVELUP.Possession.RollFlavor", { spell: pick.spell.name }) },
      blindRoll()
    );
    rolls.push(roll.total);
  }
  return { rolls, corruption, possessed: rolls.some((roll) => isPossessedBy(roll, corruption)) };
}

// Does what the system's sheet does when the level field changes (handleLevelChange), with the player's choices
// ticked first. Returns the plan, the new path and the items added, for the chat card.
// `catalog` is the spell catalog the magic choices were made from.
export async function applyLevelUp(actor, { pathData, selections, catalog = [], maxLevel }) {
  const items = actor.items.map((item) => item.toObject());
  if (pathData) {
    items.push({ ...pathData, _id: NEW_PATH_ID });
  }
  const plan = buildLevelUpPlan({ level: Number(actor.system.level) || 0, items, maxLevel });

  // Tick every level's choices. The new path gets them before it is added, so the system builds its effects
  // from the right data in one go instead of rebuilding them while it is still creating them.
  const ticked = plan.steps.map((step) => {
    const source = items.find((item) => item._id === step.itemId);
    const levels = foundry.utils.deepClone(source.system.levels);
    levels[step.levelIndex] = applySelection(levels[step.levelIndex], step.choices, selections[stepKey(step)] ?? {});
    return { step, levels };
  });

  let newPath = null;
  if (pathData) {
    const newPathLevels = ticked.find(({ step }) => step.itemId === NEW_PATH_ID)?.levels ?? pathData.system.levels;
    [newPath] = await actor.createEmbeddedDocuments("Item", [foundry.utils.mergeObject(pathData, { "system.levels": newPathLevels }, { inplace: false })]);
  }

  const added = [];
  for (const { step, levels } of ticked) {
    let item = actor.items.get(step.itemId);
    if (step.itemId === NEW_PATH_ID) {
      item = newPath;
    } else {
      await item.update({ "system.levels": levels });
    }
    added.push(...await addNestedItems(actor, itemsToAdd(levels[step.levelIndex]), item.id, plan.to));
  }

  const magic = await learnMagic(actor, plan, selections, catalog);
  added.push(...magic.spells);

  await actor.update({ "system.level": plan.to });
  return { plan, newPath, added, traditions: magic.traditions, corruption: magic.corruption, possession: magic.possession };
}
