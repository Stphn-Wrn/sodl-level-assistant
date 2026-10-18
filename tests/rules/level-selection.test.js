import { test } from "node:test";
import assert from "node:assert/strict";
import { levelChoices } from "../../src/rules/level-choices.js";
import { applySelection, itemsToAdd, selectionErrors, stepMagic } from "../../src/rules/level-selection.js";
import { nested, pathLevel } from "../helpers/levels.js";

test("il faut cocher exactement le nombre d'attributs demandé", () => {
  const choices = levelChoices(pathLevel({ attributeSelect: "choosetwo" }), new Set());

  assert.deepEqual(selectionErrors(choices, { attributes: ["strength"] }), ["attributes"]);
  assert.deepEqual(selectionErrors(choices, { attributes: ["strength", "will", "agility"] }), ["attributes"]);
  assert.deepEqual(selectionErrors(choices, { attributes: ["strength", "will"] }), []);
});

test("un attribut que le niveau n'augmente pas ne peut pas être choisi", () => {
  const level = pathLevel({
    attributeSelect: "choosetwo",
    attributes: { strength: { value: 1 }, agility: { value: 1 }, intellect: { value: 0 }, will: { value: 1 } }
  });
  const choices = levelChoices(level, new Set());

  const errors = selectionErrors(choices, { attributes: ["strength", "intellect"] });

  assert.deepEqual(errors, ["attributes"]);
});

test("chaque paire d'un choix « deux ensembles » doit avoir un attribut choisi", () => {
  const level = pathLevel({ attributeSelect: "twosets", attributeSelectTwoSet1: "strength", attributeSelectTwoSet2: "agility", attributeSelectTwoSet3: "intellect", attributeSelectTwoSet4: "will" });
  const choices = levelChoices(level, new Set());

  assert.deepEqual(selectionErrors(choices, { sets: [0] }), ["attributes"]);
  assert.deepEqual(selectionErrors(choices, { sets: [1, 0] }), []);
});

test("il faut choisir un talent et un sort quand le niveau en propose plusieurs, pas un déjà acquis", () => {
  const level = pathLevel({ talentspick: [nested("bs", "Backstab"), nested("sk", "Skirmish")], spells: [nested("a", "Arcane Bolt"), nested("b", "Light")] });
  const choices = levelChoices(level, new Set(["bs"]));

  assert.deepEqual(selectionErrors(choices, {}), ["talent", "spell"]);
  assert.deepEqual(selectionErrors(choices, { talent: "bs", spell: "a" }), ["talent"]);
  assert.deepEqual(selectionErrors(choices, { talent: "sk", spell: "a" }), []);
});

test("les attributs choisis sont cochés dans le niveau, les autres décochés", () => {
  const level = pathLevel({ attributeSelect: "choosetwo" });
  const choices = levelChoices(level, new Set());

  const applied = applySelection(level, choices, { attributes: ["strength", "will"] });

  assert.deepEqual(
    Object.fromEntries(Object.entries(applied.attributes).map(([key, attribute]) => [key, attribute.selected])),
    { strength: true, agility: false, intellect: false, will: true }
  );
});

test("pour deux ensembles, le second attribut d'une paire se note comme le système l'attend", () => {
  const level = pathLevel({ attributeSelect: "twosets", attributeSelectTwoSet1: "strength", attributeSelectTwoSet2: "agility", attributeSelectTwoSet3: "intellect", attributeSelectTwoSet4: "will" });
  const choices = levelChoices(level, new Set());

  const applied = applySelection(level, choices, { sets: [1, 0] });

  assert.equal(applied.attributeSelectTwoSetSelectedValue1, true);
  assert.equal(applied.attributeSelectTwoSetSelectedValue2, false);
});

