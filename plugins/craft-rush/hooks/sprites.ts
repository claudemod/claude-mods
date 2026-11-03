// The items' pictures: 16 by 16 pixel art, one character per pixel, drawn as
// crisp SVG paths with a soft drop shadow. Light falls from the top left.
//
// Two kinds of sprite. A painted one names every pixel's colour: lowercase
// letters and digits from PALETTE, and H, L, M, D and S (highlight to shadow)
// from the material it is made of. A shaped one draws regions instead: each
// uppercase letter (or #) is a region the sprite shades by itself, its top and
// left edges lit and its bottom and right edges dark, and outlines; lowercase
// letters and digits stay fixed colours.

import { textPath, textWidth } from './pixel'

const PALETTE: Record<string, string> = {
  k: '#1c1612', // outline
  w: '#ffffff', // sparkle
  1: '#3b2614', // wood, darkest
  2: '#5e3f22',
  3: '#8a5f34',
  4: '#b5824b',
  5: '#d9a868',
  6: '#f0cb8e', // wood, highlight
  7: '#3a2817', // bark, darkest
  8: '#5a4128',
  9: '#7d5b39',
  t: '#e6c690', // tree rings
  T: '#bf9460',
  u: '#8f6538',
  a: '#2f2f33', // stone, darkest
  b: '#4d4d52',
  c: '#6f6f75',
  d: '#94949a',
  f: '#c4d4dc', // stone, light; glass
  x: '#1c1c1f', // coal
  X: '#34343a',
  q: '#55555e',
  Q: '#9a9aa8',
  s: '#f7f7f7', // string, paper
  g: '#c8c8c8',
  z: '#6e6e6e',
  y: '#fff27a', // flame
  o: '#ffae3b',
  r: '#f0602a',
  p: '#d8443a', // red
  P: '#8e2219',
  v: '#3f7f26', // dark green
  e: '#e8c34a', // gilt
  n: '#141414', // the dark inside of things
}

export type Material = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond'

type Ramp = readonly [string, string, string, string, string]

const MATERIAL: Record<Material, Ramp> = {
  wood: ['#f0cb8e', '#d9a868', '#b5824b', '#8a5f34', '#5e3f22'],
  stone: ['#d2d2d7', '#a9a9af', '#85858c', '#5f5f66', '#3f3f45'],
  iron: ['#ffffff', '#e6e8ea', '#c3c7cb', '#8f959b', '#5d6268'],
  gold: ['#fffbd0', '#ffe766', '#f5c22e', '#c98f10', '#8a5a06'],
  diamond: ['#effffc', '#9ff5ea', '#4ddccb', '#1fa79a', '#0e6b62'],
}

const RAMP_INDEX: Record<string, number> = { H: 0, L: 1, M: 2, D: 3, S: 4 }

// The regions a shaped sprite may draw, besides M (its material).
const REGIONS: Record<string, Ramp> = {
  '#': MATERIAL.wood,
  A: ['#cfcfd4', '#a4a4aa', '#808086', '#5c5c62', '#3c3c42'], // dark iron, cauldron
  B: ['#f8c985', '#e6a85a', '#c8843c', '#9c5a24', '#6e3c14'], // bread
  E: ['#c4f59a', '#8fd45a', '#5fa83a', '#3f7f26', '#285516'], // green
  J: ['#e8a070', '#c87a45', '#a25a2e', '#7d4020', '#552a12'], // leather
  N: ['#9a9aa6', '#74747e', '#54545e', '#3c3c44', '#26262c'], // flint
  R: ['#ff9a8a', '#ff4a3a', '#d42a1e', '#9a1810', '#6a0d08'], // redstone
  W: ['#ffffff', '#fafafa', '#e6e6e6', '#c4c4c4', '#a0a0a0'], // wool, paper
  Y: ['#fff4b0', '#f4dc80', '#dcb84e', '#b08a28', '#7d5f14'], // wheat
}

// ---- painted sprites ----

const LOG = [
  '................',
  '................',
  '................',
  '...kkkkkkkkkkkk.',
  '..kttk999999999k',
  '.ktTTtk98989898k',
  '.kTtTTk88888888k',
  'ktTuTtk87888788k',
  'ktTuuTk88888888k',
  'ktTuTtk78877887k',
  '.kTtTTk88787888k',
  '.ktTTtk77877787k',
  '..kttk777777777k',
  '...kkkkkkkkkkkk.',
  '................',
  '................',
]

const PLANKS = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.k666656636666k.',
  '.k555545525555k.',
  '.k222222222222k.',
  '.k663666566656k.',
  '.k552555455545k.',
  '.k222222222222k.',
  '.k666656663666k.',
  '.k554555552555k.',
  '.k222222222222k.',
  '.k665663666566k.',
  '.k554552455545k.',
  '.k333332333333k.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

const COBBLE = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kffdcafffddcak.',
  '.kfdccadddccbak.',
  '.kdccbadccccbak.',
  '.kbbbaaabbbbaak.',
  '.kaffdddcaffdak.',
  '.kfdcccbbafdcak.',
  '.kdccbbbbadcbak.',
  '.kbbaaaaaabbaak.',
  '.kffdcaffdddcak.',
  '.kfdccadcccbbak.',
  '.kdcbbabbbbbaak.',
  '.kaaaaaaaaaaaak.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

const INGOT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kHwHHHHHLk...',
  '..kHLLLLLLLLDk..',
  '.kLMMMMMMMMMDSk.',
  '.kMMMMMMMMMMDSk.',
  '.kDDDDDDDDDDSSk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
]

