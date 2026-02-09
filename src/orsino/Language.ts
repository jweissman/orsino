import Words from "./tui/Words";
// import Files from "./util/Files";
import importedLanguages from "../../settings/fantasy/languages.json";
import { never } from "./util/never";

const concepts = [
  'earth', 'sky',

  'mountain', 'hill', 'valley', 'peak', 'mound', 'point', 'mountain-chain',
  'crest', 'fall', 'ridge', 'pass',

  'island', 'isle',

  'sea', 'lake', 'bay', 'pool', 'harbor', 'shore', 'port', 'beach', 'wave',

  'forest', 'grove', 'glade',
  'cave',
  'marsh', 'swamp', 'fen', 'gyre',
  'desert',
  'jungle', 'volcano', 'plains',

  'edge',
  'vale', 'field', 'mead',
  'river', 'glen', 'stream', 'mere', 'mouth', 'cross', 'bridge', 'dale', 'ford', 'brook',
  // barrow, downs, gulch ...

  'town', 'borough', 'village', 'stead', 'hold', 'view', 'keep', 'watch', 'rest', 'run', 'fast',

  'land', 'place', 'realm', 'region',
  'peoples', 'kingdom',
  'road', 'path',
  'haven', 'fortress', 'prison', 'citadel', 'stronghold', 'tower', 'garden',
  // modifiers..
  'ever-', '-less', 'at-',
  // masculine/feminine suffices
  '-person', '-man', '-son', '-woman', '-maid', '-daughter',
  // relations
  'friend', 'foe', 'lord', 'slave', 'king', 'queen', 'prince', 'princess',

  // ...aspects...
  'light', 'dark',
  'shadow', 'shade',
  'sun', 'moon', 'stars',
  'day', 'night', 'spark', 'starlight', 'firmament',
  // weather
  'heat', 'cold', 'wet', 'dry',
  'mist', 'snow', 'wind', 'rain', 'cloud', //'hail',
  'rainbow', 'dew', 'frost',
  // metals...
  'tin', 'iron', 'silver', 'gold',
  // materials
  'stone', 'wood', 'pearl', 'shell',
  // 'bone',
  // weapons
  // 'axe', 'sword', 'bow', 'shield',

  // cut, delve, hew, till, hunt...?

  // shades, hues...
  'white', 'black', 'gray', 'red', 'blue', 'green', 'orange',
  // ...animals,
  'dragons', 'elephants',
  'bears', 'birds', 'horses', 'snakes', 'wolves',
  'moles',
  // mole...

  // tame animals..
  // 'boars',
  'hounds',

  // birds in particular...
  'swans', 'eagles', 'nightingales', 'swallows',
  // swallow

  // ...elements,
  'ice', 'fire', 'earth', 'water',

  // quasi-elements...
  'embers', 'steam', 'magma', 'radiance',
  'soot', 'ash', 'salt', 'void', 'smoke',

  // ...times of day
  'morning', 'evening', 'dusk', 'noon', 'afternoon', 'midnight',
  // trees
  'willow', 'pine', 'cherry', 'oak', 'spruce', 'birch', 'elm', 'holly', 'fern',
  'palm', 'acorn',
  // flowers
  'rose', 'daisy', 'poppy', 'dandelion', 'lily',
  // foliage
  'tree', 'bark', 'leaf', 'root', 'bush', 'thorn', 'flower', 'moss',
  'vine', 'grass',
  // jasmine/jessamine, violet
  // lotus

  // seasons
  'autumn', 'winter', 'spring', 'summer',
  // moods
  'dread', 'horror', 'awe', 'joy', 'sorrow', 'gloom',
  // food
  'apple', 'honey', 'bread', 'elderberry', 'wine', 'fish',


  // natural substances..
  'wax',

  // 'nut',

  // instruments..?
  'harp',
  // lute, harp, viol ...

  // adjectives...
  'tall', 'deep', 'lofty', 'lonely', 'high',
  'great', 'large', 'small', 'tiny',
  'narrow', 'wide', 'sharp', 'giant',
  'quick', 'pale', 'bitter', 'wild',
  'golden', 'holy', 'fortunate', 'dusty', 'beautiful',
  'fell', 'cloudy', 'secret', 'sweet', 'bold',
  'splendid', 'abundant', 'sparkling',

  // animal aspects...
  'horns', 'fangs', 'claws', 'wings',

  // body parts...
  'hand', 'foot', 'head', 'eye', 'ear', 'heart',

  // gemstones...
  // 'emerald', 'ruby',

  // more abstract things...
  'love', 'dream',
  'song', 'music', 'silence',

  'divine',

  'fate', 'thought', 'speech', 'skill',
  'tomorrow',

  'spirit',
  'tyranny', 'freedom',

  'magic',

  // bodily substances
  'blood', 'tears',

  // activities?
  'laughter',

  // created things...
  'jewel', 'ship', 'needle', 'bell', 'candle',

  // clothes
  'mantle', 'veil', // 'garment'

  // architectural features
  'arch', 'spire', 'gate', 'pillar', 'fountain',


  // questing...
  'journey', 'treasure', 'battle', 'smith',

  // names for the languages themselves? races?
  // 'dwarves', // dwarrow, khazad,
  // 'dwarvish', // dwarvish, khuzdul...
  // 'elves', // aelves,
  // 'elvish', // aelvish, sindarin,
  // 'men', // men
  // 'mannish', // westron, ...

  // 'peoples',
  // 'common',
  // men (ylde/glishmen/...), dwarrow (dwarven/khuzdul...), aeldar (aelves/quenya...), maiar, valar,

  'star',

  'rock', 'sand',
  'hollow', 'damp',
  'ember',


  'any',

  'spray',


] as const;

// type ConceptKind = "color" | "animal" | "element" | "nature" | "place" | "object" | "abstract" | "modifier" | "adjective" | "timeOfDay" | "bodyPart" | "animalPart" | "tree" | "season" | "mood" | "food" | "architecture" | "instrument";

