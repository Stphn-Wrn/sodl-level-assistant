export const MODULE_ID = "sodl-level-up";
// The id the assistant gives the path picked for this level until it is created on the character.
export const NEW_PATH_ID = "sodl-level-up-new-path";

export function modulePath(relativePath) {
  return `modules/${MODULE_ID}/${relativePath}`;
}

// A step of the plan, as a key for the player's selections.
export function stepKey(step) {
  return `${step.itemId}:${step.levelIndex}`;
}