const GEM = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kHwHLHLk....',
  '...kHLLHLLLMk...',
  '..kSSSSSSSSSSk..',
  '..kLMMLMMMDMDk..',
  '...kMMLMMDMDk...',
  '....kMLMDMDk....',
  '.....kMDMSk.....',
  '......kDSk......',
  '.......kk.......',
  '................',
  '................',
  '................',
]

const COAL = [
  '................',
  '................',
  '......kkkk......',
  '....kkXXqXkk....',
  '...kXqQqXXXXk...',
  '..kXqQXxXXqXXk..',
  '..kXXqXxxXQqXk..',
  '.kXxXXXxxXqXxXk.',
  '.kXXqXxXXXXxXXk.',
  '.kxXQqxXXxXXxxk.',
  '..kxXqXxxXXxxk..',
  '...kkxxxxxxkk...',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
]

const STRING = [
  '................',
  '................',
  '......zzzz......',
  '.....zssggz.....',
  '....zsz..zgz....',
  '....zsz..zgz....',
  '....zgz.zsgz....',
  '.....zgzsgz.....',
  '......zssz......',
  '.....zsgzgz.....',
  '....zsz..zgz....',
  '...zsz....zgz...',
  '..zsz......zz...',
  '..zz............',
  '................',
  '................',
]

const STICK = [
  '................',
  '................',
  '............kk..',
  '...........k65k.',
  '..........k54k..',
  '.........k54k...',
  '........k54k....',
  '.......k43k.....',
  '......k43k......',
  '.....k43k.......',
  '....k43k........',
  '...k32k.........',
  '..k21k..........',
  '..kkk...........',
  '................',
  '................',
]

const TABLE = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.k666366636663k.',
  '.k555355535553k.',
  '.k333333333333k.',
  '.k555355535553k.',
  '.k222222222222k.',
  '.k443333333344k.',
  '.k44LMD3LLLL44k.',
  '.k4435331MMM44k.',
  '.k4435331MM344k.',
  '.k443533133344k.',
  '.k443333333344k.',
  '.k222222222222k.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

const TORCH = [
  '................',
  '.......o........',
  '......oyo.......',
  '......oyyo......',
  '.....oyywyo.....',
  '.....ryyyor.....',
  '......roor......',
  '......kXXk......',
  '......k54k......',
  '......k54k......',
  '......k43k......',
  '......k43k......',
  '......k43k......',
  '......k32k......',
  '......kkkk......',
  '................',
]

const PLATE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.k666666666665k.',
  '.k555555555554k.',
  '.k333333333332k.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
  '................',
]

const SHEARS = [
  '................',
  '..kk........kk..',
  '..kHk......kHk..',
  '...kHk....kLk...',
  '...kLHk..kHMk...',
  '....kLHkkHMk....',
  '.....kLDDMk.....',
  '......kDSk......',
  '.....kpkkpk.....',
  '....kpk..kpk....',
  '...kpk....kpk...',
  '..kpppk..kpppk..',
  '..kpkPk..kpkPk..',
  '..kPPPk..kPPPk..',
  '...kkk....kkk...',
  '................',
]

const CHEST = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kD6666666666Dk.',
  '.k655555555554k.',
  '.k444444444444k.',
  '.k333333333333k.',
  '.kD1111111111Dk.',
  '.k5555kHLk5554k.',
  '.k4444kMDk4443k.',
  '.k44444kk44443k.',
  '.k444444444443k.',
  '.k333333333332k.',
  '.k333333333332k.',
  '.kD2222222222Dk.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

const FURNACE = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kffdffdfdffdck.',
  '.kfdddddddddcck.',
  '.kdccccccccccbk.',
  '.kdcknnnnnnkcbk.',
  '.kdcknnnnnnkcbk.',
  '.kdcknnronnkcbk.',
  '.kdcknroyrnkcbk.',
  '.kdckroyyorkcbk.',
  '.kdckkkkkkkkcbk.',
  '.kfdcfdccdcfcbk.',
  '.kdcccccccccbbk.',
  '.kbbbbbbbbbbbak.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

const BUCKET = [
  '................',
  '................',
  '....kkkkkkkk....',
  '...kD......Dk...',
  '..kD........Dk..',
  '.kHHHHHHHHHHHLk.',
  '.kLnnnnnnnnnnDk.',
  '..kHLLLLLLLMDk..',
  '..kHLMMMMMMMDk..',
  '...kLMMMMMMDk...',
  '...kLMMMMMDDk...',
  '...kMDDDDDDSk...',
  '....kkkkkkkk....',
  '................',
  '................',
  '................',
]

const LADDER = [
  '................',
  '..kkkk...kkkk...',
  '..k54k...k54k...',
  '..k43kkkkk43k...',
  '..k436666643k...',
  '..k43kkkkk43k...',
  '..k43k...k43k...',
  '..k43kkkkk43k...',
  '..k436666643k...',
  '..k43kkkkk43k...',
  '..k43k...k43k...',
  '..k43kkkkk43k...',
  '..k436666643k...',
  '..k32kkkkk32k...',
  '..k32k...k32k...',
  '..kkkk...kkkk...',
]

const BOW = [
  '........kkkk....',
  '......kk54ks....',
  '.....k543k.s....',
  '....k43k...s....',
  '...k43k....s....',
  '...k43k....s....',
  '..k43k.....s....',
  '..kppk.....s....',
  '..kPPk.....s....',
  '..k43k.....s....',
  '...k43k....s....',
  '...k43k....s....',
  '....k43k...s....',
  '.....k432k.s....',
  '......kk32ks....',
  '........kkkk....',
]

