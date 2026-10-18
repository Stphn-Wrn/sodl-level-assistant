import { test } from "node:test";
import assert from "node:assert/strict";
import { darkMagicCorruption, groupTraditions, isDark, isPossessedBy, risksPossession, knownTraditions, magicSlots, magicErrors, slotOptions, traditionsOf } from "../../src/rules/magic-choices.js";

function catalog() {
  return [
    { uuid: "s.fire0a", name: "Flame", tradition: "Fire", rank: 0, dark: false },
    { uuid: "s.fire0b", name: "Fire Bolt", tradition: "Fire", rank: 0, dark: false },
    { uuid: "s.fire1", name: "Burning Hands", tradition: "Fire", rank: 1, dark: false },
    { uuid: "s.fire2", name: "Fireball", tradition: "Fire", rank: 2, dark: false },
    { uuid: "s.arc0", name: "Arcane Bolt", tradition: "Arcana", rank: 0, dark: false },
    { uuid: "s.arc1", name: "Magic Shield", tradition: "Arcana", rank: 1, dark: false },
    { uuid: "s.nec0", name: "Grave Touch", tradition: "Necromancy", rank: 0, dark: true },
    { uuid: "s.mag", name: "Sense Magic", tradition: "Magician", rank: 0, dark: false }
  ];
}

test("les traditions proposées sont les vraies traditions, pas les sorts propres à une voie", () => {
  const traditions = traditionsOf(catalog(), 2);

  assert.deepEqual(traditions, ["Arcana", "Fire"]);
});

test("les traditions connues sont celles des sorts déjà sur la fiche", () => {
  const known = knownTraditions([{ tradition: "Fire" }, { tradition: "Fire" }, { tradition: "Arcana" }]);

  assert.deepEqual([...known], ["Fire", "Arcana"]);
});

test("une découverte imposée vient avant les choix, puis les sorts à apprendre", () => {
  const slots = magicSlots({ discover: 1, choose: 2, learn: 1, traditions: null, religious: false });

  assert.deepEqual(slots.map((slot) => slot.kind), ["discover", "choose", "choose", "learn"]);
});

test("découvrir une tradition : les traditions pas encore connues, et leurs sorts de rang 0", () => {
  const options = slotOptions({ mode: "discover", tradition: "Fire", restriction: null, catalog: catalog(), known: new Set(["Arcana"]), power: 2, taken: [] });

  assert.deepEqual(options.traditions, ["Fire"]);
  assert.deepEqual(options.spells.map((spell) => spell.uuid), ["s.fire0a", "s.fire0b"]);
});

test("apprendre un sort : ceux des traditions connues, de rang inférieur ou égal à la Puissance, pas déjà connus", () => {
  const options = slotOptions({ mode: "learn", tradition: null, restriction: null, catalog: catalog(), known: new Set(["Fire"]), power: 1, taken: ["s.fire0a"], knownSpells: ["Fire Bolt"] });

  assert.deepEqual(options.spells.map((spell) => spell.uuid), ["s.fire1"]);
});

test("une voie liée à une tradition ne propose que celle-ci", () => {
  const discover = slotOptions({ mode: "discover", tradition: null, restriction: ["Fire"], catalog: catalog(), known: new Set(), power: 1, taken: [] });
  const learn = slotOptions({ mode: "learn", tradition: null, restriction: ["Fire"], catalog: catalog(), known: new Set(["Fire", "Arcana"]), power: 1, taken: [] });

  assert.deepEqual(discover.traditions, ["Fire"]);
  assert.deepEqual(learn.spells.map((spell) => spell.uuid), ["s.fire0a", "s.fire0b", "s.fire1"]);
});

test("une tradition découverte à ce niveau permet d'y apprendre un sort dans un choix suivant", () => {
  const slots = magicSlots({ discover: 1, choose: 1, learn: 0, traditions: null, religious: false });
  const chosen = [{ mode: "discover", tradition: "Fire", spell: "s.fire0a" }, { mode: "learn", spell: "s.fire1" }];

  const errors = magicErrors({ slots, chosen, catalog: catalog(), known: new Set(), power: 1, knownSpells: [] });

  assert.deepEqual(errors, []);
});

