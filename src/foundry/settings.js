import { MODULE_ID } from "../constants.js";
import { MAX_LEGENDARY_LEVEL, MAX_LEVEL } from "../rules/level-plan.js";

const LEGENDARY_SETTING = "legendaryLevels";

// The legendary path (Occult Philosophy) takes characters past level 10, if the GM carries the campaign on.
export function registerSettings() {
  game.settings.register(MODULE_ID, LEGENDARY_SETTING, {
    name: "SODLLEVELUP.Settings.Legendary.Name",
    hint: "SODLLEVELUP.Settings.Legendary.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

export function maxLevel() {
  if (game.settings.get(MODULE_ID, LEGENDARY_SETTING)) {
    return MAX_LEGENDARY_LEVEL;
  }
  return MAX_LEVEL;
}
