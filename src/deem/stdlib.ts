import LanguageManager, { Concept, Conceptory, ConceptTemplate } from '../orsino/Language';
import { Fighting } from '../orsino/rules/Fighting';
import Words from '../orsino/tui/Words';

export type DeemValue = string | number | boolean | null | DeemValue[] | { [key: string]: DeemValue };
export type DeemFunc = ((...args: DeemValue[]) => DeemValue)
              | ((arr: DeemValue[], ...args: DeemValue[]) => DeemValue)


export default class StandardLibrary {
  static functions: Record<string, DeemFunc> = {
    a_an: (word: DeemValue) => {
      if (typeof word !== 'string') {
        throw new Error(`a_an() expects a string, got: ${typeof word}`);
      }
      const vowels = ['a', 'e', 'i', 'o', 'u'];
      return (vowels.includes(word.charAt(0).toLowerCase()) ? 'an' : 'a') + ' ' + word;
    },
    count: (arr: DeemValue[]) => { return arr.length },
    rand: () => Math.random(),
    if: (cond: DeemValue, trueVal: DeemValue, falseVal: DeemValue) => (cond ? trueVal : falseVal),
    oneOf: (...args: DeemValue[]) => {
      const picked = args[Math.floor(Math.random() * args.length)];
      // console.warn("Deem StandardLibrary.oneOf(): picked=", picked);
      return picked;
    },
    pick: (arr: DeemValue[], index: DeemValue = -1) => {
      if (!Array.isArray(arr)) {
        throw new Error(`pick() expects an array, got: ${typeof arr}`);
      }
      if (index === -1) {
        return arr[Math.floor(Math.random() * arr.length)]
      } else {
        if (typeof index === 'number') {
          return arr[index % arr.length];
        } else {
          throw new Error(`pick() received invalid index: ${JSON.stringify(index)} (type: ${typeof index})`);
        }
      }
    },
    sample: (arr: DeemValue[], count: DeemValue) => {
      if (typeof count !== 'number') {
        throw new Error(`sample() expects count to be a number, got: ${typeof count}`);
      }

      const sampled: DeemValue[] = [];

      const arrCopy = [...arr];
      for (let i = 0; i < count && arrCopy.length > 0; i++) {
        const index = Math.floor(Math.random() * arrCopy.length);
        sampled.push(arrCopy.splice(index, 1)[0]);
      }
      return sampled;
    },
    round: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`round() expects a number, got: ${typeof num}`);
      }
      return Math.round(num)
    },
    floor: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`floor() expects a number, got: ${typeof num}`);
      }
      return Math.floor(num)
    },
    ceil: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`ceil() expects a number, got: ${typeof num}`);
      }
      return Math.ceil(num)
    },
    capitalize: (str: DeemValue) => {
      if (typeof str !== 'string') {
        throw new Error(`capitalize() expects a string, got: ${typeof str} (${JSON.stringify(str)})`);
      }
      return str && str.charAt(0).toUpperCase() + str.slice(1)
    },
    humanize: (str: DeemValue) => {
      if (typeof str !== 'string') {
        throw new Error(`humanize() expects a string, got: ${typeof str}`);
      }
      return Words.humanize(str)
    },
    len: (obj: DeemValue) => {
      if (Array.isArray(obj) || typeof obj === 'string') {
        return obj.length;
      } else if (obj && typeof obj === 'object') {
        return Object.keys(obj).length;
      }
      return 0;
    },
    sum: (arr: DeemValue[], prop?: DeemValue) => {
      if (!Array.isArray(arr)) {
        throw new Error(`sum() expects an array, got: ${typeof arr}`);
      }
      if (arr.length === 0) {
        return 0;
      }
      if (!arr.every(item => typeof item === 'number' || (prop && typeof item === 'object'))) {
        throw new Error(`sum() expects an array of numbers or objects when property is specified, got: [${arr.map(i => typeof i).join(', ')}]`);
      }

      if (prop) {
        if (typeof prop !== 'string') {
          throw new Error(`sum() expects property name to be a string, got: ${typeof prop}`);
        }
        const numbers = arr.map(item => {
          if (typeof item === 'object' && item !== null && prop in item) {
            const it = item as { [key: string]: DeemValue };
            const val = it[prop];
            if (typeof val === 'number') {
              return val;
            } else {
              throw new Error(`sum() expected property '${prop}' to be a number, got: ${typeof val}`);
            }
          } else {
            return 0;
          }
        });

        // return objArray.reduce((acc, item) => acc + (item[prop] || 0), 0);
        return numbers.reduce((acc, val) => acc + val, 0);
      }
      const numArray: number[] = arr as number[];

      return numArray.reduce((acc, val) => acc + val, 0);
    },
    min: (...args: DeemValue[]) => {
      if (!args.every(item => typeof item === 'number')) {
        throw new Error(`min() expects all arguments to be numbers, got: [${args.map(i => typeof i).join(', ')}]`);
      }

      return Math.min(...args)
    },
    max: (...args: DeemValue[]) => {
      if (!args.every(item => typeof item === 'number')) {
        throw new Error(`max() expects all arguments to be numbers, got: [${args.map(i => typeof i).join(', ')}]`);
      }
      return Math.max(...args)
    },
    concat: (...args: DeemValue[]) => args.flat().filter((x) => x !== null && x !== undefined),
    roll: (count: DeemValue, sides: DeemValue) => {
      if (typeof count !== 'number' || typeof sides !== 'number') {
        throw new Error(`roll() expects count and sides to be numbers, got: ${typeof count} and ${typeof sides}`);
      }
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0);
      return sum;
    },
    rollWithDrop: (count: DeemValue, sides: DeemValue) => {
      if (typeof count !== 'number' || typeof sides !== 'number') {
        throw new Error(`rollWithDrop() expects count and sides to be numbers, got: ${typeof count} and ${typeof sides}`);
      }
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      rolls.sort((a, b) => a - b);
      rolls.shift(); // drop the lowest
      return rolls.reduce((a, b) => a + b, 0);
    },
    statMod: (stat: DeemValue) => {
      if (typeof stat !== 'number') {
        throw new Error(`statMod() expects a number, got: ${typeof stat}`);
      }
      return Fighting.statMod(stat);
    },
    dig: (obj: DeemValue, ...path: DeemValue[]) => {
      if (typeof obj !== 'object' || obj === null) {
        return null;
      }
      if (!path.every(p => typeof p === 'string' || typeof p === 'number')) {
        throw new Error(`dig() expects path elements to be strings or numbers, got: [${path.map(p => typeof p).join(', ')}]`);
      }
      // @ts-expect-error -- dynamic prop access
      return path.reduce((acc, key) => {
        // return (acc && acc[key] !== undefined) ? acc[key] : null
        if (acc && typeof acc === 'object' && key in acc) {
          return (acc as Record<string, DeemValue>)[key];
        } else {
          return null;
          // throw new Error(`dig() could not find key '${key}' in object: ${JSON.stringify(acc)}`);
        }
      }, obj);
    },
    uniq: (arr: DeemValue[]) => {
      // console.warn("Deem StandardLibrary.uniq(): arr=", arr);
      return Array.from(new Set(arr))
    },
    distribute: (total: DeemValue, parts: DeemValue) => {
      if (typeof total !== 'number' || typeof parts !== 'number') {
        throw new Error(`distribute() expects total and parts to be numbers, got: ${typeof total} and ${typeof parts}`);
      }
      const base = Math.floor(total / parts);
      const remainder = total % parts;
      const distribution = Array(parts).fill(base);
      for (let i = 0; i < remainder; i++) {
        distribution[i]++;
      }
      return distribution.filter(x => x > 0) as DeemValue;
    },

    translate: (languageName: DeemValue, ...concepts: DeemValue[]) => {
      // use default language (westron)
      const lang = LanguageManager.instance.getDictionary(languageName as string);
      if (!lang) {
        throw new Error(`translate() could not find default language 'westron'`);
      }
      return lang.translate(...concepts as Concept[]);
    },

    conceptory: (conceptTemplate: DeemValue) => {
      if (typeof conceptTemplate !== 'string') {
        throw new Error(`conceptory() expects a string, got: ${typeof conceptTemplate}`);
      }
      return Conceptory.generate(conceptTemplate as ConceptTemplate);
    },

    join: (arr: DeemValue[], separator: DeemValue) => {
      if (!Array.isArray(arr)) {
        throw new Error(`join() expects an array, got: ${typeof arr}`);
      }
      if (typeof separator !== 'string') {
        throw new Error(`join() expects separator to be a string, got: ${typeof separator}`);
      }
      const items = arr.map(item => typeof item === "string" ? Words.humanize(item) : item)
      return (items as string[]).join(separator);
    },

    alliterate: (options: DeemValue[], key: DeemValue) => {
      if (typeof key !== 'string') {
        console.warn(`alliterate() received non-string key: ${JSON.stringify(key)}`);
        throw new Error(`alliterate() expects key to be a string, got: ${typeof key}`);
      }
      if (!options.every(opt => typeof opt === 'string')) {
        throw new Error(`alliterate() expects all options to be strings, got: [${options.map(i => typeof i).join(', ')}]`);
      }
      const firstChar = key.charAt(0).toLowerCase();
      const filtered = options.filter(opt => (opt).charAt(0).toLowerCase() === firstChar);
      if (filtered.length > 0) {
        return filtered[Math.floor(Math.random() * filtered.length)];
      } else {
        // no matching alliteration, pick any
        return options[Math.floor(Math.random() * options.length)];
      }
    },

    first: (arr: DeemValue[]) => {
      if (!Array.isArray(arr)) {
        throw new Error(`first() expects an array, got: ${typeof arr}`);
      }
      return arr.length > 0 ? arr[0] : null;
    },

    last: (arr: DeemValue[]) => {
      if (!Array.isArray(arr)) {
        throw new Error(`last() expects an array, got: ${typeof arr}`);
      }
      return arr.length > 0 ? arr[arr.length - 1] : null;
    },

    roman: (num: DeemValue) => {
      if (typeof num !== 'number') {
        throw new Error(`roman() expects a number, got: ${typeof num}`);
      }
      if (num <= 0 || num >= 4000) {
        throw new Error(`roman() expects a number between 1 and 3999, got: ${num}`);
      }
      const romanNumerals: { [key: number]: string } = {
        1000: 'M',
        900: 'CM',
        500: 'D',
        400: 'CD',
        100: 'C',
        90: 'XC',
        50: 'L',
        40: 'XL',
        10: 'X',
        9: 'IX',
        5: 'V',
        4: 'IV',
        1: 'I'
      };
      let result = '';
      let remaining = num;
      for (const value of Object.keys(romanNumerals).map(k => parseInt(k)).sort((a, b) => b - a)) {
        while (remaining >= value) {
          result += romanNumerals[value];
          remaining -= value;
        }
      }
      return result;
    }

    // find: (arr: DeemValue[], prop: DeemValue, value: DeemValue) => {
    //   if (!Array.isArray(arr)) {
    //     throw new Error(`find() expects an array, got: ${typeof arr}`);
    //   }
    //   if (typeof prop !== 'string') {
    //     throw new Error(`find() expects property name to be a string, got: ${typeof prop}`);
    //   }
    //   console.log(`find(): searching for items with ${prop} === ${JSON.stringify(value)} [list length: ${arr.length}]`);
    //   const options = arr.filter(item => {
    //     console.log(`find(): checking item: ${JSON.stringify(item)} (value of ${prop}: ${typeof item === 'object' && item !== null && prop in item ? JSON.stringify((item as { [key: string]: DeemValue })[prop]) : 'N/A'})`);
    //     if (typeof item === 'object' && item !== null && prop in item) {
    //       const it = item as { [key: string]: DeemValue };
    //       return it[prop] === value;
    //     }
    //     return false;
    //   }) || null;

    //   console.log(`find(): found ${options.length} matching items.`);
    //   if (options.length === 0) {
    //     throw new Error(`find() could not find any items with ${prop} === ${JSON.stringify(value)}`);
    //     return null;
    //   }
    //   return options[Math.floor(Math.random() * options.length)];
    // }

  };
}