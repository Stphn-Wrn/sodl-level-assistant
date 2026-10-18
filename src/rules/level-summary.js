import { stepKey } from "../constants.js";
import { ATTRIBUTES, CHARACTERISTICS } from "./level-choices.js";

function add(totals, key, value) {
  totals[key] = (totals[key] ?? 0) + value;
}

function inOrder(totals, keys) {
  return keys.filter((key) => totals[key]).map((key) => ({ key, value: totals[key] }));
}

// How each kind of attribute choice adds to the totals.
const ATTRIBUTE_GAINS = {
  pick: (choice, selection, totals) => {
    for (const option of choice.options.filter((candidate) => (selection.attributes ?? []).includes(candidate.key))) {
      add(totals, option.key, option.value);
    }
  },
  sets: (choice, selection, totals) => {
    choice.sets.forEach((set, index) => {
      const key = set.options[selection.sets?.[index]];
      if (key) {
        add(totals, key, set.value);
      }
    });
  }
};

// What the whole level brings, all paths and the ancestry together, for the chat card.
export function levelUpSummary(plan, selections) {
  const characteristics = {};
  const attributes = {};
  const reminders = [];
  for (const step of plan.steps) {
    const { granted, attributes: choice } = step.choices;
    for (const { key, value } of granted.characteristics) {
      add(characteristics, key, value);
    }
    for (const { key, value } of granted.attributes) {
      add(attributes, key, value);
    }
    if (choice) {
      ATTRIBUTE_GAINS[choice.kind](choice, selections[stepKey(step)] ?? {}, attributes);
    }
    reminders.push(...step.choices.reminders.map((reminder) => ({ source: step.itemName, ...reminder })));
  }
  return {
    characteristics: inOrder(characteristics, CHARACTERISTICS),
    attributes: inOrder(attributes, ATTRIBUTES),
    reminders
  };
}