export const conceptKinds = [
  "color", "animal", "element", "nature", "place", "object", "abstract", "modifier", "adjective", "timeOfDay", "bodyPart", "animalPart", "tree", "season", "mood", "food", "architecture", "instrument"
] as const;

export type ConceptKind = typeof conceptKinds[number];

export type ConceptTemplate = 'personalName' | 'nobleHouse';

export class Conceptory {
  static conceptKinds: { [key in ConceptKind]: Concept[] } = {
    color: [
      'white', 'black', 'gray', 'red', 'blue', 'green', 'orange',
      // "_color": "=oneOf(crimson, sable, golden, argent, azure, emerald, violet, ivory, onyx, amber, cerulean)",
    ],
    animal: ['dragons', 'elephants', 'bears', 'birds', 'horses', 'snakes', 'wolves', 'hounds', 'swans', 'eagles', 'nightingales', 'swallows', 'moles'],
    element: ['ice', 'fire', 'earth', 'water', 'embers', 'steam', 'magma', 'radiance', 'soot', 'ash', 'salt', 'void', 'smoke'],
    nature: ['forest', 'grove', 'glade', 'cave', 'marsh', 'swamp', 'fen', 'gyre', 'desert', 'river', 'glen', 'stream', 'mere', 'mountain', 'hill', 'valley', 'peak', 'mound', 'point', 'mountain-chain', 'crest', 'fall', 'ridge', 'pass', 'island', 'isle', 'sea', 'lake', 'bay', 'pool', 'harbor', 'shore', 'port', 'beach', 'wave', 'tree', 'bark', 'leaf', 'root', 'bush', 'thorn', 'flower', 'moss', 'vine', 'grass'],
    place: ['town', 'borough', 'village', 'stead', 'hold', 'view', 'keep', 'watch', 'rest', 'run', 'land', 'place', 'realm', 'region', 'road', 'path', 'haven', 'fortress', 'prison', 'citadel', 'stronghold', 'garden'],
    object: ['jewel', 'ship', 'needle', 'bell', 'candle', 'mantle', 'veil', 'fountain'],
    abstract: ['love', 'dream', 'song', 'music', 'silence', 'divine', 'fate', 'thought', 'speech', 'skill', 'tomorrow', 'spirit', 'tyranny', 'freedom', 'magic'],
    modifier: ['ever-', '-less', 'at-', '-person', '-man', '-son', '-woman', '-maid', '-daughter'],
    adjective: ['tall', 'deep', 'lofty', 'lonely', 'high', 'great', 'large', 'small', 'tiny', 'narrow', 'wide', 'sharp', 'giant', 'quick', 'pale', 'bitter', 'golden', 'holy', 'fortunate', 'dusty', 'beautiful', 'fell', 'cloudy', 'secret', 'sweet', 'bold', 'splendid', 'abundant', 'sparkling'],
    timeOfDay: ['morning', 'evening', 'dusk', 'noon', 'afternoon', 'midnight'],
    bodyPart: ['hand', 'foot', 'head', 'eye', 'ear', 'heart'],
    animalPart: ['horns', 'fangs', 'claws', 'wings'],
    tree: ['willow', 'pine', 'cherry', 'oak', 'spruce', 'birch', 'elm', 'holly', 'fern', 'palm', 'acorn'],
    season: ['autumn', 'winter', 'spring', 'summer'],
    mood: ['dread', 'horror', 'awe', 'joy', 'sorrow', 'gloom'],
    food: ['apple', 'honey', 'bread', 'elderberry', 'wine', 'fish'],
    architecture: ['arch', 'spire', 'gate', 'pillar', 'fountain', 'tower'],
    instrument: ['harp'],
  }

  static getConceptsByKind(kind: ConceptKind): Concept[] {
    return this.conceptKinds[kind];
  }

  static assemble(...kinds: ConceptKind[]): Concept[] {
    let results: Concept[] = [];
    for (const kind of kinds) {
      const choices = this.getConceptsByKind(kind);
      const pick = choices[Math.floor(Math.random() * choices.length)];
      results = results.concat(pick)
    }
    return results;
  }

  static personalNameTemplates: { [key: string]: ConceptKind[] } = {
    'adjectivePart': ['adjective', 'bodyPart'],
    'colorPart': ['color', 'bodyPart'],
    'elementAbstract': ['element', 'abstract'],
    'adjectiveAbstract': ['adjective', 'abstract'],
    'adjectiveElement': ['adjective', 'element'],
  }

  // static nobleHouseTemplates: { [key: string]: ConceptKind[] }= {
  //   'simpleObject': ['color', 'object'],
  //   // 'natural': ['color', 'nature'],
  //   'animal': ['color', 'animal'],
  //   'elemental': ['color', 'element'],
  //   'tree': ['color', 'tree'],
  //   'architecture': ['color', 'architecture'],
  //   'instrument': ['color', 'instrument'],
  // }

  private static generateFromTemplate(templateKey: string, templateSet: { [key: string]: ConceptKind[] }): Concept[] {
    const template = templateSet[templateKey];
    if (!template) {
      throw new Error(`Template "${templateKey}" not found.`);
    }
    return this.assemble(...template);
  }

  static generate(conceptTemplate: ConceptTemplate): Concept[] {
    let templateSet: { [key: string]: ConceptKind[] } = {};
    if (conceptTemplate === 'personalName') {
      // pick a random personal name template
      // templateKeys = Object.keys(this.personalNameTemplates);
      // return this.generatePersonalName(randomKey);
      templateSet = this.personalNameTemplates;
    } else if (conceptTemplate === 'nobleHouse') {
      // templateKeys = Object.keys(this.nobleHouseTemplates);
      templateSet = this.nobleHouseTemplates;
    } else {
      return never(conceptTemplate);
    }
    const templateKeys = Object.keys(templateSet);
    const randomKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];

    return this.generateFromTemplate(randomKey, templateSet);
  }
}

export type Concept = typeof concepts[number];

