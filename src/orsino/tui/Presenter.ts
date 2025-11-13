import Stylist from "./Style";
import { Combatant } from "../types/Combatant";
import Words from "./Words";

export default class Presenter {
  static combatant = (combatant: Combatant, minimal = false) => {
    let colors = ['red', 'red', 'orange', 'orange', 'green', 'green', 'blue'];
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = colors[Math.floor(hpRatio * (colors.length - 1))] || colors[0];

    if (minimal) {
      return `${Stylist.format(combatant.forename, 'bold')} ${Stylist.colorize(hpBar, color)} (${combatant.hp}/${combatant.maxHp}) [AC ${combatant.ac}]`;
    }

    const str = Stylist.colorize(Stylist.prettyValue(combatant.str, 20), 'red');
    const dex = Stylist.colorize(Stylist.prettyValue(combatant.dex, 20), 'yellow');
    const int = Stylist.colorize(Stylist.prettyValue(combatant.int, 20), 'green');
    const wis = Stylist.colorize(Stylist.prettyValue(combatant.wis, 20), 'blue');
    const cha = Stylist.colorize(Stylist.prettyValue(combatant.cha, 20), 'magenta');
    const con = Stylist.colorize(Stylist.prettyValue(combatant.con, 20), 'cyan');

    const stats = [str, dex, int, wis, cha, con].join('');

    let classInfo = combatant.class ? `, ${Words.capitalize(combatant?.race || 'human')} ${Words.capitalize(combatant.class)} ` : '';

    return `${Stylist.format(combatant.name, 'bold')}${classInfo} (${stats}, HP: ${Stylist.colorize(hpBar, color)} ${combatant.hp}/${combatant.maxHp})`;
  }
}