// The mod's words in German and English, item names included.
export type Lang = 'de' | 'en'

export function languageOf(tag: string): Lang {
  return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

const MATERIAL_WORDS = {
  de: { wood: 'Holz', stone: 'Stein', iron: 'Eisen', gold: 'Gold', diamond: 'Diamant' },
  en: { wood: 'Wooden', stone: 'Stone', iron: 'Iron', gold: 'Golden', diamond: 'Diamond' },
}

const KIND_WORDS = {
  de: {
    pickaxe: 'spitzhacke',
    axe: 'axt',
    shovel: 'schaufel',
    hoe: 'hacke',
    sword: 'schwert',
    helmet: 'helm',
    chestplate: 'harnisch',
    leggings: 'hose',
    boots: 'stiefel',
  },
  en: {
    pickaxe: 'Pickaxe',
    axe: 'Axe',
    shovel: 'Shovel',
    hoe: 'Hoe',
    sword: 'Sword',
    helmet: 'Helmet',
    chestplate: 'Chestplate',
    leggings: 'Leggings',
    boots: 'Boots',
  },
}

const ITEMS = {
  de: {
    log: 'Holzstamm',
    planks: 'Bretter',
    stick: 'Stock',
    cobble: 'Bruchstein',
    coal: 'Kohle',
    iron: 'Eisenbarren',
    gold: 'Goldbarren',
    diamond: 'Diamant',
    string: 'Faden',
    wheat: 'Weizen',
    sugarcane: 'Zuckerrohr',
    leather: 'Leder',
    redstone: 'Redstone',
    flint: 'Feuerstein',
    table: 'Werkbank',
    torch: 'Fackel',
    plate: 'Druckplatte',
    shears: 'Schere',
    flint_and_steel: 'Feuerzeug',
    redstone_torch: 'Redstone-Fackel',
    wool: 'Wolle',
    book: 'Buch',
    paper: 'Papier',
    bread: 'Brot',
    chest: 'Truhe',
    furnace: 'Ofen',
    ladder: 'Leiter',
    fence: 'Zaun',
    door: 'Tür',
    boat: 'Boot',
    bowl: 'Schüssel',
    bow: 'Bogen',
    bucket: 'Eimer',
    minecart: 'Lore',
    cauldron: 'Kessel',
    rail: 'Schiene',
    shield: 'Schild',
    compass: 'Kompass',
    clock: 'Uhr',
    bookshelf: 'Bücherregal',
    jukebox: 'Plattenspieler',
    hay: 'Heuballen',
    button_wood: 'Holzknopf',
    button_stone: 'Steinknopf',
    plate_stone: 'Steindruckplatte',
    sugar: 'Zucker',
    block_iron: 'Eisenblock',
    block_gold: 'Goldblock',
    block_diamond: 'Diamantblock',
  },
  en: {
    log: 'Log',
    planks: 'Planks',
    stick: 'Stick',
    cobble: 'Cobblestone',
    coal: 'Coal',
    iron: 'Iron Ingot',
    gold: 'Gold Ingot',
    diamond: 'Diamond',
    string: 'String',
    wheat: 'Wheat',
    sugarcane: 'Sugar Cane',
    leather: 'Leather',
    redstone: 'Redstone',
    flint: 'Flint',
    table: 'Crafting Table',
    torch: 'Torch',
    plate: 'Pressure Plate',
    shears: 'Shears',
    flint_and_steel: 'Flint and Steel',
    redstone_torch: 'Redstone Torch',
    wool: 'Wool',
    book: 'Book',
    paper: 'Paper',
    bread: 'Bread',
    chest: 'Chest',
    furnace: 'Furnace',
    ladder: 'Ladder',
    fence: 'Fence',
    door: 'Door',
    boat: 'Boat',
    bowl: 'Bowl',
    bow: 'Bow',
    bucket: 'Bucket',
    minecart: 'Minecart',
    cauldron: 'Cauldron',
    rail: 'Rail',
    shield: 'Shield',
    compass: 'Compass',
    clock: 'Clock',
    bookshelf: 'Bookshelf',
    jukebox: 'Jukebox',
    hay: 'Hay Bale',
    button_wood: 'Wooden Button',
    button_stone: 'Stone Button',
    plate_stone: 'Stone Pressure Plate',
    sugar: 'Sugar',
    block_iron: 'Block of Iron',
    block_gold: 'Block of Gold',
    block_diamond: 'Block of Diamond',
  },
} as const

const WORDS = {
  de: {
    description: 'Crafting-Minispiel für die Wartezeit: 2×2-Inventar oder 3×3-Werkbank',
    argumentHint: '[2x2|3x3]',
    opened: 'Craft Rush ist offen. Viel Spaß!',
    unsupported: 'Craft Rush läuft in der Desktop-App und im Terminal.',
    intro: 'Du bekommst ein zufälliges Inventar. Crafte so viel du kannst, bevor die Zeit abläuft – zwischendurch kommen Lieferungen.',
    controlLines: [
      'Linksklick: Stack nehmen oder ablegen',
      'Rechtsklick: Hälfte nehmen, eins ablegen',
      'Ziehen: Stack verteilen',
      'Shift-Klick: verschieben, aufs Ergebnis: alles craften',
      'Doppelklick: alle gleichen einsammeln',
    ],
    delivery: 'Lieferung:',
    kitFor: (name: string) => `Lieferung, reicht für ${name}:`,
    controlsShort: 'Items ins Raster legen, dann das Ergebnis anklicken.',
    small: 'Inventar 2×2',
    table: 'Werkbank 3×3',
    smallShort: '2×2',
    tableShort: '3×3',
    seconds: (s: number) => `${s} s`,
    best: 'Rekord',
    noBest: 'noch keiner',
    points: (n: number) => `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`,
    crafts: (n: number) => `${n} ${n === 1 ? 'Craft' : 'Crafts'}`,
    book: 'Rezepte',
    hideBook: 'Rezepte zu',
    quit: 'Beenden',
    again: 'Nochmal',
    otherMode: 'Anderer Modus',
    close: 'Schließen',
    crafted: (points: number, count: number, name: string) => `+${points} ★  ${count > 1 ? `${count}× ` : ''}${name}`,
    timeUp: 'Zeit um!',
    ended: 'Runde beendet',
    newBest: 'Neuer Rekord!',
    quitToast: (score: number, best: number) => `Craft Rush: ${score} Punkte (Rekord ${best})`,
    allMaterials: 'Werkzeuge gibt es aus Holz, Stein, Eisen, Gold und Diamant, Rüstung aus Eisen, Gold und Diamant – je edler, desto mehr Punkte.',
    range: (low: number, high: number) => `+${low}–${high}`,
    each: (n: number) => `+${n}`,
  },
  en: {
    description: 'A crafting mini-game for the wait: 2×2 inventory or 3×3 crafting table',
    argumentHint: '[2x2|3x3]',
    opened: 'Craft Rush is open. Have fun!',
    unsupported: 'Craft Rush runs in the desktop app and the terminal.',
    intro: 'You get a random inventory. Craft as much as you can before time runs out – deliveries drop in along the way.',
    controlLines: [
      'Left click: take or put a stack',
      'Right click: take half, put one',
      'Drag: share a stack out',
      'Shift click: move across, on the result: craft all',
      'Double click: gather all alike',
    ],
    delivery: 'Delivery:',
    kitFor: (name: string) => `Delivery, enough for ${name}:`,
    controlsShort: 'Lay items on the grid, then click the result.',
    small: 'Inventory 2×2',
    table: 'Crafting table 3×3',
    smallShort: '2×2',
    tableShort: '3×3',
    seconds: (s: number) => `${s}s`,
    best: 'Best',
    noBest: 'none yet',
    points: (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`,
    crafts: (n: number) => `${n} ${n === 1 ? 'craft' : 'crafts'}`,
    book: 'Recipes',
    hideBook: 'Hide recipes',
    quit: 'Quit',
    again: 'Play again',
    otherMode: 'Other mode',
    close: 'Close',
    crafted: (points: number, count: number, name: string) => `+${points} ★  ${count > 1 ? `${count}× ` : ''}${name}`,
    timeUp: "Time's up!",
    ended: 'Round over',
    newBest: 'New best!',
    quitToast: (score: number, best: number) => `Craft Rush: ${score} points (best ${best})`,
    allMaterials: 'Tools come in wood, stone, iron, gold and diamond, armor in iron, gold and diamond – the finer, the more points.',
    range: (low: number, high: number) => `+${low}–${high}`,
    each: (n: number) => `+${n}`,
  },
}

export type Words = (typeof WORDS)['de']

export function wordsFor(lang: Lang): Words {
  return WORDS[lang]
}

export function itemName(lang: Lang, item: string): string {
  const made = /^([a-z]+)_(wood|stone|iron|gold|diamond)$/.exec(item)
  if (made && made[1]! in KIND_WORDS.de) {
    const kind = made[1] as keyof (typeof KIND_WORDS)['de']
    const material = made[2] as keyof (typeof MATERIAL_WORDS)['de']
    return lang === 'de'
      ? MATERIAL_WORDS.de[material] + KIND_WORDS.de[kind]
      : `${MATERIAL_WORDS.en[material]} ${KIND_WORDS.en[kind]}`
  }
  return (ITEMS[lang] as Record<string, string>)[item] ?? item
}

export function familyName(lang: Lang, family: string): string {
  if (family === 'block') return 'Block'
  const kind = family as keyof (typeof KIND_WORDS)['de']
  const word = KIND_WORDS[lang][kind] ?? family
  return lang === 'de' ? word.charAt(0).toUpperCase() + word.slice(1) : word
}
