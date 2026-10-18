import { levelChoices } from "./level-choices.js";

export const MAX_LEVEL = 10;
// OSD06 (Occult Philosophy), legendary path: the GM may carry the campaign on up to level 20.
export const MAX_LEGENDARY_LEVEL = 20;

// OSD01: a novice path at level 1, an expert path at level 3, a master path at level 7; OSD06: a legendary path at 11.
const PATH_TYPE_BY_LEVEL = { 1: "novice", 3: "expert", 7: "master", 11: "legendary" };

export function requiredPathType(level) {
  return PATH_TYPE_BY_LEVEL[level] ?? null;
}

function ownedNestedIds(items) {
  return new Set(items.map((item) => item.flags?.demonlord?.nestedItemId).filter(Boolean));
}

// The path and ancestry levels reached at `target`, one step each.
function stepsAt(items, target, owned) {
  const steps = [];
  for (const item of items.filter((candidate) => ["path", "ancestry"].includes(candidate.type))) {
    (item.system.levels ?? []).forEach((level, levelIndex) => {
      if (Number(level.level) === target) {
        steps.push({ itemId: item._id ?? item.id, itemName: item.name, itemType: item.type, itemImg: item.img, levelIndex, choices: levelChoices(level, owned) });
      }
    });
  }
  return steps;
}

// One level at a time, as in the book. `items` are the character's items, plus the path chosen for this level if any.
// While a path is missing for the new tier, nothing else can be planned.
export function buildLevelUpPlan({ level, items, maxLevel = MAX_LEVEL }) {
  const target = Number(level) + 1;
  if (target > maxLevel) {
    return null;
  }
  const pathType = requiredPathType(target);
  const hasPath = items.some((item) => item.type === "path" && item.system.type === pathType);
  if (pathType && !hasPath) {
    return { from: Number(level), to: target, missingPath: pathType, steps: [] };
  }
  return { from: Number(level), to: target, missingPath: null, steps: stepsAt(items, target, ownedNestedIds(items)) };
}

// Power raised by this level, all paths together: spells learned now may already use it.
export function grantedPower(plan) {
  return plan.steps.reduce((total, step) => {
    const power = step.choices.granted.characteristics.find((characteristic) => characteristic.key === "power");
    return total + (power?.value ?? 0);
  }, 0);
}
