import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLevelUpPlan } from "../../src/rules/level-plan.js";
import { levelUpSummary } from "../../src/rules/level-summary.js";
import { pathLevel } from "../helpers/levels.js";

test("le résumé additionne les caractéristiques gagnées par chaque voie et l'ascendance", () => {
  const items = [
    { _id: "acr", type: "path", name: "Acrobate", system: { type: "master", levels: [pathLevel({ level: "7", characteristics: { health: 3, speed: 2 } })] } },
    { _id: "war", type: "path", name: "Guerrier", system: { type: "novice", levels: [pathLevel({ level: "7", characteristics: { health: 5 } })] } }
  ];
  const plan = buildLevelUpPlan({ level: 6, items });

  const summary = levelUpSummary(plan, {});

  assert.deepEqual(summary.characteristics, [{ key: "health", value: 8 }, { key: "speed", value: 2 }]);
});

test("le résumé donne les attributs choisis, ceux des deux ensembles et ceux fixés par le niveau", () => {
  const items = [
    { _id: "acr", type: "path", name: "Acrobate", system: { type: "master", levels: [pathLevel({ level: "7", attributeSelect: "choosethree" })] } },
    {
      _id: "hum", type: "ancestry", name: "Humain", system: {
        levels: [pathLevel({
          level: "7",
          attributeSelect: "twosets",
          attributeSelectTwoSet1: "strength",
          attributeSelectTwoSet2: "agility",
          attributeSelectTwoSet3: "intellect",
          attributeSelectTwoSet4: "will",
          attributeSelectTwoSetValue1: 2,
          attributeSelectTwoSetValue2: 1
        })]
      }
    }
  ];
  const plan = buildLevelUpPlan({ level: 6, items });

  const summary = levelUpSummary(plan, { "acr:0": { attributes: ["agility", "will", "strength"] }, "hum:0": { sets: [1, 0] } });

  assert.deepEqual(summary.attributes, [
    { key: "strength", value: 1 },
    { key: "agility", value: 3 },
    { key: "intellect", value: 1 },
    { key: "will", value: 1 }
  ]);
});

test("le résumé rappelle les choix à faire soi-même, avec la voie qui les demande", () => {
  const items = [{ _id: "acr", type: "path", name: "Acrobate", system: { type: "master", levels: [pathLevel({ level: "7", languagesText: "You can speak another language or add a profession." })] } }];
  const plan = buildLevelUpPlan({ level: 6, items });

  const summary = levelUpSummary(plan, {});

  assert.deepEqual(summary.reminders, [{ source: "Acrobate", kind: "languages", text: "You can speak another language or add a profession." }]);
});