const BLOCK = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kHHHHHHHHHHHLk.',
  '.kHwLLLLLLLLMDk.',
  '.kHLMMMMMMMMMDk.',
  '.kHLMMMMMMLLMDk.',
  '.kHLMMMMMLLMMDk.',
  '.kHLMMMMLLMMMDk.',
  '.kHLMMMLLMMMMDk.',
  '.kHLMMLLMMMMMDk.',
  '.kHLMLLMMMMMMDk.',
  '.kHLMMMMMMMMMDk.',
  '.kLMDDDDDDDDDSk.',
  '.kMDSSSSSSSSSSk.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

// ---- shaped sprites ----

const PICKAXE = [
  '................',
  '.....MMMMMM.....',
  '...MMMMMMMMMM...',
  '..MMM.....MMMM..',
  '..MM.......MMM..',
  '..M.......##MMM.',
  '.........##..MM.',
  '........##...MM.',
  '.......##....MM.',
  '......##.....MM.',
  '.....##......MM.',
  '....##......MM..',
  '...##......MMM..',
  '..##......MMM...',
  '.##.............',
  '................',
]

const AXE = [
  '................',
  '.......MMM......',
  '......MMMMM..##.',
  '.....MMMMMMM##..',
  '....MMMMMMM##...',
  '....MMMMMM##....',
  '.....MMMM##.....',
  '......MM##......',
  '.......##.......',
  '......##........',
  '.....##.........',
  '....##..........',
  '...##...........',
  '..##............',
  '.##.............',
  '................',
]

const SHOVEL = [
  '................',
  '...........MMM..',
  '..........MMMMM.',
  '.........MMMMMM.',
  '........MMMMMMM.',
  '........MMMMMM..',
  '........MMMMM...',
  '.......##MMM....',
  '......##........',
  '.....##.........',
  '....##..........',
  '...##...........',
  '..##............',
  '.##.............',
  '................',
  '................',
]

const SWORD = [
  '................',
  '.............MM.',
  '............MMM.',
  '...........MMM..',
  '..........MMM...',
  '.........MMM....',
  '........MMM.....',
  '...A...MMM......',
  '....A.MMM.......',
  '.....AMM........',
  '....##AA........',
  '...##...A.......',
  '..##.....A......',
  '.AA.............',
  '................',
  '................',
]

const HOE = [
  '................',
  '......MMMM......',
  '......MMMMMMM...',
  '.........MMMM...',
  '..........##....',
  '.........##.....',
  '........##......',
  '.......##.......',
  '......##........',
  '.....##.........',
  '....##..........',
  '...##...........',
  '..##............',
  '.##.............',
  '................',
  '................',
]

const HELMET = [
  '................',
  '................',
  '................',
  '................',
  '...MMMMMMMMMM...',
  '..MMMMMMMMMMMM..',
  '..MMMMwMMMMMMM..',
  '..MMM......MMM..',
  '..MMM......MMM..',
  '..MM........MM..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

const CHESTPLATE = [
  '................',
  '................',
  '..MMM......MMM..',
  '.MMMMM....MMMMM.',
  '.MMMMMMMMMMMMMM.',
  '.MMMMMMMMMMMMMM.',
  '.MM.MMMMMMMM.MM.',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '................',
  '................',
  '................',
]

const LEGGINGS = [
  '................',
  '................',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '...MMMMMMMMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '...MMMM..MMMM...',
  '................',
  '................',
  '................',
]

const BOOTS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...MMM....MMM...',
  '...MMM....MMM...',
  '...MMM....MMM...',
  '...MMM....MMM...',
  '..MMMM...MMMM...',
  '.MMMMM..MMMMM...',
  '.MMMMM..MMMMM...',
  '................',
  '................',
  '................',
  '................',
]

const WHEAT = [
  '................',
  '...Y....Y....Y..',
  '..YYY..YYY..YYY.',
  '..YYY..YYY..YYY.',
  '..YYY..YYY..YYY.',
  '...Y...YYY...Y..',
  '...Y....Y....Y..',
  '....Y...Y...Y...',
  '.....Y..Y..Y....',
  '......Y.Y.Y.....',
  '.......uuu......',
  '.......YYY......',
  '......Y.Y.Y.....',
  '.....Y..Y..Y....',
  '................',
  '................',
]

const SUGARCANE = [
  '................',
  '....EE....EE....',
  '....EE....EE....',
  '....vv....EE.E..',
  '....EE....vvE...',
  '...EEE....EE....',
  '..E.EE....EE....',
  '....vv....EE....',
  '....EE....vv....',
  '....EE....EE....',
  '....EE.E..EE....',
  '....vvE...EE....',
  '....EE....vv....',
  '....EE....EE....',
  '....vv....vv....',
  '................',
]

const LEATHER = [
  '................',
  '................',
  '..JJ........JJ..',
  '..JJJJJJJJJJJJ..',
  '...JJJJJJJJJJ...',
  '...JJJuJJJJJJ...',
  '...JJJJJJJuJJ...',
  '...JJJJJJJJJJ...',
  '...JuJJJJJJJJ...',
  '...JJJJJuJJJJ...',
  '...JJJJJJJJJJ...',
  '..JJJJJJJJJJJJ..',
  '..JJ........JJ..',
  '................',
  '................',
  '................',
]

const REDSTONE = [
  '................',
  '................',
  '................',
  '................',
  '......R.........',
  '...R..RR..R.....',
  '..RRR.RR.RRR....',
  '...RRRRRRRRR.R..',
  '..RRRRRwRRRRR...',
  '.RRRRRRRRRRRRR..',
  '..RRRRRRRRRRR...',
  '...RRRRRRRRRR...',
  '.....RRRRRR.....',
  '................',
  '................',
  '................',
]

