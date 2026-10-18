const NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };

function count(word) {
  return NUMBERS[word.toLowerCase()] ?? 0;
}

// "You discover the Fire tradition…", "You discover the Life, Nature, or Primal tradition…"
function namedTraditions(text) {
  const match = text.match(/discover the ((?:[A-Z][a-z]+)(?:(?:,\s*|,?\s+or\s+)[A-Z][a-z]+)*) tradition/);
  if (!match) {
    return null;
  }
  return match[1].split(/,\s*(?:or\s+)?|\s+or\s+/).filter(Boolean);
}

// Reads the magic sentence of a path level, as the core books word it:
// - discover: traditions to discover first ("You discover one tradition. Then…"),
// - choose: choices between discovering a tradition and learning a spell,
// - learn: spells to learn,
// - traditions: the only traditions allowed, when the path names them,
// - religious: the priest's traditions, which depend on the character's religion.
// Returns null for a sentence it does not understand, which then stays a reminder.
export function parseMagicText(text) {
  const clean = String(text ?? "").trim();
  if (!clean) {
    return null;
  }
  let discover = 0;
  if (/discover (?:one|a|an) tradition[^.]*\.\s*then/i.test(clean)) {
    discover = 1;
  }
  let choose = 0;
  let learn = 0;
  const choices = clean.match(/make (\w+) choices/i);
  // "discover a tradition, and learn one spell from that tradition": both, not a choice between them.
  const both = clean.match(/discover (?:a|an|one) tradition,? and learn (\w+) spells?/i);
  if (both) {
    discover = 1;
    learn = count(both[1]);
  } else if (choices) {
    choose = count(choices[1]);
  } else if (/discover/i.test(clean) && /learn/i.test(clean)) {
    choose = 1;
  } else {
    const spells = clean.match(/learn (\w+) spells?/i);
    if (spells) {
      learn = count(spells[1]);
    }
  }
  if (!discover && !choose && !learn) {
    return null;
  }
  return { discover, choose, learn, traditions: namedTraditions(clean), religious: /religion/i.test(clean) };
}

// A talent only grants magic when its first sentence says so ("You discover a tradition or you learn one spell…",
// "Increase your Power by 1 and discover one tradition. Then…"). Talents that merely mention traditions
// ("Whenever you discover a tradition…") or name the spell ("You learn the mask spell…") open no choice,
// nor do those whose spell the GM picks.
export function parseTalentMagic(description) {
  const text = String(description ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const grants = /^(?:you )?(?:increase your power by \d+(?:,| and) )?(?:you )?(?:either )?(?:discover (?:a|an|one) tradition|learn (?:one|two|three|a|an) spells?\b)/i;
  if (!grants.test(text) || /\bGM\b/.test(text)) {
    return null;
  }
  return parseMagicText(text);
}