type Language = {
  key?: string;
  name: string;
  family: string;
  description: string;
  vocabulary: { [key in Concept]: string };
  replacements?: { [key: string]: string };
}

class Dictionary {
  private vocabulary: { [key: string]: string };
  private replacements: { [key: string]: string } = {};

  constructor(
    public name: string,
    vocabulary: { [key: string]: string },
    replacements: { [key: string]: string } = {}
  ) {
    this.vocabulary = vocabulary;
    this.replacements = replacements;
  }

  translateDirect(...concepts: Concept[]): string {
    concepts = concepts.flat();
    // console.log(`Dictionary.translateDirect(): concepts=`, concepts);
    let translation = concepts.reduce((acc, concept) => {
      if (!(concept in this.vocabulary)) {
        throw new Error(`Concept "${concept}" not found in language "${this.name}"`);
      }

      return acc + (this.vocabulary[concept]);
    }, '');
    translation = translation
      // replace * and -
      .replace(/\*/g, '')
      .replace(/-/g, '')
      .replace(/  +/g, ' ')
      .trim();
    // return Words.capitalize(translation);
    return translation;
  }

  translate(...concepts: Concept[]): string {
    return this.standardize(
      this.translateDirect(...concepts)
    ).split(' ').map(Words.capitalize).join(' ');
  }

  missingConcepts(): Concept[] {
    const missing: Concept[] = [];
    for (const concept of concepts) {
      if (!(concept in this.vocabulary)) {
        missing.push(concept);
      }
    }
    return missing;
  }

  private standardize(name: string): string {
    if (this.replacements) {
      for (const [key, value] of Object.entries(this.replacements)) {
        const regex = new RegExp(key, 'g');
        name = name.replace(regex, value);
      }
    }
    return name;
  }
}

export default class LanguageManager {
  languages: { [key: string]: Language } = {};
  defaultLanguage: string = "westron"; // common tongue

  constructor() {
    this.loadLanguages();
  }

  loadLanguages() {
    const languages: { [key: string]: Language } = importedLanguages;
    // await Files.readJSON("./settings/fantasy/languages.json");

    // console.log(`Loaded ${Object.keys(languages).length} languages.`);

    for (const key of Object.keys(languages)) {
      this.registerLanguage(key, languages[key]);
    }
  }

  registerLanguage(key: string, lang: Language) {
    // console.log(`Registering language: ${key} (${lang.name})`);
    this.languages[key] = lang;
  }

  getDictionary(key: string): Dictionary {
    if (!(key in this.languages)) {
      console.warn(`Language "${key}" not found. Falling back to default language "${this.defaultLanguage}".`);
      key = this.defaultLanguage;
    }
    const lang = this.languages[key];
    return new Dictionary(lang.name, lang.vocabulary, lang.replacements);
  }

  get availableLanguages(): Language[] {
    return Object.values(this.languages);
  }

  static _instance: LanguageManager;
  static get instance(): LanguageManager {
    if (!LanguageManager._instance) {
      LanguageManager._instance = new LanguageManager();
    }
    return LanguageManager._instance;
  }
}

/// Corrupts words by applying a series of phonological transformations, simulating natural language evolution and variation.

// Phonology: Define the sound system of the language, including vowels, consonants, and phonotactic rules.
class Phonology {
  static vowels = 'aeiouyáéíóúàèìòùâêîôûäëïöüāēīōūȳạẹịọụōæë';
  static vowelClass = `[${Phonology.vowels}]`;
  static consonantClass = `[^${Phonology.vowels}]`; // only safe if you also gate with [a-z...]

  static isVowel = (c: string) => Phonology.vowels.includes(c.toLowerCase());
  static isConsonant = (c: string) => !Phonology.isVowel(c) && !(c === ' '); // treat space as neutral
}

class Sonority {
  // lower = “weaker/easier to delete”
  static score(ch: string): number {
    const c = ch.toLowerCase();
    const map: Record<string, number> = {
      'h': 0, 'y': 1, 'w': 1,
      'r': 2, 'l': 2,
      'n': 3, 'm': 3,
      's': 4,
      // protected digraph placeholders: treat as fairly “strong”
      'Þ': 5, 'Ġ': 5, 'Ҡ': 5, 'Š': 5, 'Č': 5, 'Ф': 5, 'Ð': 5, 'Ꚏ': 5, 'Ɋ': 5,
    };
    return map[c] ?? 6; // stops/plosives default “strong”
  }

  static pickDeletionIndex(run: string): number {
    let best = Math.floor(run.length / 2);
    let bestScore = 999;
    for (let i = 0; i < run.length; i++) {
      const sc = Sonority.score(run[i]);
      if (sc < bestScore) { bestScore = sc; best = i; }
    }
    return best;
  }
}

class MorphemeGuard {
  static commonStartsRaw = ['br', 'st', 'sp', 'sk', 'ph', 'th', 'dr', 'tr', 'gr', 'kr', 'kh', 'gh', 'sh', 'ch'];
  static commonStarts = MorphemeGuard.commonStartsRaw.map(x => DigraphGuard.protect(x).toLowerCase());

  static looksLikeSeam(protectedWord: string, index: number): boolean {
    const look = protectedWord.slice(index + 1, index + 4).toLowerCase();
    return this.commonStarts.some(st => look.startsWith(st));
  }
}

class DigraphGuard {
  static protect(s: string): string {
    return s
      .replace(/th/gi, 'Þ')
      .replace(/gh/gi, 'Ġ')
      .replace(/kh/gi, 'Ҡ')
      .replace(/sh/gi, 'Š')
      .replace(/ch/gi, 'Č')
      .replace(/ph/gi, 'Ф')
      .replace(/dh/gi, 'Ð')
      .replace(/tz/gi, 'Ꚏ')
      .replace(/qu/gi, 'Ɋ')
  }
  static unprotect(s: string): string {
    return s
      .replace(/Þ/g, 'th')
      .replace(/Ġ/g, 'gh')
      .replace(/Ҡ/g, 'kh')
      .replace(/Š/g, 'sh')
      .replace(/Č/g, 'ch')
      .replace(/Ф/g, 'ph')
      .replace(/Ð/g, 'dh')
      .replace(/Ꚏ/g, 'tz')
      .replace(/Ɋ/g, 'qu')
      ;
  }
}

