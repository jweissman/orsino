export type PlaygroundType = "combat";

export interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  ac: number;
  dex: number;
  attackRolls: number;
  damageDie: number;
  playerControlled?: boolean;
  xp?: number;
  gp?: number;
}

export interface Team {
  name: string;
  combatants: Combatant[];
}

export type RollResult = {
  amount: number;
  description: string;
};
type Roll = (subject: Combatant, description: string, sides: number, dice: number) => Promise<RollResult>;

type AttackResult = {
  success: boolean;
  damage: number;
  description: string;
};

const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

class Fighting {
  static thac0(level: number): number {
    return 20 - Math.floor(level / 2);
  }

  static async attack(
    roll: Roll,
    attacker: any,
    defender: any,
    note: (message: string) => void = () => {}
  ): Promise<AttackResult> {
    note(`${attacker.name} attacks ${defender.name}... `);
    let description = `${attacker.name} attacks ${defender.name}... `;
    // const atkBonus = attacker.attackBonus || 0;
    const thac0 = this.thac0(attacker.level);
    const ac = defender.ac;
    const whatNumberHits = thac0 - ac;
    const attackRoll = await roll(attacker, `to attack (must roll ${whatNumberHits} or higher to hit)`, 20, 1); //.amount + (atkBonus || 0);
    description += ` (Attacker THAC0: ${thac0}, Defender AC: ${ac}, What number hits: ${whatNumberHits}). `;
    description += attackRoll.description;
    let success = attackRoll.amount + 1 >= whatNumberHits;
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
      // const attackRolls = new Array(attacker.attackRolls).fill(0).map(() => roll(attacker, "for damage", attacker.damageDie, 1)).map(p => p.then(r => r));
      const attackRolls = await Promise.all(new Array(attacker.attackRolls).fill(0).map(() => roll(attacker, "for damage", attacker.damageDie, 1)));

      description += attackRolls.map(r => r.description).join(" ");
      let damage = attackRolls
        .map(r => r.amount)
        .reduce((sum: number, dmg: number) => sum + dmg, 0);

      damage = 1 + Math.round(damage * damageMultiplier);
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
  protected journal: CombatHistoryEntry[] = [];
  protected outputSink: (message: string) => void;

  constructor(
    options: Record<string, any> = {},
  ) {
    this.roller = options.roller || this.autoroll;
    this.outputSink = options.outputSink || console.debug;
    this.note("Combatants engaged: " + this.teams.map(t => `${t.name} (${t.combatants.map(c => c.name).join(", ")})`).join(" vs. "));
  }

  static defaultTeams(): Team[] {
    return [
      {
        name: "Player", combatants: [{
          name: "Hero", hp: 14, maxHp: 14, level: 1, ac: 10, dex: 11, attackRolls: 1,
          damageDie: 8, playerControlled: true, xp: 0, gp: 0
        }]
      },
      {
        name: "Enemy", combatants: [
          { name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, dex: 12, attackRolls: 2, damageDie: 3 },
          { name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, dex: 12, attackRolls: 2, damageDie: 3 }
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
    this.note(result.description);
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
    this.turnNumber = 0;
    this.winner = null;
    this.teams = teams; // this.defaultTeams();

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
      const target = this.weakest(this.living(targets));
      // this.note(`${combatant.name} targets ${target.name}.`);
      const result = await Fighting.attack(roll, combatant, target, this.note.bind(this));
      // this.note(result.description);
      description += `\n${result.description} `;
      if (target.hp <= 0) {
        description += `\n${target.name} is defeated! `;
        this.note(`${target.name} is defeated!`);
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