test("le talent et le sort choisis sont cochés, les acquis d'office aussi", () => {
  const level = pathLevel({ talentspick: [nested("bs", "Backstab"), nested("sk", "Skirmish")], spells: [nested("sm", "Sense Magic")] });
  const choices = levelChoices(level, new Set());

  const applied = applySelection(level, choices, { talent: "sk" });

  assert.deepEqual(applied.talentspick.map((entry) => [entry.id, entry.selected]), [["bs", false], ["sk", true]]);
  assert.deepEqual(applied.spells.map((entry) => [entry.id, entry.selected]), [["sm", true]]);
});

test("appliquer un choix ne modifie pas le niveau d'origine", () => {
  const level = pathLevel({ attributeSelect: "choosetwo" });
  const choices = levelChoices(level, new Set());

  applySelection(level, choices, { attributes: ["strength", "will"] });

  assert.equal(level.attributes.strength.selected, false);
});

test("les éléments à ajouter à la fiche : talents et langues d'office, plus ce qui est coché, comme le système", () => {
  const level = pathLevel({
    talents: [nested("cp", "Combat Prowess")],
    languages: [nested("dw", "Dwarfish")],
    talentspick: [{ ...nested("bs", "Backstab"), selected: true }, nested("sk", "Skirmish")],
    spells: [{ ...nested("sm", "Sense Magic"), selected: true }]
  });

  const entries = itemsToAdd(level);

  assert.deepEqual(entries.map((entry) => entry.id), ["cp", "dw", "sm", "bs"]);
});

test("un niveau avec de la magie n'est complet que si chaque choix de magie est valable", () => {
  const choices = levelChoices(pathLevel({ magicText: "You learn one spell." }), new Set());
  const magicContext = {
    catalog: [
      { uuid: "s.fire0", name: "Flame", tradition: "Fire", rank: 0, dark: false },
      { uuid: "s.fire1", name: "Burning Hands", tradition: "Fire", rank: 1, dark: false }
    ],
    known: new Set(["Fire"]),
    power: 1,
    knownSpells: ["Flame"]
  };

  assert.deepEqual(selectionErrors(choices, {}, magicContext), ["magic"]);
  assert.deepEqual(selectionErrors(choices, { magic: [{ mode: "learn", spell: "s.fire1" }] }, magicContext), []);
});

test("choisir Magie légendaire ajoute son choix de magie au niveau", () => {
  const level = pathLevel({
    level: "12",
    talentspick: [
      { ...nested("mag", "Legendary Magic"), description: "<p>You discover a tradition or you learn one spell from a tradition you have discovered.</p>" },
      { ...nested("chr", "Legendary Charm"), description: "<p>You make attack rolls in social situations with 3 boons.</p>" }
    ]
  });
  const choices = levelChoices(level, new Set());
  const magicContext = {
    catalog: [{ uuid: "s.fire1", name: "Burning Hands", tradition: "Fire", rank: 1, dark: false }],
    known: new Set(["Fire"]),
    power: 3,
    knownSpells: []
  };

  assert.deepEqual(stepMagic(choices, { talent: "chr" }), null);
  assert.deepEqual(stepMagic(choices, { talent: "mag" }), { discover: 0, choose: 1, learn: 0, traditions: null, religious: false });
  assert.deepEqual(selectionErrors(choices, { talent: "mag" }, magicContext), ["magic"]);
  assert.deepEqual(selectionErrors(choices, { talent: "mag", magic: [{ mode: "learn", spell: "s.fire1" }] }, magicContext), []);
});

test("la magie du niveau et celle du talent choisi s'additionnent", () => {
  const level = pathLevel({
    magicText: "You learn one spell.",
    talentspick: [
      { ...nested("mag", "Magic 2"), description: "<p>You discover a tradition or learn one spell from a tradition you have already discovered.</p>" },
      nested("oth", "Other")
    ]
  });
  const choices = levelChoices(level, new Set());

  const magic = stepMagic(choices, { talent: "mag" });

  assert.deepEqual(magic, { discover: 0, choose: 1, learn: 1, traditions: null, religious: false });
});