const FLINT = [
  '................',
  '................',
  '................',
  '.......NN.......',
  '......NNNN......',
  '.....NNqNNN.....',
  '....NNqNNNN.....',
  '....NNNNNNNN....',
  '...NNNNNNqNN....',
  '...NNqNNNNNNN...',
  '..NNNNNNNNNNN...',
  '..NNNNNNNNNN....',
  '...NNNNNNNN.....',
  '................',
  '................',
  '................',
]

const PAPER = [
  '................',
  '................',
  '...WWWWWWWWWW...',
  '...WWWWWWWWWW...',
  '...WggggggWWW...',
  '...WWWWWWWWWW...',
  '...WggggggggW...',
  '...WWWWWWWWWW...',
  '...WgggggWWWW...',
  '...WWWWWWWWWW...',
  '...WggggggggW...',
  '...WWWWWWWWWW...',
  '...WWWWWWWWWW...',
  '...WWWWWWWWWW...',
  '................',
  '................',
]

const BOOK = [
  '................',
  '................',
  '..JJJJJJJJJJ....',
  '..JJJJJJJJJJW...',
  '..JJeeeeeeJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '..JJJJJJJJJJW...',
  '...WWWWWWWWWW...',
  '................',
  '................',
]

const BOOKSHELF = [
  '................',
  '.##############.',
  '.##############.',
  '.#pvuqnrpvnuqp#.',
  '.#pvuqnrpvnuqp#.',
  '.#pvuqnrpvnuqp#.',
  '.#rvuqnrpvnuqr#.',
  '.##############.',
  '.##############.',
  '.#vqpnurvqpnur#.',
  '.#vqpnurvqpnur#.',
  '.#vqpnurvqpnur#.',
  '.#vqrnurvqrnur#.',
  '.##############.',
  '.##############.',
  '................',
]

const FLINT_AND_STEEL = [
  '................',
  '................',
  '..MMMMMM........',
  '.MMMMMMMM.......',
  '.MM....MM.......',
  '.MM.............',
  '.MM.............',
  '.MM....MM..NN...',
  '.MMMMMMMM.NNNN..',
  '..MMMMMM.NNNNNN.',
  '.........NNNNNN.',
  '..........NNNN..',
  '...........NN...',
  '................',
  '................',
  '................',
]

const FENCE = [
  '................',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '..############..',
  '..############..',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '..############..',
  '..############..',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '...##......##...',
  '................',
]

const DOOR = [
  '................',
  '...##########...',
  '...#fff##fff#...',
  '...#fff##fff#...',
  '...#fff##fff#...',
  '...##########...',
  '...##########...',
  '...##########...',
  '...########e#...',
  '...##########...',
  '...##########...',
  '...##########...',
  '...##########...',
  '...##########...',
  '...##########...',
  '................',
]

const BOAT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.#............#.',
  '.##nnnnnnnnnn##.',
  '.##############.',
  '..############..',
  '...##########...',
  '....########....',
  '................',
  '................',
  '................',
  '................',
]

const BOWL = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..############..',
  '..#nnnnnnnnnn#..',
  '...##########...',
  '....########....',
  '.....######.....',
  '................',
  '................',
  '................',
  '................',
  '................',
]

const RAIL = [
  '................',
  '...MM......MM...',
  '..#MM######MM#..',
  '...MM......MM...',
  '...MM......MM...',
  '..#MM######MM#..',
  '...MM......MM...',
  '...MM......MM...',
  '..#MM######MM#..',
  '...MM......MM...',
  '...MM......MM...',
  '..#MM######MM#..',
  '...MM......MM...',
  '...MM......MM...',
  '..#MM######MM#..',
  '................',
]

const COMPASS = [
  '................',
  '................',
  '.....MMMMMM.....',
  '...MMMMMMMMMM...',
  '..MMMnnnnnnMMM..',
  '..MMnnnnnnnnMM..',
  '.MMnnnnnnrnnnMM.',
  '.MMnnnnnrnnnnMM.',
  '.MMnnnnknnnnnMM.',
  '.MMnnnsnnnnnnMM.',
  '..MMnsnnnnnnMM..',
  '..MMMnnnnnnMMM..',
  '...MMMMMMMMMM...',
  '.....MMMMMM.....',
  '................',
  '................',
]

const CLOCK = [
  '................',
  '................',
  '.....MMMMMM.....',
  '...MMMMMMMMMM...',
  '..MMMssssssMMM..',
  '..MMssssssssMM..',
  '.MMssssksssssMM.',
  '.MMssssksssssMM.',
  '.MMsssskkksssMM.',
  '.MMssssssssssMM.',
  '..MMssssssssMM..',
  '..MMMssssssMMM..',
  '...MMMMMMMMMM...',
  '.....MMMMMM.....',
  '................',
  '................',
]

const REDSTONE_TORCH = [
  '................',
  '................',
  '................',
  '.......RR.......',
  '......RRRR......',
  '......RRwR......',
  '.......RR.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '.......##.......',
  '................',
  '................',
]

const JUKEBOX = [
  '................',
  '.##############.',
  '.#nnnnnnnnnnnn#.',
  '.#nnnnnnnnnnnn#.',
  '.##############.',
  '.##############.',
  '.######MM######.',
  '.#####MMMM#####.',
  '.#####MMMM#####.',
  '.######MM######.',
  '.##############.',
  '.##############.',
  '.##############.',
  '.##############.',
  '.##############.',
  '................',
]