type RunMode = 'repair' | 'shrink';

class PhonoUtil {
  static countVowels(s: string): number {
    const re = new RegExp(Phonology.vowelClass, 'giu');
    return (s.match(re) || []).length;
  }

  static hasVowel(s: string): boolean {
    return new RegExp(Phonology.vowelClass, 'iu').test(s);
  }

  static isLetter(c: string): boolean {
    // Keep it simple: treat anything not space as "letter-ish"
    // If you want stricter, expand with unicode ranges later.
    return c !== ' ';
  }

  static breakRuns(s: string, profile: Profile, mode: RunMode = 'repair'): string {
    const chars = [...DigraphGuard.protect(s)];
    const isC = (ch: string) => Phonology.isConsonant(ch) && ch !== ' ';
    const maxRun = (runStr: string) => {
      if (profile.name === 'quenya') {
        const r = runStr.toLowerCase();
        if (r.includes('r') || r.includes('l')) { return 3; }
      }
      return profile.maxConsonantRun;
    };

    const findRun = () => {
      for (let i = 0; i < chars.length; i++) {
        if (!isC(chars[i])) { continue; }
        const start = i;
        while (i < chars.length && isC(chars[i])) { i++; }
        const end = i;
        const maxR = maxRun(chars.slice(start, end).join(''));
        if (end - start > maxR) { return { start, end }; }
      }
      return null;
    };

    for (let guard = 0; guard < 10; guard++) {
      const run = findRun();
      if (!run) { break; }
      const len = run.end - run.start;

      // const deleteAt = run.start + Math.floor(len / 2);
      const runStr = chars.slice(run.start, run.end).join('');
      const offset = Sonority.pickDeletionIndex(runStr);
      const deleteAt = run.start + offset;

      const insertAt = run.start + Math.floor(len / 2);

      if (mode === 'shrink' || !profile.preferEpenthesis) {
        chars.splice(deleteAt, 1);
      } else {
        chars.splice(insertAt, 0, profile.epentheticVowel);
      }
    }

    return DigraphGuard.unprotect(chars.join(''));
  }

  static collapseHiatus(s: string, profile: Profile): string {
    const V = Phonology.vowelClass;

    if (profile.name === 'quenya') {
      // Only fix triple-vowels; preserve normal VV
      const vvv = new RegExp(`(${V})(${V})(${V})`, 'giu');
      return s.replace(vvv, '$1$2'); // drop the 3rd
    }

    // Westron/Khuzdul: collapse VV
    const vv = new RegExp(`(${V})(${V})`, 'giu');
    return s.replace(vv, '$1');
  }

  static enforceFinalShape(s: string, profile: Profile): string {
    let out = s;

    // 1) Quenya: force vowel-final
    if (!profile.allowFinalConsonants) {
      if (!new RegExp(`${Phonology.vowelClass}$`, 'iu').test(out)) {
        out += profile.epentheticVowel;
      }
      return out; // and skip the rest
    }

    // 2) Westron/Khuzdul: soften only if final consonant run is too long
    const chars = [...out];
    let tailC = 0;
    for (let i = chars.length - 1; i >= 0; i--) {
      if (Phonology.isConsonant(chars[i])) { tailC++; }
      else { break; }
    }
    while (tailC >= 4) { out = out.slice(0, -1); tailC--; }

    // 3) Apply legal finals by trimming (not vowelizing)
    if (profile.legalFinals && !profile.legalFinals.test(out)) {
      out = out.slice(0, -1);
    }

    return out;
  }

}

type Profile = {
  name: 'westron' | 'khuzdul' | 'quenya';
  epentheticVowel: string;         // 'e' or 'a' etc.
  allowFinalConsonants: boolean;
  preferEpenthesis: boolean;       // vs deletion in CCC repair
  maxConsonantRun: number;         // quenya 2, westron 3, khuzdul 4
  targetLen: [number, number];     // min/max
  targetVowelCount: [number, number];
  easyBridges: string[];
  legalFinals: RegExp;             // what codas are OK
  maxWallRun: number;
};

const profiles: Record<Profile['name'], Profile> = {
  westron: {
    name: 'westron',
    epentheticVowel: 'e',
    allowFinalConsonants: true,
    preferEpenthesis: false,      // <— important: Westron should often delete, not insert
    maxConsonantRun: 3,
    targetLen: [4, 8],
    targetVowelCount: [2, 4],
    easyBridges: ['st', 'nt', 'nd', 'rd', 'ld', 'mp', 'nk', 'ns', 'lt', 'rn', 'rm', 'lm', 'rf', 'lf', 'rt'],
    // legalFinals: /(?:[a-z](?:[nst]|nd|nt|st|mp|nk|ld|rd|r|n|l)?)$/i
    legalFinals: /(?:[a-z](?:[nstmd]|nd|nt|st|mp|nk|ld|rd|rm|rn|lm|lf|rf|gh)?)$/i,
    maxWallRun: 4,
  },

  quenya: {
    name: 'quenya',
    epentheticVowel: 'a',         // often nicer than 'e'
    allowFinalConsonants: false,
    preferEpenthesis: true,
    maxConsonantRun: 2,
    targetLen: [5, 10],           // 8 is tight; Quenya names are often longer
    targetVowelCount: [2, 6],
    easyBridges: ['nd', 'nt', 'ld', 'rd', 'll', 'nn', 'mm', 'ss', 'rr'],
    legalFinals: new RegExp(`${Phonology.vowelClass}$`, 'iu'),
    maxWallRun: 3,
  },

  khuzdul: {
    name: 'khuzdul',
    epentheticVowel: 'u',
    allowFinalConsonants: true,
    preferEpenthesis: false,
    maxConsonantRun: 3,
    targetLen: [3, 8],
    targetVowelCount: [1, 3],
    easyBridges: ['st', 'nt', 'nd', 'rd', 'ld', 'mp', 'nk', 'ns', 'lt', 'zg', 'zd', 'kh', 'gh', 'sh'],
    legalFinals: /(?:[a-z](?:[nrszt]|nd|nt|st|rk|rd|ld|mb|mp|ng|nk|kh|gh|sh)?)$/i,
    maxWallRun: 5,
  },
};


