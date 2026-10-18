# Shadow of the Demon Lord - Level Up

🇫🇷 [Version française](README.fr.md)

Foundry VTT module for **Shadow of the Demon Lord**: an assistant to reach the next level without forgetting anything.

**Compatibility:** Foundry VTT v13+ (tested on v14) | `demonlord` system v6.1.0+

**Languages:** French and English, following Foundry's language setting.

## The problem

In the `demonlord` system, changing a character's level adds the level's talents, but:
- the **choices** (attributes to raise, a talent or spell to pick from a list) are made by ticking boxes **in the path sheet, before** levelling up, or they are ignored;
- talents "to pick" with **a single option**, such as *Determined* at human level 4, are never added until ticked;
- at levels 3 and 7, the expert or master path has to be added by hand.

## What the assistant does

A **Level up** entry appears in the character sheet's header menu (for the GM and the character's owner). It opens a window showing, for the next level:

1. **The path to choose** at level 1 (novice), 3 (expert), 7 (master) or 11 (legendary), from the world and every compendium, with its description.
2. **What each path and the ancestry grant outright**: Health, Defense, Power…, talents, languages, and the talent or spell that is the only one "to pick".
3. **The level's choices**: attributes ("choose two", "choose three", "two sets"), a talent or spell from a list. Those already known are greyed out. Each block turns green once complete.
4. **Magic**: sentences such as "discover a tradition or learn one spell" become guided choices (all 44 wordings of the core book are understood):
   - **discover a tradition**: one not known yet, then one of its rank 0 spells;
   - **learn a spell**: from a known tradition (or one discovered just before, at the same level), with a rank up to the **Power after this level**;
   - paths tied to a tradition (Pyromancer: Fire) only offer that one; for the priest, a reminder to pick a tradition of their religion;
   - talents granting magic (*Legendary Magic*, the rogue's *Magic*…) add their choices to the level as soon as they are picked;
   - **dark magic** (Curse, Death, Demonology, Forbidden, Madness, Necromancy): +1 Corruption per tradition discovered, and a d6 per spell learned (+1 if lower than the total of dark spells learned), as in the book.
   - **possession** (*Companion*, Demonology): a secret d6 for each Demonology spell gained; lower than the Corruption, the GM gets a private message with a button to apply the *Possessed* effect whenever they choose.
5. **The choices to handle yourself**, which the book only describes in words (languages and professions), as a reminder.

**Several levels at once**: the flag in the header sets the level aimed for. The assistant goes level after level (a level's choices depend on the previous one), posts a chat card for each, and closes once that level is reached.

**Legendary levels**: with the legendary *Paragon* path (*Occult Philosophy*), the assistant goes up to level 20: Health +1 and a legendary talent per level; cumulative talents (Legendary Agility, Legendary Health…) can be taken again. The GM can turn these levels off in the module settings (*Legendary levels*).

The **Go to level N** button ticks the choices in the path, adds the level's talents, spells and languages with the same flags as the system (lowering the level removes them as usual), then changes the level. A summary is posted in the chat.

Names and descriptions are read from the compendiums, so they follow the translation in use.

## For macros and other modules

```js
game.modules.get("sodl-level-up").api.open(actor);
```

## Limits

- Language or profession choices are still made on the sheet: the assistant reminds them.
- Swapping a spell for another (core rules, *Swapping Spells*) is not offered.
- Religious traditions are not filtered: the player picks the one of their religion.
- Character creation (ancestry, starting attributes) is not covered: the assistant starts at the step from level 0 to level 1.

## Installation

In Foundry: *Add-on Modules → Install Module*, then paste the manifest URL:

```
https://raw.githubusercontent.com/Stphn-Wrn/sodl-level-up/main/module.json
```

## Development

```sh
npm test
```
