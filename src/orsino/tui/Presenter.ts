import Stylist, { Color } from "./Style";
import { Combatant } from "../types/Combatant";
import { Fighting } from "../rules/Fighting";

export default class Presenter {
  static colors: Color[] = ['magenta', 'red', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'green'];

  static aggregateList = (items: string[]) => {
    const counts: { [item: string]: number } = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).map(([item, count]) => {
      return count > 1 ? `${item} x${count}` : item;
    }).join(", ");
  }

  static statLine(combatant: Combatant) {
    const effective = Fighting.effectiveStats(combatant);
    return [
      this.stat('str', effective.str),
      this.stat('dex', effective.dex),
      this.stat('int', effective.int),
      this.stat('wis', effective.wis),
      this.stat('cha', effective.cha),
      this.stat('con', effective.con)
    ].join('');
  }

  static statColors: { [key in keyof Combatant]?: string } = {
    str: 'red',
    dex: 'yellow',
    int: 'green',
    wis: 'blue',
    cha: 'magenta',
    con: 'cyan',
  }

  static stat = (stat: keyof Combatant, value: number) => {
    const color = this.statColors[stat] || 'white';
    return Stylist.colorize(Stylist.prettyValue(value, 20), color);
  }

  static statMod = (value: number) => {
    const mod = Fighting.statMod(value);
    const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
    const sign = mod >= 0 ? '+' : '';
    return Stylist.colorize(sign + mod, color);
  }


  static padLiteralEnd = (text: string, length: number, padChar: string = ' ') => {
    const cleanLength = Stylist.cleanLength(text);
    if (cleanLength >= length) { return text; }
    const padLength = length - cleanLength;
    return text + padChar.repeat(padLength);
  }

  static padLiteralStart = (text: string, length: number, padChar: string = ' ') => {
    const cleanLength = Stylist.cleanLength(text);
    if (cleanLength >= length) { return text; }
    const padLength = length - cleanLength;
    return padChar.repeat(padLength) + text;
  }

  

  static increaseDecrease(what: string, value: number | string): string {
    if (typeof value === 'string') {
      return `add ${value} to ${what}`;
    }
    return value >= 0
      ? `improve ${what} by ${value}`
      : `degrade ${what} by ${Math.abs(value)}`;
  }

  static multipliedBy(what: string, value: number): string {
    const percentage = typeof value === 'number' ? Math.round((value - 1) * 100) : null;
    return value >= 1 ? `+${percentage}% ${what}` : `-${Math.abs(percentage || 0)}% ${what}`;
  }

  static describeDuration(turns?: number): string {
    if (turns) {
      return turns > 1 ? `for ${turns} turns` : `for ${turns} turn`;
    }
    return "indefinitely";
  }
}