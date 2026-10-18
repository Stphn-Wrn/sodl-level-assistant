import { parseMagicText, parseTalentMagic } from "./magic-text.js";

export const ATTRIBUTES = ["strength", "agility", "intellect", "will"];
export const CHARACTERISTICS = ["health", "healingRate", "defense", "perception", "speed", "power"];

function pickAttributes(level, count) {
  const options = ATTRIBUTES
    .filter((key) => Number(level.attributes?.[key]?.value) > 0)
    .map((key) => ({ key, value: Number(level.attributes[key].value) }));
  return { kind: "pick", count, options };
}

function attributeSets(level) {
  return {
    kind: "sets",
    sets: [
      { value: Number(level.attributeSelectTwoSetValue1) || 0, options: [level.attributeSelectTwoSet1, level.attributeSelectTwoSet2] },
      { value: Number(level.attributeSelectTwoSetValue2) || 0, options: [level.attributeSelectTwoSet3, level.attributeSelectTwoSet4] }
    ]
  };
}

// One strategy per kind of attribute selection the system knows; "fixed" and "" ask nothing.
const ATTRIBUTE_SELECTIONS = {
  choosetwo: (level) => pickAttributes(level, 2),
  choosethree: (level) => pickAttributes(level, 3),
  twosets: (level) => attributeSets(level)
};

// "You can choose this talent multiple times" (legendary talents): taking it again is allowed.
function isRepeatable(entry) {
  return /multiple times|plusieurs (?:fois|reprises)/i.test(String(entry.description ?? ""));
}

// A talent that grants magic (Legendary Magic, the rogue's Magic…) carries its magic choice along.
function entryOf(entry, owned) {
  const id = entry.id ?? entry._id;
  const result = { id, uuid: entry.uuid, name: entry.name, owned: owned.has(id) && !isRepeatable(entry) };
  const magic = parseTalentMagic(entry.description);
  if (magic) {
    result.magic = magic;
  }
  return result;
}

// A list of talents or spells to pick from. A single entry is not a choice: the book simply grants it
// (Determined at level 4 for humans), but the system only adds it once ticked.
function itemChoice(entries, owned) {
  if (!entries?.length) {
    return null;
  }
  const items = entries.map((entry) => entryOf(entry, owned));
  if (items.length === 1) {
    return { kind: "automatic", items };
  }
  return { kind: "pick", count: 1, options: items };
}

function fixedAttributes(level) {
  if (level.attributeSelect !== "fixed") {
    return [];
  }
  return ATTRIBUTES
    .filter((key) => Number(level.attributes?.[key]?.value) > 0)
    .map((key) => ({ key, value: Number(level.attributes[key].value) }));
}

function grantedCharacteristics(level) {
  return CHARACTERISTICS
    .filter((key) => Number(level.characteristics?.[key]) > 0)
    .map((key) => ({ key, value: Number(level.characteristics[key]) }));
}

// Supplements write references as {@profession astrology|sdlc-1000}; Foundry links as @UUID[…]{Grimoire}.
// Only the readable name is kept.
export function readableText(text) {
  return String(text ?? "")
    .replace(/\{@\w+ ([^}|]+)(?:\|[^}]*)?\}/g, "$1")
    .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/@UUID\[[^\]]*\]/g, "")
    .trim();
}

// Choices the books only describe in words: the assistant reminds them, the player handles them.
const REMINDER_FIELDS = [
  { kind: "languages", field: "languagesText" },
  { kind: "magic", field: "magicText" },
  { kind: "options", field: "optionsText" }
];

// What a path or ancestry level asks for and what it grants. `owned` holds the ids of the nested items
// already on the character, so a talent picked at an earlier level is not offered as new.
// A magic sentence the assistant understands becomes slots to fill instead of a reminder.
export function levelChoices(level, owned) {
  const magic = parseMagicText(level.magicText);
  return {
    attributes: ATTRIBUTE_SELECTIONS[level.attributeSelect]?.(level) ?? null,
    talents: itemChoice(level.talentspick, owned),
    spells: itemChoice(level.spells, owned),
    magic,
    granted: {
      talents: (level.talents ?? []).map((entry) => entryOf(entry, owned)),
      languages: (level.languages ?? []).map((entry) => entryOf(entry, owned)),
      characteristics: grantedCharacteristics(level),
      attributes: fixedAttributes(level)
    },
    reminders: REMINDER_FIELDS
      .filter(({ field }) => String(level[field] ?? "").trim())
      .filter(({ kind }) => kind !== "magic" || !magic)
      .map(({ kind, field }) => ({ kind, text: readableText(level[field]) }))
  };
}
