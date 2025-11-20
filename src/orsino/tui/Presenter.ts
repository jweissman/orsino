import Stylist from "./Style";
import { Combatant } from "../types/Combatant";
import Words from "./Words";
import Combat from "../Combat";
import { Fighting } from "../rules/Fighting";

export default class Presenter {
  static combatant = (combatant: Combatant, minimal = false) => {
    let colors = ['magenta', 'red', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'green'];
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = colors[Math.floor(hpRatio * (colors.length - 1))] || colors[0];

    if (minimal) {
      let hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
      let name = Stylist.format(combatant.forename, 'bold');
      return `${Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow')} ${Stylist.colorize(hpBar, color)} (${this.statLine(combatant)})`;
    }

    let combatClass = combatant.class || combatant.type;
    let classInfo = combatClass ? `, ${Words.capitalize(combatant.race || '')} ${Words.capitalize(combatClass)} ` : '';
    const effective = Fighting.effectiveStats(combatant);
    // const stats = { STR: effective.str, DEX: effective.dex, INT: effective.int, WIS: effective.wis, CHA: effective.cha, CON: effective.con };
    // const statInfo = Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ');
      //Presenter.statLine(combatant);

    const activeEffectNames = combatant.activeEffects?.map(e => e.name) || [];
    if (activeEffectNames.length > 0) {
      classInfo += ` [${activeEffectNames.join(', ')}]`;
    }

    let lhs = `${Stylist.format(
      Stylist.colorize(combatant.name, combatant.playerControlled ? 'cyan' : 'yellow'),
      'bold'
    )}${classInfo}`;
    let rhs = `(HP: ${Stylist.colorize(hpBar, color)} ${combatant.hp}/${combatant.maxHp}, AC: ${effective.ac})`;
    return `${lhs} ${rhs}`;
  }

  static statLine = (combatant: Combatant) => {
    const str = Stylist.colorize(Stylist.prettyValue(combatant.str, 20), 'red');
    const dex = Stylist.colorize(Stylist.prettyValue(combatant.dex, 20), 'yellow');
    const int = Stylist.colorize(Stylist.prettyValue(combatant.int, 20), 'green');
    const wis = Stylist.colorize(Stylist.prettyValue(combatant.wis, 20), 'blue');
    const cha = Stylist.colorize(Stylist.prettyValue(combatant.cha, 20), 'magenta');
    const con = Stylist.colorize(Stylist.prettyValue(combatant.con, 20), 'cyan');

    return [str, dex, int, wis, cha, con].join('');
  }
}