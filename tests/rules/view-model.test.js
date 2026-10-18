import { test } from "node:test";
import assert from "node:assert/strict";
import { buildViewModel } from "../../src/app/view-model.js";
import { buildLevelUpPlan } from "../../src/rules/level-plan.js";
import { nested, pathLevel } from "../helpers/levels.js";
import { t } from "../helpers/i18n.js";

test("le bouton reste inactif tant qu'un choix du niveau manque", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "1" }), pathLevel({ level: "2", attributeSelect: "choosetwo" })] } }];
  const plan = buildLevelUpPlan({ level: 1, items });

  const before = buildViewModel({ actorName: "Brann", plan, selections: {}, names: {}, paths: [], chosenPath: null, t });
  const after = buildViewModel({ actorName: "Brann", plan, selections: { "war:1": { attributes: ["strength", "will"] } }, names: {}, paths: [], chosenPath: null, t });

  assert.equal(before.ready, false);
  assert.equal(after.ready, true);
});

test("sans voie choisie pour le nouveau palier, le passage n'est pas prêt", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "2" })] } }];
  const plan = buildLevelUpPlan({ level: 2, items });

  const view = buildViewModel({ actorName: "Brann", plan, neededPath: plan.missingPath, selections: {}, names: {}, paths: [], chosenPath: null, t });

  assert.equal(view.pathChoice, true);
  assert.equal(view.ready, false);
});

test("les noms traduits des compendiums remplacent les noms anglais gardés dans la voie", () => {
  const items = [{ _id: "rog", type: "path", name: "Roublard", system: { type: "novice", levels: [pathLevel({ level: "2", talentspick: [nested("bs", "Backstab"), nested("sk", "Skirmish")] })] } }];
  const plan = buildLevelUpPlan({ level: 1, items });

  const view = buildViewModel({ actorName: "Lys", plan, selections: {}, names: { bs: { name: "Attaque sournoise", description: "" } }, paths: [], chosenPath: null, t });

  assert.deepEqual(view.steps[0].talents.options.map((option) => option.name), ["Attaque sournoise", "Skirmish"]);
});

test("les gains d'office s'affichent en clair : caractéristiques puis talents", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "2", characteristics: { health: 5 }, talents: [nested("cp", "Combat Prowess")] })] } }];
  const plan = buildLevelUpPlan({ level: 1, items });

  const view = buildViewModel({ actorName: "Brann", plan, selections: {}, names: { cp: { name: "Prouesse martiale" } }, paths: [], chosenPath: null, t });

  assert.deepEqual(view.steps[0].granted.stats, ["Santé +5"]);
  assert.deepEqual(view.steps[0].granted.items.map((item) => item.name), ["Prouesse martiale"]);
});

test("un talent seul « à choisir » s'affiche parmi les gains, pas comme un choix", () => {
  const items = [{ _id: "hum", type: "ancestry", name: "Humain", system: { levels: [pathLevel({ level: "4", talentspick: [nested("det", "Determined")] })] } }];
  const plan = buildLevelUpPlan({ level: 3, items: [...items, { _id: "fig", type: "path", name: "Combattant", system: { type: "expert", levels: [] } }] });

  const view = buildViewModel({ actorName: "Brann", plan, selections: {}, names: { det: { name: "Déterminé" } }, paths: [], chosenPath: null, t });

  assert.deepEqual(view.steps[0].granted.items.map((item) => item.name), ["Déterminé"]);
  assert.equal(view.steps[0].talents, null);
  assert.equal(view.ready, true);
});

test("tant qu'il manque quelque chose, le bouton dit quoi", () => {
  const items = [{ _id: "acr", type: "path", name: "Acrobate", system: { type: "master", levels: [pathLevel({ level: "7", attributeSelect: "choosethree", talentspick: [nested("a", "A"), nested("b", "B")] })] } }];
  const plan = buildLevelUpPlan({ level: 6, items });

  const view = buildViewModel({ actorName: "Lys", plan, selections: { "acr:0": { attributes: ["will"] } }, names: {}, paths: [], chosenPath: null, t });

  assert.deepEqual(view.missing, ["Choisissez encore 2 attributs", "Choisissez un talent"]);
});

test("sans voie choisie, le bouton demande d'abord la voie", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [] } }];
  const plan = buildLevelUpPlan({ level: 2, items });

  const view = buildViewModel({ actorName: "Brann", plan, neededPath: "expert", selections: {}, names: {}, paths: [], chosenPath: null, t });

  assert.deepEqual(view.missing, ["Choisissez votre voie d'expert"]);
});

test("chaque attribut montre sa valeur actuelle et sa valeur après le niveau", () => {
  const items = [{ _id: "acr", type: "path", name: "Acrobate", system: { type: "master", levels: [pathLevel({ level: "7", attributeSelect: "choosethree" })] } }];
  const plan = buildLevelUpPlan({ level: 6, items });

  const view = buildViewModel({ actorName: "Lys", plan, selections: {}, names: {}, paths: [], chosenPath: null, attributeValues: { strength: 11, agility: 13, intellect: 10, will: 9 }, t });

  assert.deepEqual(view.steps[0].attributes.options.map((option) => [option.key, option.current, option.next]), [
    ["strength", 11, 12],
    ["agility", 13, 14],
    ["intellect", 10, 11],
    ["will", 9, 10]
  ]);
});