const CAULDRON = [
  '................',
  '................',
  '.AA..........AA.',
  '.AAAAAAAAAAAAAA.',
  '.AAnnnnnnnnnnAA.',
  '.AAnnnnnnnnnnAA.',
  '.AAAAAAAAAAAAAA.',
  '.AAAAAAAAAAAAAA.',
  '.AAAAAAAAAAAAAA.',
  '.AAAAAAAAAAAAAA.',
  '..AAAAAAAAAAAA..',
  '..AA........AA..',
  '..AA........AA..',
  '................',
  '................',
  '................',
]

const MINECART = [
  '................',
  '................',
  '................',
  '................',
  '.M............M.',
  '.MM..........MM.',
  '.MMnnnnnnnnnnMM.',
  '.MMMMMMMMMMMMMM.',
  '..MMMMMMMMMMMM..',
  '..MMMMMMMMMMMM..',
  '...MMMMMMMMMM...',
  '...bb......bb...',
  '...bb......bb...',
  '................',
  '................',
  '................',
]

const SHIELD = [
  '................',
  '...MMMMMMMMMM...',
  '...M########M...',
  '...M########M...',
  '...M###MM###M...',
  '...M###MM###M...',
  '...M########M...',
  '...M########M...',
  '....M######M....',
  '.....M####M.....',
  '......MMMM......',
  '................',
  '................',
  '................',
  '................',
  '................',
]

const HAY = [
  '................',
  '.YYYYYYYYYYYYYY.',
  '.YYeYYYYeYYYeYY.',
  '.YYYYeYYYYeYYYY.',
  '.uuuuuuuuuuuuuu.',
  '.uuuuuuuuuuuuuu.',
  '.YYeYYYYYeYYYYY.',
  '.YYYYYeYYYYYeYY.',
  '.YeYYYYYeYYYYYY.',
  '.YYYYeYYYYYeYYY.',
  '.uuuuuuuuuuuuuu.',
  '.uuuuuuuuuuuuuu.',
  '.YYYeYYYYeYYYeY.',
  '.YYYYYYYYYYYYYY.',
  '.YYYYYYYYYYYYYY.',
  '................',
]

const BREAD = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......BBBBB.....',
  '....BBBBBBBBB...',
  '...BB6BB6BB6BB..',
  '..BBB6BB6BB6BBB.',
  '..BBBBBBBBBBBBB.',
  '..BBBBBBBBBBBBB.',
  '...BBBBBBBBBBB..',
  '.....BBBBBBB....',
  '................',
  '................',
  '................',
]

const WOOL = [
  '................',
  '.WWWWWWWWWWWWWW.',
  '.WWWgWWWWWWgWWW.',
  '.WWWWWWgWWWWWWW.',
  '.WgWWWWWWWWWgWW.',
  '.WWWWWgWWWWWWWW.',
  '.WWWWWWWWgWWWWW.',
  '.WWgWWWWWWWWWgW.',
  '.WWWWWWgWWWWWWW.',
  '.WWWWWWWWWWgWWW.',
  '.WgWWWWWWWWWWWW.',
  '.WWWWWgWWWWgWWW.',
  '.WWWWWWWWWWWWWW.',
  '.WWWgWWWWWWWWgW.',
  '.WWWWWWWWWWWWWW.',
  '................',
]

const BUTTON = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....MMMMMM.....',
  '.....MMMMMM.....',
  '.....MMMMMM.....',
  '.....MMMMMM.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

const SLAB = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..MMMMMMMMMMMM..',
  '.MMMMMMMMMMMMMM.',
  '.MMMMMMMMMMMMMM.',
  '................',
  '................',
  '................',
  '................',
]

const SUGAR = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......W.........',
  '....W.WW..W.....',
  '...WWWWWW.WW....',
  '..WWWWWWWWWW....',
  '.WWWWWWWWWWWW...',
  '..WWWWWWWWWW....',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export type Sprite = { rows: readonly string[]; material?: Material; isShaped?: boolean }

const painted = (rows: readonly string[], material?: Material): Sprite => ({ rows, material })
const shaped = (rows: readonly string[], material?: Material): Sprite => ({ rows, material, isShaped: true })

export const SPRITES: Record<string, Sprite> = {
  log: painted(LOG),
  planks: painted(PLANKS),
  cobble: painted(COBBLE),
  iron: painted(INGOT, 'iron'),
  gold: painted(INGOT, 'gold'),
  diamond: painted(GEM, 'diamond'),
  coal: painted(COAL),
  string: painted(STRING),
  stick: painted(STICK),
  wheat: shaped(WHEAT),
  sugarcane: shaped(SUGARCANE),
  leather: shaped(LEATHER),
  redstone: shaped(REDSTONE),
  flint: shaped(FLINT),
  table: painted(TABLE),
  torch: painted(TORCH),
  plate: painted(PLATE),
  shears: painted(SHEARS, 'iron'),
  chest: painted(CHEST, 'iron'),
  furnace: painted(FURNACE),
  bucket: painted(BUCKET, 'iron'),
  ladder: painted(LADDER),
  bow: painted(BOW),
  paper: shaped(PAPER),
  book: shaped(BOOK),
  bookshelf: shaped(BOOKSHELF),
  flint_and_steel: shaped(FLINT_AND_STEEL, 'iron'),
  fence: shaped(FENCE),
  door: shaped(DOOR),
  boat: shaped(BOAT),
  bowl: shaped(BOWL),
  rail: shaped(RAIL, 'iron'),
  compass: shaped(COMPASS, 'iron'),
  clock: shaped(CLOCK, 'gold'),
  redstone_torch: shaped(REDSTONE_TORCH),
  jukebox: shaped(JUKEBOX, 'diamond'),
  cauldron: shaped(CAULDRON),
  minecart: shaped(MINECART, 'iron'),
  shield: shaped(SHIELD, 'iron'),
  hay: shaped(HAY),
  bread: shaped(BREAD),
  wool: shaped(WOOL),
  button_wood: shaped(BUTTON, 'wood'),
  button_stone: shaped(BUTTON, 'stone'),
  plate_stone: shaped(SLAB, 'stone'),
  sugar: shaped(SUGAR),
  block_iron: painted(BLOCK, 'iron'),
  block_gold: painted(BLOCK, 'gold'),
  block_diamond: painted(BLOCK, 'diamond'),
}