// Deletes the second vowel in words with 3+ vowels, but only if it creates an easy-to-pronounce consonant bridge.
class Syncopater {
  static process(word: string, profile: Profile): string {
    let s = word;
    const vowelRe = new RegExp(Phonology.vowelClass, 'giu');

    // Try up to 2 syncopations if word is long
    for (let attempt = 0; attempt < 2; attempt++) {
      const pulses = [...s.matchAll(vowelRe)];
      if (pulses.length < 3) { break; }
      if (s.length < 7) { break; }

      // pick a weak-ish vowel: prefer deleting 'e' in the middle, else second vowel
      let targetIdx = pulses[1].index;

      const ps = DigraphGuard.protect(s);
      if (MorphemeGuard.looksLikeSeam(ps, targetIdx)) { break; }

      const startsWithSCluster = s[0]?.toLowerCase() === 's' && Phonology.isConsonant(s[1] ?? ' ');
      if (startsWithSCluster && targetIdx <= 2) { break; } // keep the head stable

      const prev = s[targetIdx - 1]?.toLowerCase();
      const cur = s[targetIdx]?.toLowerCase();
      if (prev === 'q' && cur === 'u') { break; }  // or continue attempt

      const mid = pulses.slice(1, -1).find(m => (m[0] || '').toLowerCase() === 'e');
      if (mid && mid?.index !== null) { targetIdx = mid.index; }

      const before = s[targetIdx - 1] ?? '';
      const after = s[targetIdx + 1] ?? '';
      const bridge = (before + after).toLowerCase();

      if (!profile.easyBridges.includes(bridge)) { break; }

      // Don’t create too-long consonant run for this profile
      const candidate = s.slice(0, targetIdx) + s.slice(targetIdx + 1);
      const repaired = PhonoUtil.breakRuns(candidate, profile);
      if (repaired !== candidate && !profile.preferEpenthesis) {
        // Khuzdul: if deletion would require epenthesis, skip
        break;
      }


      s = candidate;
    }

    return s;
  }
}

// Repairs illegal consonant clusters and codas, and ensures at least one vowel exists.
class PhonotacticRepair {
  static process(word: string, profile: Profile): string {
    let s = word;

    // 1) fix consonant runs
    s = PhonoUtil.breakRuns(s, profile);

    // 2) fix vowel hiatus
    s = PhonoUtil.collapseHiatus(s, profile);

    // 3) ensure at least one vowel (Khuzdul can still need this occasionally)
    if (!PhonoUtil.hasVowel(s)) { s += profile.epentheticVowel; }

    // 4) final shape rules
    s = PhonoUtil.enforceFinalShape(s, profile);

    return s;
  }
}

// Assimilation: similar sounds merge together, or a sound changes to become more like a neighboring sound.
class Assimilationist {
  static process(word: string): string {
    let s = word;
    s = s.replace(/np/g, 'mp').replace(/nb/g, 'mb').replace(/mt/g, 'nt');
    s = s.replace(/rl/g, 'll').replace(/nl/g, 'll');
    return s;
  }
}


// Softens stops, but ignores the very first letter to keep identity.
class Lenitioner {
  static process(word: string, profile: Profile): string {
    const ladders: Record<Profile['name'], Record<string, string>> = {
      westron: { p: 'b', b: 'v', t: 'd', d: 'th', k: 'g', g: 'gh' },
      khuzdul: { t: 'd', k: 'g' },
      quenya: { t: 'd' },
    };
    const ladder = ladders[profile.name];

    const res = word.split('');
    const hash = word.split('').reduce((a, b) => a + b.charCodeAt(0), 0);

    for (let i = 1; i < res.length; i++) {
      const char = res[i];
      if (ladder[char] && Math.abs(hash + i) % 10 < 3) {
        res[i] = ladder[char];
      }
    }

    return res.join('');
  }
}

// Deletes the weakest internal syllable in long words.
class SyllableCruncher {
  static process(word: string): string {
    const syllables =
      word.match(new RegExp(`[^${Phonology.vowels}]*[${Phonology.vowels}]+`, 'giu')) || [word];

    if (syllables.length < 4) { return word; }

    return syllables.map((syll, i) => {
      if (i === 0 || i === syllables.length - 1) { return syll; }

      // Only weaken one vowel, and only if the syllable has 2+ vowels or is long
      const vowelMatches = [...syll.matchAll(new RegExp(Phonology.vowelClass, 'giu'))];
      if (syll.length >= 4 || vowelMatches.length >= 2) {
        const idx = vowelMatches[0].index; // weaken first vowel only
        return syll.slice(0, idx) + 'e' + syll.slice(idx + 1);
      }
      return syll;
    }).join('');
  }
}

// Final compression and tail-blunting.
class Toponymizer {
  static process(word: string, profile: Profile): string {
    let s = word;

    if (profile.name === 'westron') {
      // tail blunt only for Westron
      const VOWEL_ENDING = new RegExp(`${Phonology.vowelClass}$`, 'iu');
      // if (s.length > 5) { s = s.replace(VOWEL_ENDING, ''); }
      if (s.length > 5 && VOWEL_ENDING.test(s)) {
        const cand = s.replace(VOWEL_ENDING, '');
        // if we end in harsh consonant, keep a tiny e
        if (/[hxg]$/i.test(cand)) { s = cand + 'e'; }
        else { s = cand; }
      }
    }

    if (profile.name === 'khuzdul') {
      // Khuzdul: never add -ger etc
      s = s.replace(/tz$/i, 'ts');
      return s;
    }

    // shared cleanup
    s = s.replace(/thh$/i, 'th');
    s = s.replace(/ghh$/i, 'gh');
    s = s.replace(/nh$/i, 'n');
    s = s.replace(/tz$/i, 'ts');

    // Westron-only stylistic smoothing
    if (profile.name === 'westron') {
      s = s.replace(/gr$/i, 'ger');
    }

    return s;
  }
}

