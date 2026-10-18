import { NEW_PATH_ID, modulePath, stepKey } from "../constants.js";
import { applyLevelUp } from "../foundry/level-applier.js";
import { loadPath, pathsOfType } from "../foundry/path-catalog.js";
import { whisperPossession } from "../foundry/possession.js";
import { maxLevel } from "../foundry/settings.js";
import { actorMagic, loadSpellCatalog } from "../foundry/spell-catalog.js";
import { ATTRIBUTES } from "../rules/level-choices.js";
import { buildLevelUpPlan, grantedPower } from "../rules/level-plan.js";
import { stepSlots } from "../rules/level-selection.js";
import { knownTraditions } from "../rules/magic-choices.js";
import { levelUpSummary } from "../rules/level-summary.js";
import { buildViewModel } from "./view-model.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const CHAT_TEMPLATE = modulePath("templates/chat-card.hbs");

function t(key, data) {
  if (data) {
    return game.i18n.format(key, data);
  }
  return game.i18n.localize(key);
}

function renderTemplate(path, data) {
  return foundry.applications.handlebars.renderTemplate(path, data);
}

// Every nested entry the window shows, to read its translated name, description and icon from the compendiums.
function shownEntries(plan) {
  const entries = [];
  for (const step of plan?.steps ?? []) {
    const { talents, spells, granted } = step.choices;
    for (const choice of [talents, spells]) {
      entries.push(...(choice?.options ?? []), ...(choice?.items ?? []));
    }
    entries.push(...granted.talents, ...granted.languages);
  }
  return entries.filter((entry) => entry.uuid);
}

function attributeValues(actor) {
  return Object.fromEntries(ATTRIBUTES.map((key) => [key, Number(actor.system.attributes?.[key]?.value) || 0]));
}

function link(document) {
  return `@UUID[${document.uuid}]{${document.name}}`;
}

function traditionLabel(tradition) {
  const key = `SODLLEVELUP.Traditions.${tradition}`;
  const label = t(key);
  if (label === key) {
    return tradition;
  }
  return label;
}

function corruptionView(corruption) {
  if (!corruption) {
    return null;
  }
  return { label: t("SODLLEVELUP.Chat.Corruption", { value: corruption.value }), rolls: corruption.rolls.join(", ") };
}

// The chat card: what the level brought, attributes with their old and new values, links to every new item.
async function chatCard(actor, result, selections, before) {
  const summary = levelUpSummary(result.plan, selections);
  return renderTemplate(CHAT_TEMPLATE, {
    traditions: result.traditions.map(traditionLabel).join(", "),
    corruption: corruptionView(result.corruption),
    actor: { name: actor.name, img: actor.img },
    reached: t("SODLLEVELUP.Chat.Reached", { to: result.plan.to }),
    path: result.newPath && { img: result.newPath.img, link: link(result.newPath) },
    characteristics: summary.characteristics.map(({ key, value }) => ({ label: t(`SODLLEVELUP.Characteristics.${key}`), value })),
    attributes: summary.attributes.map(({ key, value }) => ({ label: t(`SODLLEVELUP.Attributes.${key}`), from: before[key], to: before[key] + value })),
    items: result.added.map((item) => ({ img: item.img, link: link(item) })),
    reminders: summary.reminders.map((reminder) => ({ ...reminder, label: t(`SODLLEVELUP.Reminders.${reminder.kind}`) })),
    toDoLabel: t("SODLLEVELUP.Chat.ToDo")
  });
}