for (const material of Object.keys(MATERIAL) as Material[]) {
  SPRITES[`pickaxe_${material}`] = shaped(PICKAXE, material)
  SPRITES[`axe_${material}`] = shaped(AXE, material)
  SPRITES[`shovel_${material}`] = shaped(SHOVEL, material)
  SPRITES[`hoe_${material}`] = shaped(HOE, material)
  SPRITES[`sword_${material}`] = shaped(SWORD, material)
}
for (const material of ['iron', 'gold', 'diamond'] as const) {
  SPRITES[`helmet_${material}`] = shaped(HELMET, material)
  SPRITES[`chestplate_${material}`] = shaped(CHESTPLATE, material)
  SPRITES[`leggings_${material}`] = shaped(LEGGINGS, material)
  SPRITES[`boots_${material}`] = shaped(BOOTS, material)
}

function rampOf(sprite: Sprite, region: string): Ramp | undefined {
  if (region === 'M') return MATERIAL[sprite.material ?? 'iron']
  return REGIONS[region]
}

const isRegion = (char: string) => char === '#' || (char >= 'A' && char <= 'Z')

// Every pixel's colour, `undefined` where the sprite is clear.
function colours(sprite: Sprite): (string | undefined)[][] {
  const rows = sprite.rows
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.'
  if (!sprite.isShaped) {
    return rows.map(row =>
      [...row].map(char => {
        if (char === '.') return undefined
        if (char in RAMP_INDEX) return MATERIAL[sprite.material ?? 'iron'][RAMP_INDEX[char]!]
        return PALETTE[char]
      }),
    )
  }
  return rows.map((row, y) =>
    [...row].map((char, x) => {
      if (char === '.') {
        const touches = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some(near => near !== '.')
        return touches ? PALETTE.k : undefined
      }
      if (!isRegion(char)) return PALETTE[char]
      const ramp = rampOf(sprite, char)
      if (!ramp) return undefined
      const lit = Number(at(x - 1, y) !== char) + Number(at(x, y - 1) !== char)
      const dark = Number(at(x + 1, y) !== char) + Number(at(x, y + 1) !== char)
      if (lit === 2 && dark < 2) return ramp[0]
      if (lit >= 1 && dark === 0) return ramp[1]
      if (dark === 2 && lit === 0) return ramp[4]
      if (dark >= 1 && lit === 0) return ramp[3]
      if (lit >= 1) return ramp[1]
      return ramp[2]
    }),
  )
}

const pathCache = new Map<string, string>()
const shadowCache = new Map<string, string>()

// One stroked path per colour: each row's runs of it as one-pixel lines.
function paths(grid: (string | undefined)[][], stroke?: string) {
  const byColour = new Map<string, string>()
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const colour = row[x]
      let end = x + 1
      while (end < row.length && row[end] === colour) end++
      if (colour !== undefined) {
        const key = stroke ?? colour
        byColour.set(key, (byColour.get(key) ?? '') + `M${x} ${y}.5h${end - x}`)
      }
      x = end
    }
  })
  return [...byColour].map(([colour, d]) => `<path stroke='${colour}' d='${d}'/>`).join('')
}

// The sprite as paths in a 16 by 16 space.
export function spritePaths(id: string) {
  const cached = pathCache.get(id)
  if (cached !== undefined) return cached
  const sprite = SPRITES[id]
  const out = sprite ? paths(colours(sprite)) : ''
  pathCache.set(id, out)
  return out
}

// The sprite's silhouette, for its shadow.
function shadowPaths(id: string) {
  const cached = shadowCache.get(id)
  if (cached !== undefined) return cached
  const sprite = SPRITES[id]
  const out = sprite ? paths(colours(sprite), '#000') : ''
  shadowCache.set(id, out)
  return out
}

const tintCache = new Map<string, string>()

// The colour a surface without pictures draws the item in: its most used one.
export function tintOf(id: string) {
  const cached = tintCache.get(id)
  if (cached) return cached
  const sprite = SPRITES[id]
  if (!sprite) return '#888888'
  const counts = new Map<string, number>()
  for (const row of colours(sprite)) {
    for (const colour of row) {
      if (colour === undefined || colour === PALETTE.k) continue
      counts.set(colour, (counts.get(colour) ?? 0) + 1)
    }
  }
  let best = '#888888'
  let most = 0
  for (const [colour, count] of counts) {
    if (count > most) [best, most] = [colour, count]
  }
  tintCache.set(id, best)
  return best
}

// The board's colours: a light stone panel with sunken slots, lit from the
// top left, and the accent of a hovered button.
export const UI = {
  panel: '#c9c5bc',
  panelLight: '#f6f3ec',
  panelDark: '#7a766d',
  outline: '#1f1d1a',
  slot: '#8d897f',
  slotHover: '#b3afa5',
  slotPressed: '#6c685f',
  slotShade: '#3d3a34',
  slotLight: '#f6f3ec',
  ink: '#3d3a34',
  gold: '#ffd23f',
  green: '#7ed957',
  red: '#ff5a3c',
  button: '#a29e95',
  buttonLight: '#e2ded5',
  buttonDark: '#55524b',
  buttonHover: '#e08a4a',
  buttonHoverLight: '#ffc08a',
  buttonHoverDark: '#8a4a1c',
  tip: '#17141f',
  tipEdge: '#c9862b',
} as const

