import { Fighting } from "../rules/Fighting";
import Presenter from "../tui/Presenter";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";

export default class CombatantPresenter extends Presenter {
  static minimalCombatant = (combatant: Combatant) => {
    const effective = Fighting.effectiveStats(combatant);
    const hpRatio = combatant.hp / effective.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, effective.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];
    let name = Stylist.format(combatant.forename, 'bold');

    let combatClass = combatant.class;


    const fx = Fighting.effectList(combatant);
    if (fx.some(e => e.effect?.displayName)) {
      const firstNameOverride = fx.find(e => e.effect?.displayName)?.effect?.displayName;
      if (firstNameOverride) {
        name = Stylist.format(firstNameOverride, 'bold');
      }
    }
    if (fx.some(e => e.effect?.displayClass)) {
      const firstClassOverride = fx.find(e => e.effect?.displayClass)?.effect?.displayClass;
      if (firstClassOverride) {
        combatClass = firstClassOverride;
      }
    }

    const combatKind = (combatant as unknown as { kind?: string }).kind || Words.humanize(combatant.race || '');
    const combatantType = combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '';

    let tempHp = 0;
    for (const poolAmount of Object.values(combatant.tempHpPools || {})) {
      tempHp += poolAmount;
    }
    return [
      Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'),
      combatant.hp <= 0 ? Stylist.colorize('X', 'red') : Stylist.colorize(hpBar, color),
      tempHp > 0 ? Stylist.colorize(`(+${tempHp})`, 'blue') : '',
      combatant.hp > 0 ? `${combatant.hp}/${effective.maxHp}` : 'KO',
      combatantType
      // combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '',
    ].join(' ');
  }

  static combatant = (combatant: Combatant) => {

    const effective = Fighting.effectiveStats(combatant);
    const fx = Fighting.effectList(combatant);
    // gather displa class
    let displayClass = combatant.class;
    if (fx.some(e => e.effect?.displayClass)) {
      const firstClassOverride = fx.find(e => e.effect?.displayClass)?.effect?.displayClass;
      if (firstClassOverride) {
        displayClass = firstClassOverride;
      }
    }

    const hpRatio = combatant.hp / effective.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, effective.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];

    const combatClass = displayClass || combatant.class;
    const combatKind = (combatant).kind || Words.humanize(combatant.race || '');
    let classInfo = combatClass ? `Lvl. ${combatant.level.toString().padEnd(2)} ${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '';
    // const effective = Fighting.effectiveStats(combatant);
    // const stats = { STR: effective.str, DEX: effective.dex, INT: effective.int, WIS: effective.wis, CHA: effective.cha, CON: effective.con };
    // const statInfo = Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ');
    //Presenter.statLine(combatant);

    const fxNameAndDurations = combatant.activeEffects?.map(e => ({ name: e.name, duration: e.duration || '--' })) || [];
    if (fxNameAndDurations.length > 0) {
      classInfo = classInfo.padEnd(32) + ' | ' + Words.humanizeList(fxNameAndDurations.map(fx => {
        return fx.name;  //  turns`${fx.name} (${fx.duration})`;
      }));
    }

    const friendly = combatant.playerControlled;
    let name = combatant.name;
    // const fx = Fighting.effectList(combatant);
    if (fx.some(e => e.effect?.displayName)) {
      const firstNameOverride = fx.find(e => e.effect?.displayName)?.effect?.displayName;
      if (firstNameOverride) {
        name = Stylist.format(firstNameOverride, 'bold');
      }
    }
    const lhs = `${Stylist.colorize(hpBar, color)} ${Stylist.format(
      Stylist.colorize(name, friendly ? 'cyan' : 'yellow'),
      'bold'
    ).padEnd(40)}${classInfo}`;
    // let rhs = `(${this.statLine(combatant)})`;
    // return `${lhs} ${rhs}`;
    return lhs;
  }


  static combatants = (combatants: Combatant[], minimal: boolean = false, indicate: (combatant: Combatant) => boolean) => {
    return combatants
      .filter(c => c.hp > 0)
      .map(c => ((minimal ? "" : "\n") + (indicate(c) ? " 👉 " : "  ") + (minimal ? this.minimalCombatant(c) : this.combatant(c))))
      .join(minimal ? ", " : "");
    // return combatants.map(c => this.combatant(c)).join('\n');
  }

  static parties = (parties: { name: string; combatants: Combatant[] }[]) => {
    let partyDisplay = "";
    const lines = Math.max(...parties.map(p => p.combatants.length))
    // sort combatants alphabetically within each party
    parties.forEach(party => {
      party.combatants.sort((a, b) => a.name.localeCompare(b.forename));
    });
    for (let i = 0; i < lines; i++) {
      // names
      const lhs = parties[0] ? parties[0].combatants[i] : null;
      const rhs = parties[1] ? parties[1].combatants[i] : null;
      let line = "";
      if (lhs) {
        line += this.padLiteralEnd(this.minimalCombatant(lhs), 40);
      } else {
        line += ' '.repeat(40);
      }
      // line += '';
      if (rhs) {
        line += this.padLiteralStart(this.minimalCombatant(rhs), 40);
      } else {
        line += ' '.repeat(40);
      }
      partyDisplay += line + '\n';

      // traits / statuses
      const ignoreStatuses = ['humanoid']
      let lhsStatuses = [
        ...(lhs?.activeEffects || []),
        // ...(lhs?.passiveEffects?.filter(e => (e.equipment)) || [])
      ].map(e => e.duration ? `${e.name}(${e.duration})` : e.name)
        || [];
      // console.log("Rendering statuses for line", i, lhsStatuses);
      lhsStatuses = lhsStatuses
        .map(s => s.toLowerCase())
        .filter(s => !ignoreStatuses.includes(s.toLowerCase()));
      let rhsStatuses = rhs?.activeEffects?.map(e => e.duration ? `${e.name}(${e.duration})` : e.name)
        .concat(rhs?.traits || []) || [];
      rhsStatuses = rhsStatuses
        .map(s => s.toLowerCase())
        .filter(s => !ignoreStatuses.includes(s));

      const sep = // dot
        '·';
      let statusLine = "";
      if (lhsStatuses.length > 0) {
        statusLine += this.padLiteralEnd(Stylist.colorize(lhsStatuses.join(sep), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      if (rhsStatuses.length > 0) {
        statusLine += this.padLiteralStart(Stylist.colorize(rhsStatuses.join(sep), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      partyDisplay += statusLine + '\n';
    }
    const headers = //parties.map(p => Stylist.format(p.name, 'underline').padEnd(40)).join('   ') + '\n';
      Stylist.format(parties[0].name.padEnd(40), 'italic') +
      Stylist.format(parties[1]?.name.padStart(40) || '', 'italic') + '\n';
    return headers + partyDisplay;
  }

}