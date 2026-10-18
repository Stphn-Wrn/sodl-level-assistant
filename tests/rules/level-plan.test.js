import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLevelUpPlan, grantedPower, requiredPathType } from "../../src/rules/level-plan.js";
import { pathLevel } from "../helpers/levels.js";

test("on prend une voie de novice au niveau 1, d'expert au niveau 3 et de maître au niveau 7", () => {
  assert.equal(requiredPathType(1), "novice");
  assert.equal(requiredPathType(2), null);
  assert.equal(requiredPathType(3), "expert");
  assert.equal(requiredPathType(5), null);
  assert.equal(requiredPathType(7), "master");
  assert.equal(requiredPathType(10), null);
});

test("passer au niveau 2 reprend le niveau 2 de la voie de novice", () => {
  const items = [
    { _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "1" }), pathLevel({ level: "2" })] } },
    { _id: "hum", type: "ancestry", name: "Humain", system: { levels: [pathLevel({ level: "0" }), pathLevel({ level: "4" })] } }
  ];

  const plan = buildLevelUpPlan({ level: 1, items });

  assert.equal(plan.to, 2);
  assert.equal(plan.missingPath, null);
  assert.deepEqual(plan.steps.map((step) => [step.itemId, step.itemName, step.levelIndex]), [["war", "Guerrier", 1]]);
});

test("passer au niveau 3 sans voie d'expert demande d'en choisir une", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "1" }), pathLevel({ level: "2" })] } }];

  const plan = buildLevelUpPlan({ level: 2, items });

  assert.equal(plan.missingPath, "expert");
  assert.deepEqual(plan.steps, []);
});

test("avec la voie d'expert choisie, son niveau 3 fait partie du passage", () => {
  const items = [
    { _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "1" }), pathLevel({ level: "2" })] } },
    { _id: "fig", type: "path", name: "Combattant", system: { type: "expert", levels: [pathLevel({ level: "3" }), pathLevel({ level: "6" })] } }
  ];

  const plan = buildLevelUpPlan({ level: 2, items });

  assert.equal(plan.missingPath, null);
  assert.deepEqual(plan.steps.map((step) => step.itemId), ["fig"]);
});

test("au niveau 4, l'ascendance apporte son propre niveau, à côté de la voie", () => {
  const items = [
    { _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "1" })] } },
    { _id: "fig", type: "path", name: "Combattant", system: { type: "expert", levels: [pathLevel({ level: "3" })] } },
    { _id: "hum", type: "ancestry", name: "Humain", system: { levels: [pathLevel({ level: "0" }), pathLevel({ level: "4" })] } }
  ];

  const plan = buildLevelUpPlan({ level: 3, items });

  assert.deepEqual(plan.steps.map((step) => [step.itemName, step.levelIndex]), [["Humain", 1]]);
});

test("un talent déjà sur la fiche, venu d'un niveau précédent, est signalé dans les choix", () => {
  const items = [
    { _id: "rog", type: "path", name: "Roublard", system: { type: "novice", levels: [pathLevel({ level: "8", talentspick: [{ id: "bs", name: "Backstab" }, { id: "sk", name: "Skirmish" }] })] } },
    { _id: "t1", type: "talent", name: "Backstab", flags: { demonlord: { nestedItemId: "bs" } }, system: {} }
  ];

  const plan = buildLevelUpPlan({ level: 7, items });

  assert.deepEqual(plan.steps[0].choices.talents.options.map((option) => [option.id, option.owned]), [["bs", true], ["sk", false]]);
});

test("au niveau 10, on ne peut plus monter", () => {
  const plan = buildLevelUpPlan({ level: 10, items: [] });

  assert.equal(plan, null);
});

test("la Puissance gagnée à ce niveau compte pour le rang des sorts qu'on peut apprendre", () => {
  const items = [
    { _id: "wiz", type: "path", name: "Magicien", system: { type: "expert", levels: [pathLevel({ level: "3", characteristics: { power: 1 } })] } },
    { _id: "mag", type: "path", name: "Mage", system: { type: "novice", levels: [pathLevel({ level: "3", characteristics: { power: 1 } })] } }
  ];
  const plan = buildLevelUpPlan({ level: 2, items });

  assert.equal(grantedPower(plan), 2);
});

test("au-delà du niveau 10, la voie légendaire se prend au niveau 11", () => {
  assert.equal(requiredPathType(11), "legendary");
  assert.equal(requiredPathType(12), null);
});

test("sans niveaux légendaires, on s'arrête au niveau 10 ; avec, on monte jusqu'au 20", () => {
  const items = [{ _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [] } }];

  assert.equal(buildLevelUpPlan({ level: 10, items }), null);
  assert.equal(buildLevelUpPlan({ level: 10, items, maxLevel: 20 }).missingPath, "legendary");
  assert.equal(buildLevelUpPlan({ level: 20, items, maxLevel: 20 }), null);
});