export type SlotLook = {
  item?: string | null
  count?: number
  isHovered?: boolean
  // Drawn pressed in, for the demo's clicks.
  isPressed?: boolean
  isResult?: boolean
  // Left without the item's shadow, for a drawing that must stay small.
  lite?: boolean
  // Left without its frame as well: whatever holds it draws the square.
  bare?: boolean
}

const OPEN = (w: number, h: number, vw: number, vh: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${vw} ${vh}' shape-rendering='crispEdges'>`

// One slot: a square sunk into the panel, dark along its top and left edge
// and lit along the others, the item in it and, past one, its count in the
// corner. `size` is its width and height in pixels; the slot is 18 units.
export function slotSvg(look: SlotLook, size: number) {
  let svg = OPEN(size, size, 18, 18)
  if (!look.bare) {
    svg +=
      `<rect width='18' height='18' fill='${UI.slotLight}'/><rect width='17' height='17' fill='${UI.slotShade}'/>` +
      `<rect x='1' y='1' width='16' height='16' fill='${look.isPressed ? UI.slotPressed : look.isHovered ? UI.slotHover : UI.slot}'/>`
    if (look.isResult) svg += `<path fill='none' stroke='${UI.gold}' stroke-opacity='0.55' d='M0.5 0.5h17v17h-17z'/>`
  }
  if (look.item) svg += itemLayer(look.item, 1, look.lite)
  if (look.count !== undefined && look.count > 1) svg += countPaths(look.count, 18)
  return svg + '</svg>'
}

// An item as a chip of its colour and its count, for a drawing that must
// stay small.
export function chipSvg(item: string, count: number, size: number) {
  return OPEN(size, size, 18, 18) + `<rect x='4' y='4' width='10' height='10' fill='${tintOf(item)}' stroke='${UI.outline}'/>` + (count > 1 ? countPaths(count, 18) : '') + '</svg>'
}

// A mouse pointer, its tip at the top left, for the demo's bot.
const POINTER = [
  'k.........',
  'kk........',
  'kwk.......',
  'kwwk......',
  'kwwwk.....',
  'kwwwwk....',
  'kwwwwwk...',
  'kwwwwwwk..',
  'kwwwwwwwk.',
  'kwwwwkkkkk',
  'kwwkwk....',
  'kwk.kwk...',
  'kk..kwk...',
  'k....kwk..',
  '.....kwk..',
  '......k...',
]

export function pointerSvg(scale: number) {
  const grid = POINTER.map(row => [...row].map(char => (char === 'k' ? '#111111' : char === 'w' ? '#ffffff' : undefined)))
  return OPEN(10 * scale, 16 * scale, 10, 16) + paths(grid) + '</svg>'
}

// An item alone, for the one the pointer carries.
export function heldSvg(item: string, count: number, size: number) {
  return OPEN(size, size, 18, 18) + itemLayer(item, 1) + (count > 1 ? countPaths(count, 18) : '') + '</svg>'
}

function itemLayer(item: string, at: number, lite = false) {
  const shadow = lite ? '' : `<g transform='translate(${at + 1} ${at + 1})' opacity='0.35'>${shadowPaths(item)}</g>`
  return shadow + `<g transform='translate(${at} ${at})'>${spritePaths(item)}</g>`
}

// The count in the slot's bottom right corner, white with a dark shadow.
function countPaths(count: number, box: number) {
  const text = String(count)
  const x = box - textWidth(text) - 1
  const y = box - 8
  return `<path stroke='#3f3f3f' d='${textPath(text, x + 1, y + 1)}'/><path stroke='#ffffff' d='${textPath(text, x, y)}'/>`
}

// The arrow between the grid and its result.
export function arrowSvg(size: number) {
  return (
    OPEN(size, size, 18, 18) +
    `<path fill='${UI.panelDark}' d='M2 8h9v3h-9zM11 5h1v9h-1zM12 6h1v7h-1zM13 7h1v5h-1zM14 8h1v3h-1zM15 9h1v1h-1z'/></svg>`
  )
}

// The round's clock: a dark track and the time left as a bar of pixel
// segments. Stretched to its box, so `width` only sets the shape; the seconds
// are drawn over it on their own.
export function timerSvg(leftMs: number, totalMs: number, width: number) {
  const units = Math.max(40, Math.round(width / 2))
  const share = Math.max(0, Math.min(1, leftMs / totalMs))
  const filled = Math.round((units - 2) * share)
  const color = leftMs <= 10_000 ? UI.red : UI.green
  let segments = ''
  for (let x = 10; x < 1 + filled; x += 10) segments += `M${x} 1h1v7h-1z`
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${units * 2}' height='18' viewBox='0 0 ${units} 9' preserveAspectRatio='none' shape-rendering='crispEdges'>` +
    `<rect width='${units}' height='9' fill='${UI.outline}'/>` +
    `<rect x='1' y='1' width='${filled}' height='7' fill='${color}'/>` +
    `<rect x='1' y='1' width='${filled}' height='2' fill='#ffffff' fill-opacity='0.35'/>` +
    (segments ? `<path fill='#000000' fill-opacity='0.3' d='${segments}'/>` : '') +
    '</svg>'
  )
}