export class LevelUpApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sodl-level-up"],
    window: { icon: "fa-solid fa-arrow-up-right-dots", resizable: true },
    position: { width: 560, height: 720 },
    actions: { levelUp: LevelUpApp.#onLevelUp }
  };

  static PARTS = {
    body: { template: modulePath("templates/level-up.hbs"), scrollable: [".lvlup-body", ".lvlup-paths", ".lvlup-description"] }
  };

  constructor(actor, options = {}) {
    super({ ...options, id: `sodl-level-assistant-${actor.id}` });
    this.actor = actor;
    this.selections = {};
    this.chosenPath = null;
    this.paths = null;
    this.pathFilter = "";
    this.names = {};
    this.spellCatalog = null;
    this.target = null;
    this.openGroups = new Set();
    this.busy = false;
  }

  get title() {
    return `${t("SODLLEVELUP.WindowTitle")} — ${this.actor.name}`;
  }

  #level() {
    return Number(this.actor.system.level) || 0;
  }

  #items() {
    const items = this.actor.items.map((item) => item.toObject());
    if (this.chosenPath) {
      items.push({ ...this.chosenPath.data, _id: NEW_PATH_ID });
    }
    return items;
  }

  async #loadNames(plan) {
    for (const entry of shownEntries(plan)) {
      if (this.names[entry.id]) {
        continue;
      }
      const document = await fromUuid(entry.uuid);
      if (document) {
        this.names[entry.id] = { name: document.name, img: document.img, description: document.system?.description ?? "" };
      }
    }
  }

  async _prepareContext() {
    const neededPath = buildLevelUpPlan({ level: this.#level(), items: this.actor.items.map((item) => item.toObject()), maxLevel: maxLevel() })?.missingPath ?? null;
    const plan = buildLevelUpPlan({ level: this.#level(), items: this.#items(), maxLevel: maxLevel() });
    if (neededPath && !this.paths) {
      this.paths = await pathsOfType(neededPath);
    }
    await this.#loadNames(plan);
    const magicContext = await this.#magicContext(plan);
    return {
      ...buildViewModel({
        actorName: this.actor.name,
        actorImg: this.actor.img,
        plan,
        neededPath,
        selections: this.selections,
        names: this.names,
        paths: this.paths,
        chosenPath: this.chosenPath,
        attributeValues: attributeValues(this.actor),
        magicContext,
        openGroups: this.openGroups,
        target: this.#target(plan),
        maxLevel: maxLevel(),
        t
      }),
      pathFilter: this.pathFilter
    };
  }

  // The level the player aims for; never below the next one.
  #target(plan) {
    if (!plan) {
      return null;
    }
    return Math.max(this.target ?? plan.to, plan.to);
  }

  // After a level, start again from scratch for the next one, until the level aimed for is reached.
  #nextLevel() {
    this.selections = {};
    this.chosenPath = null;
    this.paths = null;
    this.pathFilter = "";
    this.openGroups.clear();
  }

  // The spells on offer and what the character knows, loaded only when a level, or the talent chosen, has magic choices.
  // Power counts what this level adds: the spells learned now may already use it.
  async #magicContext(plan) {
    if (!plan?.steps.some((step) => stepSlots(step.choices, this.selections[stepKey(step)] ?? {}).length)) {
      return null;
    }
    if (!this.spellCatalog) {
      this.spellCatalog = await loadSpellCatalog();
    }
    const { spells, power } = actorMagic(this.actor);
    return {
      catalog: this.spellCatalog,
      known: knownTraditions(spells),
      power: power + grantedPower(plan),
      knownSpells: spells.map((spell) => spell.name),
      // Real traditions have a dozen spells; a path's own spell (Magician…) is filed under a "tradition" of one or two.
      minimumSpells: 5
    };
  }

  // One listener for the whole window: every input says which step and which choice it belongs to.
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", (event) => this.#onChange(event.target));
    // "toggle" does not bubble: listen during capture. Opening a panel needs no redraw, only to be remembered.
    this.element.addEventListener("toggle", (event) => {
      const key = event.target.dataset?.groupKey;
      if (!key) {
        return;
      }
      if (event.target.open) {
        this.openGroups.add(key);
      } else {
        this.openGroups.delete(key);
      }
    }, true);
    this.element.addEventListener("input", (event) => {
      if (event.target.name === "path-filter") {
        this.pathFilter = event.target.value;
        this.#filterPaths();
      }
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#filterPaths();
  }

  // Filtering hides cards without redrawing the window, so the search field keeps the focus.
  #filterPaths() {
    const search = this.pathFilter.trim().toLocaleLowerCase(game.i18n.lang);
    for (const card of this.element.querySelectorAll("[data-path-name]")) {
      card.hidden = Boolean(search) && !card.dataset.pathName.toLocaleLowerCase(game.i18n.lang).includes(search);
    }
  }

  async #onChange(input) {
    if (input.name === "target") {
      this.target = Number(input.value);
      this.render();
      return;
    }
    if (input.name === "path") {
      await this.#choosePath(input.value);
      return;
    }
    const { step, field } = input.dataset;
    if (!step) {
      return;
    }
    const selection = { ...this.selections[step] };
    if (field === "attribute") {
      selection.attributes = [...this.element.querySelectorAll(`input[data-step="${step}"][data-field="attribute"]:checked`)].map((box) => box.value);
    }
    if (field === "set") {
      const sets = [...(selection.sets ?? [])];
      sets[Number(input.dataset.index)] = Number(input.value);
      selection.sets = sets;
    }
    if (field === "talent" || field === "spell") {
      selection[field] = input.value;
    }
    // Another talent may bring other magic slots (Legendary Magic): the magic choices start over.
    if (field === "talent") {
      delete selection.magic;
    }
    if (field.startsWith("magic-")) {
      selection.magic = this.#magicSelection(selection.magic, field, Number(input.dataset.slot), input.value);
    }
    this.selections[step] = selection;
    this.render();
  }

  // Changing the mode clears the slot, changing the tradition clears its spell.
  #magicSelection(current, field, slot, value) {
    const magic = [...(current ?? [])];
    const choice = magic[slot] ?? {};
    if (field === "magic-mode") {
      magic[slot] = { mode: value };
    }
    if (field === "magic-tradition") {
      magic[slot] = { ...choice, tradition: value, spell: null };
    }
    if (field === "magic-spell") {
      magic[slot] = { ...choice, spell: value };
    }
    return magic;
  }

  async #choosePath(uuid) {
    // Choices made for the previous path no longer apply.
    for (const key of Object.keys(this.selections).filter((candidate) => candidate.startsWith(`${NEW_PATH_ID}:`))) {
      delete this.selections[key];
    }
    this.chosenPath = null;
    const loaded = await loadPath(uuid);
    if (loaded) {
      const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(loaded.description);
      this.chosenPath = { uuid, name: loaded.data.name, img: loaded.data.img, data: loaded.data, description };
    }
    this.render();
  }

  static async #onLevelUp() {
    if (this.busy) {
      return;
    }
    this.busy = true;
    const before = attributeValues(this.actor);
    try {
      const result = await applyLevelUp(this.actor, { pathData: this.chosenPath?.data, selections: this.selections, catalog: this.spellCatalog ?? [], maxLevel: maxLevel() });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: await chatCard(this.actor, result, this.selections, before)
      });
      if (result.possession) {
        await whisperPossession(this.actor, result.possession);
      }
      ui.notifications.info(t("SODLLEVELUP.Done", { name: this.actor.name, to: result.plan.to }));
      if ((this.target ?? result.plan.to) > result.plan.to) {
        this.#nextLevel();
        this.render();
      } else {
        await this.close();
      }
    } catch (error) {
      console.error(error);
      ui.notifications.error(t("SODLLEVELUP.Errors.Failed", { error: error.message }));
    } finally {
      this.busy = false;
    }
  }
}

export function openLevelUp(actor) {
  const open = foundry.applications.instances.get(`sodl-level-assistant-${actor.id}`);
  if (open) {
    open.bringToFront();
    return open;
  }
  const app = new LevelUpApp(actor);
  app.render({ force: true });
  return app;
}