// Governs the overall length and vowel count of the word, deleting or adding material as needed to fit the profile’s target ranges.
class LengthGovernor {
  static process(word: string, profile: Profile): string {
    let s = word;

    const tooLong = () => s.length > profile.targetLen[1] || PhonoUtil.countVowels(s) > profile.targetVowelCount[1];
    // const tooShort = () => s.length < profile.targetLen[0] || PhonoUtil.countVowels(s) < profile.targetVowelCount[0];
    const minByIdentity = profile.name === 'westron'
      ? Math.max(profile.targetLen[0], Math.floor(word.length * 0.6))
      // : (profile.name === 'quenya'
      //   ? Math.max(profile.targetLen[0], Math.floor(word.length * 0.45))
      //   : profile.targetLen[0]);
      : profile.targetLen[0];

    const tooShort = () => s.length < minByIdentity || PhonoUtil.countVowels(s) < profile.targetVowelCount[0];

    // Reduce while too long (cap iterations)
    for (let i = 0; i < 6 && tooLong(); i++) {
      // 1) drop a weak internal vowel (prefer 'e', then 'i/u', avoid first+last vowel)
      const vowels = [...s.matchAll(new RegExp(Phonology.vowelClass, 'giu'))];
      if (vowels.length >= 3) {
        const inner = vowels.slice(1, -1);

        const ranked = [
          ...inner.filter(v => v[0].toLowerCase() === 'e'),
          ...inner.filter(v => /[iuíúū]/i.test(v[0]) && v[0].toLowerCase() !== 'e'),
          ...inner.filter(v => v[0].toLowerCase() !== 'e' && !/[iuíúū]/i.test(v[0])),
        ];

        let deleted = false;
        for (const v of ranked.slice(0, 4)) {
          const idx = v.index;
          const ps = DigraphGuard.protect(s);

          if (MorphemeGuard.looksLikeSeam(ps, idx)) { continue; }
          if (this.wouldCreateUglyJoin(s, idx)) { continue; }

          const cand = s.slice(0, idx) + s.slice(idx + 1);
          if (PhonoUtil.countVowels(cand) < profile.targetVowelCount[0]) { continue; }

          s = PhonoUtil.breakRuns(cand, profile, 'shrink');
          deleted = true;
          break;
        }

        if (deleted) { continue; }
      }

      // 2) if no good vowel to drop, drop one consonant in the longest consonant run
      // const chars = [...s];
      // let bestStart = -1, bestLen = 0;
      // let curStart = -1;
      // for (let j = 0; j < chars.length; j++) {
      //   if (Phonology.isConsonant(chars[j])) {
      //     if (curStart < 0) { curStart = j; }
      //   } else {
      //     if (curStart >= 0) {
      //       const len = j - curStart;
      //       if (len > bestLen) { bestLen = len; bestStart = curStart; }
      //       curStart = -1;
      //     }
      //   }
      // }
      // if (curStart >= 0) {
      //   const len = chars.length - curStart;
      //   if (len > bestLen) { bestLen = len; bestStart = curStart; }
      // }

      // if (bestLen >= profile.maxConsonantRun) {
      //   const run = chars.slice(bestStart, bestStart + bestLen).join('');
      //   const offset = Sonority.pickDeletionIndex(run);
      //   const delAt = bestStart + offset;
      //   // const delAt = bestStart + Math.floor(bestLen / 2);
      //   s = chars.slice(0, delAt).concat(chars.slice(delAt + 1)).join('');
      //   s = PhonoUtil.breakRuns(s, profile, 'shrink');
      //   continue;
      // }

      // If we can’t improve, bail
      break;
    }

    // If too short, pad per profile
    if (tooShort()) {
      if (!PhonoUtil.hasVowel(s)) { s += profile.epentheticVowel; }
      if (!profile.allowFinalConsonants && !new RegExp(`${Phonology.vowelClass}$`, 'iu').test(s)) {
        s += profile.epentheticVowel;
      }
    }

    return s;
  }

  // only pad/enforce finals
  static finalize(word: string, profile: Profile): string {
    let s = word;
    if (!PhonoUtil.hasVowel(s)) { s += profile.epentheticVowel; }
    return s;
  }

  private static wouldCreateUglyJoin(s: string, idx: number): boolean {
    const ps = DigraphGuard.protect(s);
    const V = new RegExp(Phonology.vowelClass, 'iu');

    const left = ps[idx - 1] ?? '';
    const right = ps[idx + 1] ?? '';
    if (!left || !right) { return false; }
    if (V.test(left) || V.test(right)) { return false; }

    if (left.toLowerCase() === right.toLowerCase()) { return true; } // kk/gg/etc

    // compute actual run length across the seam after deletion
    const deleted = ps.slice(0, idx) + ps.slice(idx + 1);
    let runLen = 0;

    // count consonants to the left of seam
    for (let i = idx - 1; i >= 0; i--) {
      if (V.test(deleted[i]) || deleted[i] === ' ') { break; }
      runLen++;
    }
    // count consonants to the right of seam
    for (let i = idx; i < deleted.length; i++) {
      if (V.test(deleted[i]) || deleted[i] === ' ') { break; }
      runLen++;
    }

    return runLen >= 4; // this is now “real” seam run, not nearby noise
  }
}

