// Builds a path or ancestry level shaped like the demonlord system stores it; tests pass what matters to them.
export function pathLevel(fields) {
  return {
    level: "1",
    attributeSelect: "",
    attributes: {
      strength: { value: 1, selected: false },
      agility: { value: 1, selected: false },
      intellect: { value: 1, selected: false },
      will: { value: 1, selected: false }
    },
    attributeSelectTwoSet1: "",
    attributeSelectTwoSet2: "",
    attributeSelectTwoSet3: "",
    attributeSelectTwoSet4: "",
    attributeSelectTwoSetValue1: 0,
    attributeSelectTwoSetValue2: 0,
    attributeSelectTwoSetSelectedValue1: false,
    attributeSelectTwoSetSelectedValue2: false,
    characteristics: { health: 0, healingRate: 0, defense: 0, perception: 0, speed: 0, power: 0 },
    talents: [],
    talentspick: [],
    spells: [],
    languages: [],
    languagesText: "",
    magicText: "",
    optionsText: "",
    ...fields
  };
}

export function nested(id, name) {
  return { id, _id: id, uuid: `Compendium.sdlc-1000.talents.Item.${id}`, name, selected: false };
}
