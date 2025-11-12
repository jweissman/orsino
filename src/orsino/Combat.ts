import { Answers } from "inquirer";
import Choice from "inquirer/lib/objects/choice";
import Style from "./tui/Style";
import Deem from "../deem";

export interface Combatant {
  name: string;
  class?: string
  race?: string;
  forename: string;
  hp: number;
  maxHp: number;
  level: number;
  ac: number;
  str: number;
  dex: number;
  int: number;
  wis: number;
  cha: number;
  con: number;
  attackRolls: number;
  damageDie: number;
  playerControlled?: boolean;
  xp?: number;
  gp?: number;
  xpValue?: number;
  goldDrop?: string;
}

const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

const prettyCombatant = (combatant: Combatant, minimal = false) => {
  let colors = ['red', 'orange', 'green', 'green', 'green', 'green', 'blue'];
  const hpRatio = combatant.hp / combatant.maxHp;
  const hpBar = Style.prettyValue(combatant.hp, combatant.maxHp);
  const color = colors[Math.floor(hpRatio * (colors.length - 1))] || colors[0];

  if (minimal) {
    return `${Style.format(combatant.forename, 'bold')} ${Style.colorize(hpBar, color)} (${combatant.hp}/${combatant.maxHp}) [AC ${combatant.ac}]`;
  }

  const str = Style.colorize(Style.prettyValue(combatant.str, 20), 'red'); 
  const dex = Style.colorize(Style.prettyValue(combatant.dex, 20), 'yellow');
  const int = Style.colorize(Style.prettyValue(combatant.int, 20), 'green');
  const wis = Style.colorize(Style.prettyValue(combatant.wis, 20), 'blue');
  const cha = Style.colorize(Style.prettyValue(combatant.cha, 20), 'magenta');
  const con = Style.colorize(Style.prettyValue(combatant.con, 20), 'cyan');

  const stats = [str, dex, int, wis, cha, con].join('');

  let classInfo = combatant.class ? `, ${capitalize(combatant?.race || 'human')} ${capitalize(combatant.class)} ` : '';

  return `${Style.format(combatant.name, 'bold')}${classInfo} (${stats}, HP: ${Style.colorize(hpBar, color)} ${combatant.hp}/${combatant.maxHp})`;
}
export interface Team {
  name: string;
  combatants: Combatant[];
}

const prettyTeam = (team: Team) => {
  return `${Style.format(team.name, 'italic')} (${team.combatants.map(c => prettyCombatant(c)).join("; ")})`;
}

export type RollResult = {
  amount: number;
  description: string;
};
type Roll = (subject: Combatant, description: string, sides: number, dice: number) => Promise<RollResult>;

type Select<T extends Answers> = (prompt: string, options: Choice<T>[]) => Promise<T>;

type AttackResult = {
  success: boolean;
  damage: number;
  description: string;
};

class Fighting {
  static thac0(level: number): number {
    return 20 - Math.floor(level / 2);
  }

  static async attack(
    roll: Roll,
    attacker: Combatant,
    defender: Combatant,
    note: (message: string) => void = () => { }
  ): Promise<AttackResult> {
    note(`${prettyCombatant(attacker, true)} attacks ${prettyCombatant(defender, true)}... `);
    let description = `${attacker.name} attacks ${defender.name}... `;
    // const atkBonus = attacker.attackBonus || 0;
    const thac0 = this.thac0(attacker.level);
    const ac = defender.ac;
    const whatNumberHits = thac0 - ac;
    const attackRoll = await roll(attacker, `to attack (must roll ${whatNumberHits} or higher to hit)`, 20, 1); //.amount + (atkBonus || 0);
    description += ` (Attacker THAC0: ${thac0}, Defender AC: ${ac}, What number hits: ${whatNumberHits}). `;
    description += attackRoll.description;
    let success = attackRoll.amount >= whatNumberHits;
    if (attackRoll.amount === 0) {
      description += ` ${attacker.name} rolled a natural 1 and misses!`;
      note(`${attacker.name} rolled a natural 1 and misses!`);
      return {
        success: false,
        damage: 0,
        description
      };
    }

    let damage = 0;
    if (success) {
      let damageMultiplier = 1;
      if (attackRoll.amount >= 20) {
        damageMultiplier = 1.2;
        description += " Critical hit! ";
        note("Critical hit!");
      } else {
        description += " Attack hits! ";
        note("Attack hits!");
      }
      const attackRolls = await Promise.all(new Array(attacker.attackRolls).fill(0).map(() => roll(attacker, "for damage", attacker.damageDie, 1)));

      description += attackRolls.map(r => r.description).join(" ");
      let damage = attackRolls
        .map(r => r.amount)
        .reduce((sum: number, dmg: number) => sum + dmg, 0);

      damage = Math.max(1, Math.round(damage * damageMultiplier));
      if (damageMultiplier > 1) {
        note("Damage increased to " + damage + " for critical hit!");
        description += ` Damage multiplied by ${damageMultiplier} for critical hit!`;
      }
      defender.hp -= damage;
      note(`${attacker.name} hits ${defender.name} for ${damage} damage (now at ${defender.hp}).`);
      description += `\n*${attacker.name} hits ${defender.name} for ${damage} damage* (now at ${defender.hp}).`;
    } else {
      note(`${attacker.name} misses ${defender.name}.`);
      description += `\n*${attacker.name} misses ${defender.name}.*`;
    }

    return {
      success,
      damage,
      description
    };
  }
}