class GeminateNormalizer {
  static process(word: string, profile: Profile): string {
    let s = word;

    // Always fix these bug-looking cases
    s = s.replace(/hh/gi, 'h');

    if (profile.name === 'khuzdul') {
      // keep some gemination, but avoid hard-stop doubles inside clusters: ...CkkC...
      const V = new RegExp(Phonology.vowelClass, 'iu');
      const ps = DigraphGuard.protect(s);

      s = DigraphGuard.unprotect(
        ps.replace(/([^ ])([ptkbdg])\2([^ ])/gi, (m, a, b, c) => {
          // only collapse if neighbors are consonant-ish (not vowels)
          if (!V.test(a as string) && !V.test(c as string)) { return a + b + c as string; }

          return a + b + b + c as string; // keep if it's between vowels (rare here)
        })
      );

      // optional: collapse long vowel runs as you already do
      // s = s.replace(/([aeiouy])\1+/gi, '$1');
      s = s.replace(new RegExp(`(${Phonology.vowelClass})\\1+`, 'gi'), '$1');
      // If tz follows a geminate stop, collapse it (…ttz… → …tz…)
      s = s.replace(/([ptkbdg])\1tz/gi, '$1tz');
      // and if tz precedes a geminate stop (…tzt… → …tz…)
      s = s.replace(/tz([ptkbdg])\1/gi, 'tz$1');
      return s;
      // }

    }

    if (profile.name === 'quenya') {
      // Keep Quenya-friendly geminates
      const keep = new Set(['ll', 'nn', 'mm', 'ss', 'rr', 'tt']);
      // Replace any double consonant not in keep
      s = s.replace(/([b-df-hj-np-tv-z])\1/gi, (m) => (keep.has(m.toLowerCase()) ? m : m[0]));
      return s;
    }

    // Westron: collapse most geminates (except maybe 'll' and 'ss' if you like)
    s = s.replace(/([b-df-hj-np-tv-z])\1/gi, '$1');
    return s;
  }
}

class ClusterSmoother {
  // Commonly acceptable clusters (expand per taste)
  static rawAllowed2 = [
    'st', 'sp', 'sk', 'nd', 'nt', 'nk', 'ng', 'mp', 'mb', 'ld', 'rd', 'rt', 'lt', 'rm', 'rn', 'lm',
    'th', 'sh', 'ch', 'ph', 'kh', 'gh',
    // Quenya: tolerate more compound seams without epenthetic a
    'tr', 'dr', 'mr', 'nr', 'ml', 'nl', 'mb', 'mp', 'nt', 'nd', 'ld', 'rd', 'rt', 'lt',
    'll', 'nn', 'mm', 'ss', 'rr', 'tt',
    'xl', 'xr', 'xw', 'lx', 'rx',
    'dh', 'gw'
  ];

  static rawAllowed3 = ['str', 'spr', 'skr', 'thr', 'ndr', 'ntr', 'ngw', 'nqu'];

  static allowed2 = new Set(ClusterSmoother.rawAllowed2.map(x => DigraphGuard.protect(x).toLowerCase()));
  static allowed3 = new Set(ClusterSmoother.rawAllowed3.map(x => DigraphGuard.protect(x).toLowerCase()));


  static smooth(word: string, profile: Profile): string {
    // Work on protected form so th/kh/sh count as one unit
    let s = DigraphGuard.protect(word);
    const chars = [...s];

    // const isC = (c: string) => c !== ' ' && !new RegExp(Phonology.vowelClass, 'iu').test(c);
    const V = new RegExp(Phonology.vowelClass, 'iu');
    const isC = (c: string) => c !== ' ' && !V.test(c);

    const pickDeletionIndex = (a: string, b: string, c: string, profile: Profile) => {
      // Prefer deleting weak consonants for Khuzdul
      const weak = new Set(['h', 'w', 'y', 'r', 'l', 'Þ', 'Ġ', 'Ҡ', 'Š', 'Č', 'Ф']); // include placeholders lightly
      if (profile.name === 'khuzdul') {
        if (weak.has(b.toLowerCase())) { return 1; }
        if (weak.has(a.toLowerCase())) { return 0; }
        if (weak.has(c.toLowerCase())) { return 2; }
      }
      return 1; // middle by default
    };

    // Apply multiple passes; cap to avoid infinite churn
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;

      for (let i = 0; i < chars.length - 1; i++) {
        if (!isC(chars[i]) || !isC(chars[i + 1])) { continue; }

        const c2 = (chars[i] + chars[i + 1]).toLowerCase();

        // Quenya hates most CC unless in allowed2
        if (profile.name === 'quenya' && !this.allowed2.has(c2)) {
          // Quenya-ish assimilation/deletion helpers
          if (c2 === 'tn') { chars.splice(i, 1); changed = true; break; } // tn -> n (drop t)  OR choose nt
          if (c2 === 'kn') { chars[i] = 'n'; changed = true; break; }     // kn -> nn-ish (then geminate normalizer handles)

          // const overLong = chars.length >= profile.targetLen[1];

          // quick assimilation fixes
          if (c2 === 'mt') { chars[i] = 'n'; changed = true; break; }      // mt -> nt
          if (c2 === 'dt') { chars.splice(i, 1); changed = true; break; }  // dt -> t
          if (c2 === 'nl' || c2 === 'rl') { chars[i] = 'l'; changed = true; break; } // -> ll

          const V = new RegExp(Phonology.vowelClass, 'iu');
          const leftV = V.test(chars[i - 1] ?? '');
          const rightV = V.test(chars[i + 2] ?? ''); // after the pair
          const overLong = chars.length >= profile.targetLen[1];

          // 0) If overlong, delete (don't add vowels)
          if (overLong) {
            // chars.splice(i + 1, 1); // drop 2nd consonant by default
            // instead of always deleting chars[i+1]
            const a = chars[i], b = chars[i + 1];
            const del = Sonority.score(a) <= Sonority.score(b) ? i : i + 1;
            chars.splice(del, 1);
            changed = true;
            break;
          }

          // 1) If NOT VCCV, prefer deletion (avoid "a-spray")
          if (!(leftV && rightV)) {
            chars.splice(i + 1, 1);
            changed = true;
            break;
          }

          // 2) Now we KNOW it's VCCV. Before epenthesis, try Quenya-ish fixes:

          // 2a) Glide-loss: V (w|y) (n|m|l|r) V  => drop the glide
          const a = (chars[i] ?? '').toLowerCase();
          const b = (chars[i + 1] ?? '').toLowerCase();
          const isGlide = (x: string) => x === 'w' || x === 'y';
          const isSon = (x: string) => x === 'n' || x === 'm' || x === 'l' || x === 'r';
          if (isGlide(a) && isSon(b)) {
            chars.splice(i, 1);   // drop w/y
            changed = true;
            break;
          }

          // 2b) If it is a stop+sonorant, try dropping the stop (often nicer than inserting "a")
          const isStop = (x: string) => /[ptkbdg]/i.test(x);
          if (isStop(a) && isSon(b)) {
            chars.splice(i, 1);   // drop the stop
            changed = true;
            break;
          }

          // 3) Otherwise: true Quenya epenthesis in VCCV
          // Insert the epenthetic vowel between the consonants.
          if (chars[i + 1] !== profile.epentheticVowel) {
            chars.splice(i + 1, 0, profile.epentheticVowel);
          }
          changed = true;
          break;
        }

        // For others, tolerate CC; focus on CCC
        if (i < chars.length - 2 && isC(chars[i + 2])) {
          const c3 = (chars[i] + chars[i + 1] + chars[i + 2]).toLowerCase();

          const overLong = chars.length > profile.targetLen[1];

          if (!this.allowed3.has(c3)) {
            if (profile.name === 'quenya') {
              if (overLong) {
                // delete middle consonant instead of adding yet another vowel
                chars.splice(i + 1, 1);
              } else {
                chars.splice(i + 1, 0, profile.epentheticVowel);
              }
            } else if (profile.preferEpenthesis && profile.name !== 'khuzdul') {
              // insert vowel between 1 and 2
              chars.splice(i + 1, 0, profile.epentheticVowel);
            } else {
              // delete one consonant from the triple
              const del = pickDeletionIndex(chars[i], chars[i + 1], chars[i + 2], profile);
              chars.splice(i + del, 1);
            }
            changed = true;
            break;
          }
        }
      }

      if (!changed) { break; }
    }