// A name card: dark, edged, the text white with its shadow.
export function tipSvg(text: string, scale: number) {
  const width = textWidth(text) + 8
  const height = 13
  return {
    width: width * scale,
    height: height * scale,
    source:
      OPEN(width * scale, height * scale, width, height) +
      `<rect width='${width}' height='${height}' fill='${UI.tip}'/>` +
      `<path fill='none' stroke='${UI.tipEdge}' d='M1.5 1.5h${width - 3}v${height - 3}h-${width - 3}z'/>` +
      `<path stroke='#3f3f3f' d='${textPath(text, 5, 4)}'/><path stroke='#ffffff' d='${textPath(text, 4, 3)}'/></svg>`,
  }
}

export type BookEntry = {
  shape: readonly (string | null)[][]
  output: string
  count: number
  label: string
  points: string
}

// The recipe book on its own panel: every recipe of the mode as its pattern,
// an arrow and what it makes, its name and points beneath, two to a row, the
// words in the pixel font. It
// comes as strips of a few rows, each a picture of its own that stays well
// inside what one picture may hold; drawn one under the other they join.
// Each item, a slot and a grid cell are drawn once a strip and placed by
// reference.
export function bookSvgs(entries: readonly BookEntry[], width: number): string[] {
  const scale = 2
  const units = Math.floor(width / scale)
  const cell = 9
  const columns = units >= 200 ? 2 : 1
  const colWidth = Math.floor((units - 4) / columns)
  const rowHeight = cell * 3 + 14
  const rows = Math.ceil(entries.length / columns)
  const ROWS_PER_STRIP = 5
  const strips: string[] = []
  for (let first = 0; first < rows; first += ROWS_PER_STRIP) {
    const count = Math.min(ROWS_PER_STRIP, rows - first)
    const isFirst = first === 0
    const isLast = first + count >= rows
    const top = isFirst ? 4 : 0
    const height = count * rowHeight + top + (isLast ? 4 : 0)
    const shown = entries.slice(first * columns, (first + count) * columns)
    const used = new Set<string>()
    for (const entry of shown) {
      used.add(entry.output)
      for (const row of entry.shape) for (const item of row) if (item) used.add(item)
    }
    let svg = OPEN(units * scale, height * scale, units, height) + '<defs>'
    svg +=
      `<symbol id='c' viewBox='0 0 ${cell} ${cell}'><rect width='${cell}' height='${cell}' fill='${UI.slotLight}'/>` +
      `<rect width='${cell - 1}' height='${cell - 1}' fill='${UI.slotShade}'/><rect x='1' y='1' width='${cell - 2}' height='${cell - 2}' fill='${UI.slot}'/></symbol>` +
      `<symbol id='o' viewBox='0 0 18 18'><rect width='18' height='18' fill='${UI.slotLight}'/>` +
      `<rect width='17' height='17' fill='${UI.slotShade}'/><rect x='1' y='1' width='16' height='16' fill='${UI.slot}'/></symbol>`
    for (const id of used) svg += `<symbol id='${id}' viewBox='0 0 16 16'>${spritePaths(id)}</symbol>`
    svg += '</defs>'
    // The panel, its edges where the book begins, ends and at either side.
    svg += `<rect width='${units}' height='${height}' fill='${UI.panel}'/>`
    svg += `<rect width='1' height='${height}' fill='${UI.outline}'/><rect x='1' width='1' height='${height}' fill='${UI.panelLight}'/>`
    svg += `<rect x='${units - 1}' width='1' height='${height}' fill='${UI.outline}'/><rect x='${units - 2}' width='1' height='${height}' fill='${UI.panelDark}'/>`
    if (isFirst) svg += `<rect width='${units}' height='1' fill='${UI.outline}'/><rect x='1' y='1' width='${units - 3}' height='1' fill='${UI.panelLight}'/>`
    if (isLast) {
      svg += `<rect y='${height - 1}' width='${units}' height='1' fill='${UI.outline}'/><rect x='2' y='${height - 2}' width='${units - 3}' height='1' fill='${UI.panelDark}'/>`
    }
    let words = ''
    let points = ''
    shown.forEach((entry, index) => {
      const x0 = (index % columns) * colWidth + 4
      const y0 = Math.floor(index / columns) * rowHeight + top
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const x = x0 + c * cell
          const y = y0 + r * cell
          svg += `<use href='#c' x='${x}' y='${y}' width='${cell}' height='${cell}'/>`
          const item = entry.shape[r]?.[c]
          if (item) svg += `<use href='#${item}' x='${x + 0.5}' y='${y + 0.5}' width='${cell - 1}' height='${cell - 1}'/>`
        }
      }
      const ax = x0 + cell * 3 + 2
      const mid = y0 + Math.floor((cell * 3) / 2)
      svg += `<path fill='${UI.panelDark}' d='M${ax} ${mid - 1}h5v3h-5zM${ax + 5} ${mid - 3}h1v7h-1zM${ax + 6} ${mid - 2}h1v5h-1zM${ax + 7} ${mid - 1}h1v3h-1z'/>`
      const ox = ax + 10
      svg += `<use href='#o' x='${ox}' y='${mid - 8}' width='18' height='18'/><use href='#${entry.output}' x='${ox + 1}' y='${mid - 7}' width='16' height='16'/>`
      if (entry.count > 1) svg += `<g transform='translate(${ox} ${mid - 8})'>${countPaths(entry.count, 18)}</g>`
      const ty = y0 + cell * 3 + 3
      words += textPath(entry.label, x0, ty)
      points += textPath(entry.points, x0 + textWidth(entry.label) + 4, ty)
    })
    svg += `<path stroke='${UI.ink}' d='${words}'/><path stroke='#8a5a06' d='${points}'/>`
    strips.push(svg + '</svg>')
  }
  return strips
}