type CombatHistoryEntry = {
  turn: number;
  description: string;
};

export default class Combat {
  private turnNumber: number = 0;
  public winner: string | null = null;
  public teams: Team[] = []; // this.defaultTeams();

  private combatantsByInitiative: { combatant: any; initiative: number }[] = [];

  protected roller: Roll;
  protected select: Select<any>;
  protected journal: CombatHistoryEntry[] = [];
  protected outputSink: (message: string) => void;

  constructor(
    options: Record<string, any> = {},
  ) {
    this.roller = options.roller || this.autoroll;
    this.select = options.select || this.samplingSelect;
    this.outputSink = options.outputSink || console.debug;
    // this.note("Combatants engaged: " + this.teams.map(t => `${t.name} (${t.combatants.map(c => c.name).join(", ")})`).join(" vs. "));
  }

  async samplingSelect(prompt: string, options: Choice<any>[]): Promise<any> {
    return options[Math.floor(Math.random() * options.length)];
  }

  static defaultTeams(): Team[] {
    return [
      {
        name: "Player", combatants: [{
          forename: "Hero",
          name: "Hero",
          hp: 14, maxHp: 14, level: 1, ac: 10,
          dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
          attackRolls: 1,
          damageDie: 8, playerControlled: true, xp: 0, gp: 0
        }]
      },
      {
        name: "Enemy", combatants: [
          { forename: "Zok", name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3, str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10 },
          {
            forename: "Mog", name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3,
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10
           }
        ]
      }
    ];
  }

  protected note(message: string) {
    this.journal.push({ turn: this.turnNumber, description: message });
    this.outputSink(message);
  }

  private async determineInitiative(): Promise<{ combatant: any; initiative: number }[]> {
    let initiativeOrder = await Promise.all(this.allCombatants.map(async c => {
      const initiative = (await this.roller(c, "for initiative", 20, 1)).amount + Math.round((c.dex - 10) / 2);
      // this.note(`${c.name} rolls initiative: ${initiative}`);
      return ({ combatant: c, initiative })
    }));
    return initiativeOrder.sort((a, b) => b.initiative - a.initiative);
  }

  get allCombatants() {
    return this.teams.flatMap(team => team.combatants);
  }

  static rollDie(subject: Combatant, description: string, sides: number, dice: number): RollResult {
    let result = Math.floor(Math.random() * sides) + 1;
    let rollDescription = `_${subject.name} rolls ${dice}d${sides} ${description} and got a ${result}._`;
    return { amount: result, description: rollDescription };
  }

  autoroll = async (subject: Combatant, description: string, sides: number, dice: number) => {
    let result = Combat.rollDie(subject, description, sides, dice);
    this.note("\r" + result.description);
    return result;
  }

  living(combatants: Combatant[] = this.allCombatants): Combatant[] {
    return combatants.filter(c => c.hp > 0);
  }

  weakest(combatants: Combatant[] = this.living(this.allCombatants)): Combatant {
    return this.living(combatants).reduce((weakest, current) => {
      return current.hp < weakest.hp ? current : weakest;
    }, this.living(combatants)[0]);
  }