    s = chars.join('');
    return DigraphGuard.unprotect(s);
  }
}

class Polish {
  static process(word: string, profile: Profile): string {
    let s = word;

    // Fix a couple common pipeline artifacts for Westron.
    if (profile.name === 'westron') {
      s = s.replace(/sd$/i, 'st'); // Fisfasd -> Fisfast
      s = s.replace(/zd$/i, 'st');
      s = s.replace(/nm$/i, 'n');  // Túnunm -> Túnun
    }

    // Final syllable nucleus safeguard
    if (profile.name === 'khuzdul') {
      const V = new RegExp(Phonology.vowelClass, 'iu');
      const tail = s.slice(-3);
      if (!V.test(tail)) {
        // inject a minimal vowel before the final consonant
        s = s.slice(0, -1) + profile.epentheticVowel + s.slice(-1);
      }
    }

    // Re-apply final-shape constraints after cosmetics.
    // (This trims for Westron/Khuzdul, pads for Quenya.)
    s = PhonoUtil.enforceFinalShape(s, profile);

    // If we somehow stripped all vowels, recover.
    const harmonyVowel = this.getHarmonyVowel(s, profile);
    if (!PhonoUtil.hasVowel(s)) { s += harmonyVowel; }

    return s;
  }

  static getHarmonyVowel(word: string, profile: Profile): string {
    if (profile.name !== 'quenya') { return profile.epentheticVowel; }
    // Pick the most common vowel in the word to create "Vowel Harmony"
    const matches = word.match(/[aeiou]/gi);
    return matches ? matches[0] : profile.epentheticVowel;
  }
}

export class WordCorruptor {
  static mutate(
    word: string, languageKey: 'westron' | 'khuzdul' | 'quenya'
  ): string {
    const profile = profiles[languageKey];

    let s = word.toLowerCase().trim();

    if (profile.name === 'quenya') {
      // Quenya-ish: avoid raw 'x' clusters
      s = s.replace(/x/g, 'cs'); // or 'ks'
    }

    s = SyllableCruncher.process(s);
    s = Syncopater.process(s, profile);
    s = Lenitioner.process(s, profile);
    s = Assimilationist.process(s);
    s = PhonotacticRepair.process(s, profile);
    s = LengthGovernor.process(s, profile);
    s = Toponymizer.process(s, profile);
    s = GeminateNormalizer.process(s, profile);
    s = Polish.process(s, profile);

    // Final cleanups
    s = s.replace(/tth/gi, 'th');

    const forbiddenXY = ['tz', 'zh', 'sh', 'gh', 'kh', 'th', 'ts'];
    for (const xy of forbiddenXY) {
      const re = new RegExp(xy + xy, 'gi');
      s = s.replace(re, xy);
    }

    const ret = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    console.warn(`"${word}" => "${ret}" (${profile.name})`);
    return ret;
  }

  static isQuenyaClusterOK(word: string): boolean {
    const ps = DigraphGuard.protect(word.toLowerCase());
    const V = new RegExp(Phonology.vowelClass, 'iu');
    const chars = [...ps];
    const isC = (c: string) => c !== ' ' && !V.test(c);

    // no CCC
    for (let i = 0; i < chars.length - 2; i++) {
      if (isC(chars[i]) && isC(chars[i + 1]) && isC(chars[i + 2])) { return false; }
    }

    // only allowed CC
    for (let i = 0; i < chars.length - 1; i++) {
      if (isC(chars[i]) && isC(chars[i + 1])) {
        const c2 = (chars[i] + chars[i + 1]).toLowerCase();
        if (!ClusterSmoother.allowed2.has(c2)) { return false; }
      }
    }

    return true;
  }
}