// OSD01, chapter 7. Discovering a tradition grants one of its rank 0 spells; a spell learned comes from a tradition
// already discovered, with a rank up to the character's Power. Spells are { uuid, name, tradition, rank, dark }.

// Marked with * in the books' lists of traditions: OSD01 (Forbidden, Curse, Necromancy), the Companion (Death,
// Demonology) and Occult Philosophy (Madness). No spell in the compendiums carries the dark magic flag.
export const DARK_TRADITIONS = ["Curse", "Death", "Demonology", "Forbidden", "Madness", "Necromancy"];

// A path's own spell (Magician, Templar…) is filed under a "tradition" of one spell: those are not traditions.
export function traditionsOf(catalog, minimumSpells = 2) {
  const counts = new Map();
  for (const spell of catalog) {
    counts.set(spell.tradition, (counts.get(spell.tradition) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([tradition, total]) => tradition && total >= minimumSpells)
    .map(([tradition]) => tradition)
    .sort();
}

// OSD01 and Occult Philosophy list the traditions by attribute, Intellect or Will (not by path: a priest's
// traditions come from their religion and mix both).
// A tradition's attribute is the one most of its spells use.
const ATTRIBUTE_ORDER = ["intellect", "will", "other"];

function traditionAttribute(catalog, tradition) {
  const counts = { intellect: 0, will: 0 };
  for (const spell of catalog.filter((candidate) => candidate.tradition === tradition)) {
    const attribute = String(spell.attribute ?? "").toLowerCase();
    if (attribute in counts) {
      counts[attribute] += 1;
    }
  }
  if (!counts.intellect && !counts.will) {
    return "other";
  }
  if (counts.intellect >= counts.will) {
    return "intellect";
  }
  return "will";
}

export function groupTraditions(catalog, traditions) {
  return ATTRIBUTE_ORDER
    .map((attribute) => ({ attribute, traditions: traditions.filter((tradition) => traditionAttribute(catalog, tradition) === attribute) }))
    .filter((group) => group.traditions.length);
}

export function knownTraditions(spells) {
  return new Set(spells.map((spell) => spell.tradition).filter(Boolean));
}

export function isDark(spell) {
  return Boolean(spell.dark) || DARK_TRADITIONS.includes(spell.tradition);
}

// The magic of a level, slot by slot: imposed discoveries first, then free choices, then spells to learn.
export function magicSlots(magic) {
  const kinds = [
    ...Array(magic.discover).fill("discover"),
    ...Array(magic.choose).fill("choose"),
    ...Array(magic.learn).fill("learn")
  ];
  return kinds.map((kind) => ({ kind, restriction: magic.traditions }));
}

function allowed(restriction, tradition) {
  return !restriction || restriction.includes(tradition);
}

// What one slot offers. `known` holds the traditions discovered so far, `taken` the spells picked in other slots,
// `knownSpells` the names of the spells already on the sheet.
export function slotOptions({ mode, tradition, restriction, catalog, known, power, taken, knownSpells = [], minimumSpells = 2 }) {
  if (mode === "discover") {
    const traditions = traditionsOf(catalog, minimumSpells).filter((candidate) => !known.has(candidate) && allowed(restriction, candidate));
    const spells = catalog.filter((spell) => spell.tradition === tradition && spell.rank === 0 && !taken.includes(spell.uuid));
    return { traditions, spells };
  }
  const spells = catalog.filter((spell) =>
    known.has(spell.tradition)
    && allowed(restriction, spell.tradition)
    && spell.rank <= power
    && !taken.includes(spell.uuid)
    && !knownSpells.includes(spell.name));
  return { traditions: [], spells };
}

function slotMode(slot, choice) {
  if (slot.kind === "choose") {
    return choice?.mode;
  }
  return slot.kind;
}

function isValid(mode, choice, options) {
  if (mode === "discover") {
    return options.traditions.includes(choice.tradition) && options.spells.some((spell) => spell.uuid === choice.spell);
  }
  if (mode === "learn") {
    return options.spells.some((spell) => spell.uuid === choice.spell);
  }
  return false;
}

// Goes through the slots in order, as the player fills them: a tradition discovered in one slot can be learned
// from in the next, and a spell picked once is not offered again. Yields { slot, choice, mode, options, valid }.
export function walkSlots({ slots, chosen, catalog, known, power, knownSpells, minimumSpells }) {
  const running = new Set(known);
  const taken = [];
  return slots.map((slot, index) => {
    const choice = chosen[index] ?? {};
    const mode = slotMode(slot, choice);
    const options = slotOptions({ mode, tradition: choice.tradition, restriction: slot.restriction, catalog, known: running, power, taken, knownSpells, minimumSpells });
    const valid = isValid(mode, choice, options);
    if (valid && mode === "discover") {
      running.add(choice.tradition);
    }
    if (valid) {
      taken.push(choice.spell);
    }
    return { slot, choice, mode, options, valid };
  });
}

// The slots still missing or wrong, by index.
export function magicErrors(context) {
  return walkSlots(context)
    .map((walked, index) => ({ valid: walked.valid, index }))
    .filter((walked) => !walked.valid)
    .map((walked) => walked.index);
}

// OSD01, dark magic: 1 Corruption per dark tradition discovered; for each dark spell learned, roll a d6 and gain
// 1 Corruption if it is lower than the total of dark spells learned so far (`learnedDark` holds that total for each).
export function darkMagicCorruption({ discoveredDark, learnedDark, rolls }) {
  const fromSpells = learnedDark.filter((total, index) => rolls[index] < total).length;
  return discoveredDark + fromSpells;
}

// Demon Lord's Companion, Demonology: each time a Demonology spell is learned, the GM secretly rolls a d6;
// lower than the character's total Corruption, a demon takes possession of them.
export function risksPossession(spell) {
  return spell.tradition === "Demonology";
}

export function isPossessedBy(roll, corruption) {
  return roll < corruption;
}