  async setUp(
    teams = Combat.defaultTeams()
  ): Promise<string> {
    // console.log('Setting up combat for teams:', teams);
    this.turnNumber = 0;
    this.winner = null;
    this.teams = teams;

    this.combatantsByInitiative = await this.determineInitiative();
    return (`Combat starts! Initiative order: ${this.combatantsByInitiative.map(c => `${c.combatant.name} (Initiative: ${c.initiative})`).join(", ")}`);
  }

  async nextTurn(roll = this.roller) {
    if (this.isOver()) {
      throw new Error('Combat is already over');
    }
    this.turnNumber++;
    let description = `Turn ${this.turnNumber}:\n`;
    this.note(`\n==== Turn ${this.turnNumber} ==== `);
    this.note(`Combatants: ${this.teams.map(t => `${t.name} (${this.living(t.combatants).map(c => `${c.name} (HP: ${c.hp}/${c.maxHp})`).join(", ")})`).join(" vs. ")}`);
    for (const { combatant } of this.combatantsByInitiative) {
      if (combatant.hp <= 0) continue; // Skip defeated combatants
      const targets = this.teams.find(team => team.combatants.includes(combatant)) === this.teams[0] ? (this.teams[1].combatants) : (this.teams[0].combatants);
      let validTargets = this.living(targets);
      let target = this.weakest(validTargets);
      if (combatant.playerControlled && validTargets.length > 1) {
        const targetOptions: Choice<Combatant>[] = validTargets.map(t => ({ name: t.name, short: t.forename.substring(0, 8), description: `${t.name} (HP: ${t.hp}/${t.maxHp})`, value: t, disabled: false }));
        target = (await this.select(`Select target for ${combatant.name}:`, targetOptions)); //.value;
        if (target?.value) { target = target.value; }
        // this.note(`${combatant.name} chooses ${target.name}.`);
      }

      // this.note(`${combatant.name} targets ${target.name}.`);
      const result = await Fighting.attack(roll, combatant, target, this.note.bind(this));
      // this.note(result.description);
      description += `\n${result.description} `;
      if (target.hp <= 0) {
        description += `\n${target.name} is defeated! `;
        this.note(`${target.name} falls unconscious!`);
        if (this.living(this.teams[0].combatants).length === 0 || this.living(this.teams[1].combatants).length === 0) {
          // description += `\nCombat ends! No more targets available.`;
          break;
        }
      }
    }
    for (const team of this.teams) {
      if (team.combatants.every((c: any) => c.hp <= 0)) {
        this.winner = team === this.teams[0] ? this.teams[1].name : this.teams[0].name;
        description += `\n${this.winner} wins the combat!`;
        this.note("Combat ends! " + this.winner + " wins.");
        break;
      }
    }
    // console.log(description);
    // this.note(description);
    return { number: this.turnNumber, description };
  }

  isOver() {
    return this.winner !== null;
  }
}

export class Gauntlet {
  roller: Roll;
  select: Select<any>;
  outputSink: (message: string) => void;

  constructor(options: Record<string, any> = {}) {
    this.roller = options.roller;
    this.select = options.select;
    this.outputSink = options.outputSink || console.debug;
  }

  static async singleCombat(
    roller: Roll,
    combat: Combat,
    teams: Team[] = Combat.defaultTeams()
  ) {
    const initOrder = await combat.setUp(teams);
    console.log(initOrder);
    while (!combat.isOver()) {
      await combat.nextTurn(roller);
    }
  }

  xpForLevel(level: number): number { return (level * level * 125); }

