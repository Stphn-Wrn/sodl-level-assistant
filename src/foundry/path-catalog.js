// Every path of a tier (novice, expert, master) in the world and in the Item compendiums: core book, supplements, homebrew.
export async function pathsOfType(type) {
  const paths = game.items
    .filter((item) => item.type === "path" && item.system.type === type)
    .map((item) => ({ uuid: item.uuid, name: item.name, img: item.img, source: game.i18n.localize("SODLLEVELUP.WorldItems") }));
  for (const pack of game.packs.filter((candidate) => candidate.documentName === "Item")) {
    const index = await pack.getIndex({ fields: ["system.type"] });
    for (const entry of index) {
      if (entry.type === "path" && entry.system?.type === type) {
        paths.push({ uuid: entry.uuid, name: entry.name, img: entry.img, source: pack.metadata.label });
      }
    }
  }
  return paths.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

// The full path picked in the list, as plain data ready to be added to the character.
export async function loadPath(uuid) {
  const document = await fromUuid(uuid);
  if (!document) {
    return null;
  }
  const data = document.toObject();
  delete data._id;
  if (document.pack) {
    data._stats = { ...data._stats, compendiumSource: uuid };
  }
  return { data, description: document.system.description ?? "" };
}
