import { test } from "node:test";
import assert from "node:assert/strict";
import { levelChoices } from "../../src/rules/level-choices.js";
import { nested, pathLevel } from "../helpers/levels.js";

test("« deux au choix » demande de choisir deux attributs parmi ceux que le niveau augmente", () => {
  const level = pathLevel({ attributeSelect: "choosetwo" });

  const { attributes } = levelChoices(level, new Set());

  assert.deepEqual(attributes, {
    kind: "pick",
    count: 2,
    options: [
      { key: "strength", value: 1 },
      { key: "agility", value: 1 },
      { key: "intellect", value: 1 },
      { key: "will", value: 1 }
    ]
  });
});

test("« trois au choix » demande trois attributs", () => {
  const level = pathLevel({ attributeSelect: "choosethree" });

  const { attributes } = levelChoices(level, new Set());

  assert.equal(attributes.count, 3);
});

test("« deux ensembles » propose un attribut à choisir dans chacune des deux paires", () => {
  const level = pathLevel({
    attributeSelect: "twosets",
    attributeSelectTwoSet1: "strength",
    attributeSelectTwoSet2: "agility",
    attributeSelectTwoSet3: "intellect",
    attributeSelectTwoSet4: "will",
    attributeSelectTwoSetValue1: 2,
    attributeSelectTwoSetValue2: 1
  });

  const { attributes } = levelChoices(level, new Set());

  assert.deepEqual(attributes, {
    kind: "sets",
    sets: [
      { value: 2, options: ["strength", "agility"] },
      { value: 1, options: ["intellect", "will"] }
    ]
  });
});

test("un niveau sans sélection d'attributs ne demande rien", () => {
  const level = pathLevel({ attributeSelect: "" });

  const { attributes } = levelChoices(level, new Set());

  assert.equal(attributes, null);
});

test("une liste de plusieurs talents demande d'en choisir un, et signale ceux déjà acquis", () => {
  const level = pathLevel({ talentspick: [nested("bs", "Backstab"), nested("sk", "Skirmish"), nested("th", "Threats")] });

  const { talents } = levelChoices(level, new Set(["sk"]));

  assert.deepEqual(talents, {
    kind: "pick",
    count: 1,
    options: [
      { id: "bs", uuid: "Compendium.sdlc-1000.talents.Item.bs", name: "Backstab", owned: false },
      { id: "sk", uuid: "Compendium.sdlc-1000.talents.Item.sk", name: "Skirmish", owned: true },
      { id: "th", uuid: "Compendium.sdlc-1000.talents.Item.th", name: "Threats", owned: false }
    ]
  });
});

test("un seul talent « à choisir » est en fait acquis d'office, comme Déterminé au niveau 4 de l'humain", () => {
  const level = pathLevel({ level: "4", talentspick: [nested("det", "Determined")] });

  const { talents } = levelChoices(level, new Set());

  assert.deepEqual(talents, {
    kind: "automatic",
    items: [{ id: "det", uuid: "Compendium.sdlc-1000.talents.Item.det", name: "Determined", owned: false }]
  });
});

test("un seul sort dans le niveau est acquis d'office, une liste de sorts demande d'en choisir un", () => {
  const single = pathLevel({ spells: [nested("sm", "Sense Magic")] });
  const several = pathLevel({ spells: [nested("a", "Arcane Bolt"), nested("b", "Light")] });

  assert.equal(levelChoices(single, new Set()).spells.kind, "automatic");
  assert.equal(levelChoices(several, new Set()).spells.kind, "pick");
});

test("sans talent ni sort à choisir, rien n'est demandé", () => {
  const level = pathLevel({});

  const { talents, spells } = levelChoices(level, new Set());

  assert.equal(talents, null);
  assert.equal(spells, null);
});

test("les gains d'office du niveau : talents, langues, caractéristiques et attributs fixes", () => {
  const level = pathLevel({
    attributeSelect: "fixed",
    attributes: {
      strength: { value: 0 },
      agility: { value: 0 },
      intellect: { value: 0 },
      will: { value: 1 }
    },
    characteristics: { health: 5, healingRate: 0, defense: 1, perception: 0, speed: 0, power: 0 },
    talents: [nested("cp", "Combat Prowess")],
    languages: [nested("dw", "Dwarfish")]
  });

  const { granted } = levelChoices(level, new Set());

  assert.deepEqual(granted, {
    talents: [{ id: "cp", uuid: "Compendium.sdlc-1000.talents.Item.cp", name: "Combat Prowess", owned: false }],
    languages: [{ id: "dw", uuid: "Compendium.sdlc-1000.talents.Item.dw", name: "Dwarfish", owned: false }],
    characteristics: [{ key: "health", value: 5 }, { key: "defense", value: 1 }],
    attributes: [{ key: "will", value: 1 }]
  });
});

test("les choix écrits seulement en texte deviennent des rappels", () => {
  const level = pathLevel({
    languagesText: "You add one common, martial, or wilderness profession.",
    magicText: "You gain the ability to cast rituals.",
    optionsText: ""
  });

  const { reminders, magic } = levelChoices(level, new Set());

  assert.equal(magic, null);
  assert.deepEqual(reminders, [
    { kind: "languages", text: "You add one common, martial, or wilderness profession." },
    { kind: "magic", text: "You gain the ability to cast rituals." }
  ]);
});

test("une phrase de magie comprise devient des choix de magie plutôt qu'un rappel", () => {
  const level = pathLevel({ magicText: "You discover a tradition or learn one spell." });

  const { reminders, magic } = levelChoices(level, new Set());

  assert.deepEqual(magic, { discover: 0, choose: 1, learn: 0, traditions: null, religious: false });
  assert.deepEqual(reminders, []);
});

test("les balises des suppléments et les liens deviennent du texte lisible dans les rappels", () => {
  const level = pathLevel({
    languagesText: "You add nature and one of the following: {@profession astrology|sdlc-1000}, {@profession folklore|sdlc-1000}, or {@profession religion}.",
    optionsText: "See @UUID[Compendium.sdlc-1000.talents.Item.GBsmtzkF84TbNtoo]{Grimoire} and @UUID[Compendium.sdlc-1000.talents.Item.x]."
  });

  const { reminders } = levelChoices(level, new Set());

  assert.deepEqual(reminders.map((reminder) => reminder.text), [
    "You add nature and one of the following: astrology, folklore, or religion.",
    "See Grimoire and ."
  ]);
});

test("un talent qu'on peut choisir plusieurs fois reste proposé même s'il est déjà acquis", () => {
  const level = pathLevel({
    level: "12",
    talentspick: [
      { ...nested("agi", "Legendary Agility"), description: "<p>Increase your Agility by 1 (maximum 20). You can choose this talent multiple times, and its effect is cumulative.</p>" },
      { ...nested("chr", "Legendary Charm"), description: "<p>You make attack rolls in social situations with 3 boons.</p>" }
    ]
  });

  const { talents } = levelChoices(level, new Set(["agi", "chr"]));

  assert.deepEqual(talents.options.map((option) => [option.id, option.owned]), [["agi", false], ["chr", true]]);
});