  async run(
    options: Record<string, any> = {}
  ) {
    let playing = true;
    const teams: Team[] = options.teams || Combat.defaultTeams();
    if (options.pcs) {
      teams[0].combatants = options.pcs;
      teams[0].combatants.forEach(c => c.playerControlled = true);
      console.log('Player characters:', teams[0].combatants.map(c => prettyCombatant(c)).join(", "));
    }
    
    const combat = new Combat({
      ...options,
      select: this.select,
      roller: this.roller,
      outputSink: this.outputSink
    });
    while (playing) {
      let encounter = null;
      if (options.encounterGen) {
        let cr = Math.max(1, Math.round(teams[0].combatants.reduce((sum, c) => sum + c.level, 0)));
        let encounter = await options.encounterGen(cr);
        console.log('Encounter generated with actual CR', encounter.cr, " (target was " + cr + ") and gold bonus", encounter.bonusGold);
        teams[1].combatants = encounter.monsters;
      } else {
        teams.forEach(team => team.combatants.forEach(c => {
          if (!c.playerControlled) {
            c.hp = c.maxHp;
          }
        })); // reset HP for non-player combatants
      }
      this.outputSink(`\rYou encounter ${teams[1].name} (${teams[1].combatants.map(
        c => prettyCombatant(c, false)
      ).join("; ")})!\n\n`);
      await Gauntlet.singleCombat(this.roller, combat, teams);
      if (combat.winner === "Player") {
        const xpBonus = teams[1].combatants.reduce((sum, c) => sum + ((c?.xpValue || 1) * 10), 0);
        const goldDrop = teams[1].combatants.reduce((sum, c) => sum + ((Number(Deem.evaluate(c.goldDrop || "1d4"))) || 0), 0) + (encounter?.bonusGold || 0);

        this.outputSink("You win the combat! You gain " + xpBonus + " XP and " + goldDrop + " GP.");
        const playerCombatants = combat.teams[0].combatants.filter(c => c.playerControlled);
        for (const c of playerCombatants) {
          c.xp ||= 0;
          c.xp += Math.round(xpBonus / playerCombatants.length);
          c.gp ||= 0;
          c.gp += Math.round(goldDrop / playerCombatants.length);

          let nextLevelXp = //(c.level * c.level * 25) + 25;
            this.xpForLevel(c.level + 1);

          if (c.xp < nextLevelXp) {
            this.outputSink(`${c.name} needs to gain ${nextLevelXp - c.xp} more experience for level ${c.level + 1} (currently at ${c.xp}/${nextLevelXp}).`);
          }
          while (c.xp >= nextLevelXp) {
            c.level++;
            nextLevelXp = this.xpForLevel(c.level + 1);
            c.maxHp += 1;
            c.hp = c.maxHp;
            this.outputSink(`${c.name} leveled up to level ${c.level}!`);
            const stat = await this.select(`Level up! ${c.name} is now level ${c.level}. Choose a stat to increase:`, [
              { disabled: false, name: `Strength (${c.str})`, value: 'str', short: 'STR' },
              { disabled: false, name: `Dexterity (${c.dex})`, value: 'dex', short: 'DEX' },
              { disabled: false, name: `Intelligence (${c.int})`, value: 'int', short: 'INT' },
              { disabled: false, name: `Wisdom (${c.wis})`, value: 'wis', short: 'WIS' },
              { disabled: false, name: `Charisma (${c.cha})`, value: 'cha', short: 'CHA' },
              { disabled: false, name: `Constitution (${c.con})`, value: 'con', short: 'CON' },
            ]);
              c[stat] += 1;
              this.outputSink(`${c.name}'s ${stat.toUpperCase()} increased to ${c[stat]}!`);
          } 
        }
        console.log(`
          Your team is victorious! Your current status is:
          ${combat.allCombatants.filter(c => c.playerControlled)
                                .map(c => ` - ${prettyCombatant(c)} (Level: ${c.level}, XP: ${c.xp}, GP: ${c.gp})`)
                                .join("\n          ")}. 
          Do you wish to continue playing? (y/n)
        `);
        const answer = await new Promise<string>((resolve) => {
          process.stdin.resume();
          process.stdin.once('data', (data) => {
            resolve(data.toString().trim().toLowerCase());
          });
        });
        if (answer !== 'y') {
          playing = false;
        }
        // random chance to discover 10 hp potion
        if (Math.random() < 0.5) {
          console.log('You found a health potion!');
          teams.forEach(team => team.combatants.forEach(c => {
            if (c.playerControlled) {
              c.hp = Math.min(c.maxHp, c.hp + 10);
              console.log(`Healing ${c.name} for 10 HP (HP: ${c.hp}/${c.maxHp})`);
            }
          }));
        }
      } else {
        playing = false;
        console.warn('You lost the combat. Better luck next time!');
      }
    }
  }
}