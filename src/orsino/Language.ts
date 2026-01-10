import Words from "./tui/Words";
// import Files from "./util/Files";
import importedLanguages from "../../settings/fantasy/languages.json";

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
  
  'edge',

  'river', 'glen', 'stream', 'mere', 'mouth', 'cross', 'bridge', 'dale', 'ford',
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
  // mole...

  // tame animals..
  // 'boars',
  'hounds',

  // birds in particular...
  'swans', 'eagles', 'nightingales',
  // swallow

  // ...elements,
  'ice', 'fire', 'earth', 'water',

  // quasi-elements...
  'embers', 'steam', 'magma', 'radiance',
  'soot', 'ash', 'salt', 'void',

  // ...times of day
  'morning', 'evening', 'dusk', 'noon', 'afternoon', 'midnight',
  // trees
  'willow', 'pine', 'cherry', 'oak', 'spruce', 'birch', 'elm', 'holly', 'fern', 
  'palm', 'acorn', 
  // flowers
  'rose', 'daisy', 'poppy', 'dandelion', 'lily',
  // foliage
  'tree', 'bark', 'leaf', 'root', 'bush', 'thorn', 'flower', 'moss',
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
  // lute, harp, viol ...

  // adjectives...
  'tall', 'deep', 'lofty', 'lonely', 'high',
  'great', 'large', 'small', 'tiny',
  'narrow', 'wide', 'sharp', 'giant',
  'quick', 'pale', 'bitter',

  'golden', 'holy', 'fortunate', 'dusty', 'beautiful',
  'fell', 'cloudy', 'secret', 'sweet', 'bold',
  'splendid', 'abundant', 'sparkling',

  // animal aspects...
  'horns', 'fangs', 'claws',

  // gemstones...
  // 'emerald', 'ruby',

  // more abstract things...
  'love', 'dream',
  'music', 'silence', 'divine',

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

  'song',

  'any',

  'vale',
  'field',

] as const;

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