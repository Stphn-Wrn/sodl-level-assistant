import { MODULE_ID } from "./constants.js";
import { openLevelUp } from "./app/level-up-app.js";
import { watchPossessionButton } from "./foundry/possession.js";
import { maxLevel, registerSettings } from "./foundry/settings.js";

function canLevelUp(actor) {
  return actor?.type === "character" && actor.isOwner && (Number(actor.system.level) || 0) < maxLevel();
}

Hooks.once("init", () => {
  registerSettings();
  // For macros and other modules (the sodl-custom HUD, for instance).
  game.modules.get(MODULE_ID).api = { open: openLevelUp };
});

// A "Level up" entry in the character sheet's header menu, for the GM and the character's owner.
Hooks.on("getHeaderControlsActorSheetV2", (sheet, controls) => {
  if (!canLevelUp(sheet.document)) {
    return;
  }
  controls.unshift({
    icon: "fa-solid fa-arrow-up-right-dots",
    label: "SODLLEVELUP.Button",
    action: "sodlLevelUp",
    onClick: () => openLevelUp(sheet.document)
  });
});

// The GM's button to apply a Demonology possession, in the private message sent after a level up.
Hooks.on("renderChatMessageHTML", (message, html) => watchPossessionButton(message, html));
