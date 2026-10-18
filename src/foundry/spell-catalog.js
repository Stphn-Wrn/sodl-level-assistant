const INDEX_FIELDS = ["system.tradition", "system.rank", "system.isDarkMagic", "system.description", "system.action.attack", "system.attribute"];

function entryOf(document) {
  return {
    uuid: document.uuid,
    name: document.name,
    img: document.img,
    description: document.system?.description ?? "",
    tradition: document.system?.tradition ?? "",
    rank: Number(document.system?.rank) || 0,
    dark: Boolean(document.system?.isDarkMagic),
    // Intellect or Will: the attack attribute, or the challenge one for utility spells.
    attribute: String(document.system?.action?.attack || document.system?.attribute || "").toLowerCase()
  };
}

// Every spell of the world and the Item compendiums, the shape magic-choices.js works on.
// A spell found twice (a world copy of a compendium spell) is kept once, the world one first.
export async function loadSpellCatalog() {
  const spells = [];
  const seen = new Set();
  const add = (entry) => {
    const key = `${entry.tradition}|${entry.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      spells.push(entry);
    }
  };
  for (const item of game.items.filter((candidate) => candidate.type === "spell")) {
    add(entryOf(item));
  }
  for (const pack of game.packs.filter((candidate) => candidate.documentName === "Item")) {
    const index = await pack.getIndex({ fields: INDEX_FIELDS });
    for (const entry of index.filter((candidate) => candidate.type === "spell")) {
      add(entryOf(entry));
    }
  }
  return spells.sort((a, b) => a.tradition.localeCompare(b.tradition) || a.rank - b.rank || a.name.localeCompare(b.name, game.i18n.lang));
}

// What the character already knows: the traditions of its spells, and their names.
export function actorMagic(actor) {
  const spells = actor.items.filter((item) => item.type === "spell");
  return {
    spells: spells.map((spell) => ({ tradition: spell.system.tradition, dark: Boolean(spell.system.isDarkMagic), name: spell.name })),
    power: Number(actor.system.characteristics?.power) || 0
  };
}
