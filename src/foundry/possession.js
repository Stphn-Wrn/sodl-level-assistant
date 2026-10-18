import { MODULE_ID } from "../constants.js";

// Demon Lord's Companion, Demonology: possession. The GM learns the outcome privately and decides when to apply it.

function t(key, data) {
  if (data) {
    return game.i18n.format(key, data);
  }
  return game.i18n.localize(key);
}

function isPossessed(actor) {
  return actor.effects.some((effect) => effect.flags?.[MODULE_ID]?.possessed);
}

// The private message to the GM: the secret rolls, the Corruption they were compared with, and the outcome.
export async function whisperPossession(actor, possession) {
  const lines = [
    `<p class="sodl-level-up-card-text"><i class="fas fa-skull"></i> ${t("SODLLEVELUP.Possession.Title", { name: actor.name })}</p>`,
    "<ul>",
    `<li>${t("SODLLEVELUP.Possession.Rolls", { rolls: possession.rolls.join(", "), corruption: possession.corruption })}</li>`
  ];
  if (possession.possessed) {
    lines.push(`<li class="sodl-level-up-card-dark"><strong>${t("SODLLEVELUP.Possession.Possessed", { name: actor.name })}</strong></li>`, "</ul>");
    lines.push(`<button type="button" data-sodl-level-up-possess="${actor.uuid}"><i class="fas fa-skull"></i> ${t("SODLLEVELUP.Possession.Apply")}</button>`);
  } else {
    lines.push(`<li>${t("SODLLEVELUP.Possession.Safe", { name: actor.name })}</li>`, "</ul>");
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="sodl-level-up-card">${lines.join("")}</div>`,
    whisper: ChatMessage.getWhisperRecipients("GM").map((user) => user.id)
  });
}

// A "Possessed" effect on the sheet, with the rule as a reminder; the system has no such affliction.
export async function applyPossession(actor) {
  if (isPossessed(actor)) {
    ui.notifications.info(t("SODLLEVELUP.Possession.Already", { name: actor.name }));
    return;
  }
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: t("SODLLEVELUP.Possession.EffectName"),
    img: "icons/svg/terror.svg",
    description: t("SODLLEVELUP.Possession.EffectDescription"),
    flags: { [MODULE_ID]: { possessed: true } }
  }]);
  ui.notifications.info(t("SODLLEVELUP.Possession.Applied", { name: actor.name }));
}

// Only the GM can press the button of the private message.
export function watchPossessionButton(message, html) {
  const button = html.querySelector?.("[data-sodl-level-up-possess]");
  if (!button) {
    return;
  }
  if (!game.user.isGM) {
    button.remove();
    return;
  }
  button.addEventListener("click", async () => {
    const actor = await fromUuid(button.dataset.sodlLevelUpPossess);
    if (actor) {
      button.disabled = true;
      await applyPossession(actor);
    }
  });
}