test("chaque choix de magie doit être complet et valable", () => {
  const slots = magicSlots({ discover: 0, choose: 2, learn: 0, traditions: null, religious: false });

  assert.deepEqual(magicErrors({ slots, chosen: [], catalog: catalog(), known: new Set(["Fire"]), power: 1, knownSpells: [] }), [0, 1]);
  assert.deepEqual(magicErrors({ slots, chosen: [{ mode: "learn", spell: "s.fire2" }, { mode: "discover", tradition: "Arcana", spell: "s.arc0" }], catalog: catalog(), known: new Set(["Fire"]), power: 1, knownSpells: [] }), [0]);
  assert.deepEqual(magicErrors({ slots, chosen: [{ mode: "learn", spell: "s.fire1" }, { mode: "learn", spell: "s.fire1" }], catalog: catalog(), known: new Set(["Fire"]), power: 1, knownSpells: [] }), [1]);
});

test("découvrir une tradition de magie noire donne 1 en Corruption", () => {
  const corruption = darkMagicCorruption({ discoveredDark: 1, learnedDark: [], rolls: [] });

  assert.equal(corruption, 1);
});

test("apprendre un sort de magie noire : 1 en Corruption si le d6 est inférieur au total de sorts noirs appris", () => {
  assert.equal(darkMagicCorruption({ discoveredDark: 0, learnedDark: [3], rolls: [2] }), 1);
  assert.equal(darkMagicCorruption({ discoveredDark: 0, learnedDark: [3], rolls: [3] }), 0);
  assert.equal(darkMagicCorruption({ discoveredDark: 1, learnedDark: [1, 2], rolls: [1, 1] }), 2);
});

test("les traditions de magie noire de tous les livres sont reconnues, Démonologie comprise", () => {
  const dark = ["Curse", "Death", "Demonology", "Forbidden", "Madness", "Necromancy"].filter((tradition) => isDark({ tradition, dark: false }));
  const notDark = ["Alchemy", "Telepathy", "Fire"].filter((tradition) => isDark({ tradition, dark: false }));

  assert.deepEqual(dark, ["Curse", "Death", "Demonology", "Forbidden", "Madness", "Necromancy"]);
  assert.deepEqual(notDark, []);
});

test("découvrir la Démonologie donne 1 en Corruption", () => {
  const discoveredDark = [{ tradition: "Demonology", dark: false }].filter(isDark).length;

  assert.equal(darkMagicCorruption({ discoveredDark, learnedDark: [], rolls: [] }), 1);
});

test("possession : un démon s'empare du personnage si le d6 est inférieur à sa Corruption", () => {
  assert.equal(isPossessedBy(2, 3), true);
  assert.equal(isPossessedBy(3, 3), false);
  assert.equal(isPossessedBy(1, 0), false);
});

test("seuls les sorts de Démonologie font risquer la possession", () => {
  const spells = [{ tradition: "Demonology" }, { tradition: "Necromancy" }, { tradition: "Demonology" }];

  assert.equal(spells.filter(risksPossession).length, 2);
});

test("les traditions se rangent par attribut, comme dans le livre : Intellect pour les magiciens, Volonté pour les prêtres", () => {
  const spells = [
    { uuid: "a", name: "A", tradition: "Arcana", rank: 0, attribute: "intellect" },
    { uuid: "b", name: "B", tradition: "Arcana", rank: 1, attribute: "intellect" },
    { uuid: "c", name: "C", tradition: "Theurgy", rank: 0, attribute: "will" },
    { uuid: "d", name: "D", tradition: "Theurgy", rank: 1, attribute: "" },
    { uuid: "e", name: "E", tradition: "Odd", rank: 0, attribute: "" }
  ];

  const groups = groupTraditions(spells, ["Arcana", "Odd", "Theurgy"]);

  assert.deepEqual(groups, [
    { attribute: "intellect", traditions: ["Arcana"] },
    { attribute: "will", traditions: ["Theurgy"] },
    { attribute: "other", traditions: ["Odd"] }
  ]);
});

test("une « tradition » de moins de 5 sorts propre à une voie n'est pas proposée quand on fixe le seuil", () => {
  const spells = [
    ...["a", "b", "c", "d", "e"].map((name) => ({ uuid: name, name, tradition: "Fire", rank: 0 })),
    { uuid: "m1", name: "Sense Magic", tradition: "Magician", rank: 0 },
    { uuid: "m2", name: "Other", tradition: "Magician", rank: 0 }
  ];

  assert.deepEqual(traditionsOf(spells, 5), ["Fire"]);
});