test("un choix de magie propose de découvrir une tradition ou d'apprendre un sort, avec les sorts permis", () => {
  const items = [{ _id: "pyr", type: "path", name: "Pyromancien", system: { type: "master", levels: [pathLevel({ level: "7", magicText: "You discover the Fire tradition or learn one Fire spell." })] } }];
  const plan = buildLevelUpPlan({ level: 6, items });
  const magicContext = {
    catalog: [
      { uuid: "s.f0", name: "Flamme", img: "f.webp", description: "", tradition: "Fire", rank: 0, dark: false },
      { uuid: "s.f1", name: "Mains brûlantes", img: "f.webp", description: "", tradition: "Fire", rank: 1, dark: false },
      { uuid: "s.f3", name: "Boule de feu", img: "f.webp", description: "", tradition: "Fire", rank: 3, dark: false }
    ],
    known: new Set(["Fire"]),
    power: 2,
    knownSpells: []
  };

  const empty = buildViewModel({ actorName: "Lys", plan, selections: {}, names: {}, paths: [], chosenPath: null, magicContext, t });
  const learning = buildViewModel({ actorName: "Lys", plan, selections: { "pyr:0": { magic: [{ mode: "learn" }] } }, names: {}, paths: [], chosenPath: null, magicContext, t });

  assert.deepEqual(empty.missing, ["Complétez vos choix de magie"]);
  assert.equal(empty.steps[0].magic.slots[0].canChoose, true);
  assert.deepEqual(learning.steps[0].magic.slots[0].spells.map((spell) => spell.name), ["Flamme", "Mains brûlantes"]);
});

test("on peut viser plusieurs niveaux d'un coup, jusqu'au maximum permis", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [] } }];
  const plan = buildLevelUpPlan({ level: 4, items });

  const view = buildViewModel({ actorName: "Brann", plan, selections: {}, names: {}, paths: [], chosenPath: null, target: 7, maxLevel: 10, t });

  assert.deepEqual(view.targets.map((option) => [option.value, option.selected]), [[5, false], [6, false], [7, true], [8, false], [9, false], [10, false]]);
  assert.equal(view.remaining, 2);
});

test("pour apprendre un sort, les sorts sont rangés par tradition, et le panneau du sort choisi est ouvert", () => {
  const items = [{ _id: "wiz", type: "path", name: "Magicien", system: { type: "expert", levels: [pathLevel({ level: "3", magicText: "You learn one spell." })] } }];
  const plan = buildLevelUpPlan({ level: 2, items });
  const magicContext = {
    catalog: [
      { uuid: "s.a0", name: "Arcane Bolt", img: "", description: "", tradition: "Arcana", rank: 0, attribute: "intellect" },
      { uuid: "s.a1", name: "Magic Shield", img: "", description: "", tradition: "Arcana", rank: 1, attribute: "intellect" },
      { uuid: "s.f0", name: "Flame", img: "", description: "", tradition: "Fire", rank: 0, attribute: "will" }
    ],
    known: new Set(["Arcana", "Fire"]),
    power: 1,
    knownSpells: []
  };

  const view = buildViewModel({ actorName: "Lys", plan, selections: { "wiz:0": { magic: [{ spell: "s.f0" }] } }, names: {}, paths: [], chosenPath: null, magicContext, openGroups: new Set(), t });
  const groups = view.steps[0].magic.slots[0].spellGroups;

  assert.deepEqual(groups.map((group) => [group.label, group.count, group.open]), [["Arcanique", 2, false], ["Feu", 1, true]]);
});

test("les traditions de magie noire portent un astérisque, comme dans le livre", () => {
  const items = [{ _id: "wiz", type: "path", name: "Magicien", system: { type: "expert", levels: [pathLevel({ level: "3", magicText: "You discover a tradition or learn one spell." })] } }];
  const plan = buildLevelUpPlan({ level: 2, items });
  const magicContext = {
    catalog: [
      { uuid: "n0", name: "Grave Touch", img: "", description: "", tradition: "Necromancy", rank: 0, attribute: "intellect" },
      { uuid: "n1", name: "Raise", img: "", description: "", tradition: "Necromancy", rank: 1, attribute: "intellect" },
      { uuid: "a0", name: "Arcane Bolt", img: "", description: "", tradition: "Arcana", rank: 0, attribute: "intellect" },
      { uuid: "a1", name: "Shield", img: "", description: "", tradition: "Arcana", rank: 1, attribute: "intellect" }
    ],
    known: new Set(["Necromancy"]),
    power: 1,
    knownSpells: []
  };

  const discovering = buildViewModel({ actorName: "Lys", plan, selections: { "wiz:0": { magic: [{ mode: "discover" }] } }, names: {}, paths: [], chosenPath: null, magicContext, openGroups: new Set(), t });
  const learning = buildViewModel({ actorName: "Lys", plan, selections: { "wiz:0": { magic: [{ mode: "learn" }] } }, names: {}, paths: [], chosenPath: null, magicContext, openGroups: new Set(), t });

  assert.deepEqual(discovering.steps[0].magic.slots[0].traditionGroups[0].options.map((option) => option.label), ["Arcanique"]);
  assert.deepEqual(learning.steps[0].magic.slots[0].spellGroups.map((group) => group.label), ["Nécromancie*"]);
  assert.equal(learning.steps[0].magic.darkLegend, true);
});
