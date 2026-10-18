import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMagicText, parseTalentMagic } from "../../src/rules/magic-text.js";

test("« apprendre un sort » donne un sort à apprendre", () => {
  assert.deepEqual(parseMagicText("You learn one spell."), { discover: 0, choose: 0, learn: 1, traditions: null, religious: false });
  assert.deepEqual(parseMagicText("Learn one spell from your traditions."), { discover: 0, choose: 0, learn: 1, traditions: null, religious: false });
});

test("« apprendre deux sorts » en donne deux", () => {
  const magic = parseMagicText("You learn two spells from the traditions you chose for @UUID[Compendium.sdlc-1000.talents.Item.GBsmtzkF84TbNtoo].");

  assert.deepEqual(magic, { discover: 0, choose: 0, learn: 2, traditions: null, religious: false });
});

test("« découvrir une tradition ou apprendre un sort » laisse un choix entre les deux", () => {
  assert.deepEqual(
    parseMagicText("You either discover a new tradition or learn one spell from a tradition you have already discovered."),
    { discover: 0, choose: 1, learn: 0, traditions: null, religious: false }
  );
  assert.deepEqual(parseMagicText("You discover a tradition or learn one spell."), { discover: 0, choose: 1, learn: 0, traditions: null, religious: false });
});

test("une voie liée à une tradition limite le choix à celle-ci", () => {
  const magic = parseMagicText("You discover the Fire tradition or learn one Fire spell.");

  assert.deepEqual(magic, { discover: 0, choose: 1, learn: 0, traditions: ["Fire"], religious: false });
});

test("une voie liée à plusieurs traditions les garde toutes", () => {
  const magic = parseMagicText("You discover the Life, Nature, or Primal tradition, or you learn one spell from those traditions.");

  assert.deepEqual(magic.traditions, ["Life", "Nature", "Primal"]);
  assert.equal(magic.choose, 1);
});

test("« faites deux choix » ou « trois choix » donne autant de choix", () => {
  assert.equal(parseMagicText("You make two choices, discovering one tradition or learning one spell for each.").choose, 2);
  assert.equal(parseMagicText("Make two choices. For each choice, you either discover a new tradition or learn a spell from a tradition you have discovered.").choose, 2);
});

test("« découvrez une tradition, puis faites trois choix » impose d'abord une découverte", () => {
  const magic = parseMagicText("You discover one tradition. Then, make three choices. For each choice, you either discover another tradition or learn a spell from a tradition you have discovered.");

  assert.deepEqual(magic, { discover: 1, choose: 3, learn: 0, traditions: null, religious: false });
});

test("les traditions liées à la religion du prêtre sont signalées", () => {
  const first = parseMagicText("You discover one tradition associated with your religion (see Religious Traditions). Then make two choices. For each choice, either discover a tradition associated with your religion or learn one spell from a tradition you have discovered.");
  const later = parseMagicText("You discover one tradition associated with your religion or you learn one spell.");

  assert.deepEqual(first, { discover: 1, choose: 2, learn: 0, traditions: null, religious: true });
  assert.deepEqual(later, { discover: 0, choose: 1, learn: 0, traditions: null, religious: true });
});

test("un sort nommé en plus du choix est déjà donné par la liste du niveau : seul le choix compte", () => {
  const magic = parseMagicText("You either discover a new tradition or learn one spell from a tradition you have already discovered. In addition, you learn the spellbound weapon spell, described below.");

  assert.deepEqual(magic, { discover: 0, choose: 1, learn: 0, traditions: null, religious: false });
});

test("un texte que le module ne comprend pas reste un rappel", () => {
  assert.equal(parseMagicText("You gain the ability to cast rituals."), null);
  assert.equal(parseMagicText(""), null);
});

test("« découvrez une tradition et apprenez un sort » donne une découverte puis un sort", () => {
  const magic = parseMagicText("You increase your Power by 1, discover a tradition, and learn one spell from that tradition.");

  assert.deepEqual(magic, { discover: 1, choose: 0, learn: 1, traditions: null, religious: false });
});

test("un talent qui accorde un choix de magie est reconnu, comme Magie légendaire", () => {
  assert.deepEqual(
    parseTalentMagic("<p>You discover a tradition or you learn one spell from a tradition you have discovered. You can choose this talent multiple times, and its effect is cumulative.</p>"),
    { discover: 0, choose: 1, learn: 0, traditions: null, religious: false }
  );
  assert.deepEqual(
    parseTalentMagic("<p>Increase your Power by 1 and discover one tradition. Then make two choices. For each choice, you either discover another tradition or learn one spell from a tradition you have discovered.</p>"),
    { discover: 1, choose: 2, learn: 0, traditions: null, religious: false }
  );
  assert.equal(parseTalentMagic("<p>You increase your Power by 1 and either discover a tradition or learn a spell from a tradition you have already discovered</p>").choose, 1);
});

test("un talent qui parle seulement de magie en passant n'ouvre pas de choix", () => {
  assert.equal(parseTalentMagic("<p>Whenever you discover a tradition, you learn an extra rank 0 spell from that tradition.</p>"), null);
  assert.equal(parseTalentMagic("<p>You do not gain Corruption from discovering the Curse tradition, nor are you at risk of gaining Corruption from learning Curse spells.</p>"), null);
  assert.equal(parseTalentMagic("<p>You learn the mask spell from the Transformation tradition even if you have not yet discovered the Transformation tradition.</p>"), null);
  assert.equal(parseTalentMagic("<p>You learn one spell. It must have a rank equal to no more than half your Power score. The spell can be from any tradition and is chosen by the GM.</p>"), null);
  assert.equal(parseTalentMagic(""), null);
});
