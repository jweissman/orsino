import Choice from "inquirer/lib/objects/choice";
import Deem from "../deem";
import { Select } from "./types/Select";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";

export type RollResult = {
  amount: number;
  description: string;
};
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
    return options[Math.floor(Math.random() * options.length)].value;
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
          damageDie: 8, playerControlled: true, xp: 0, gp: 0,
          weapon: "Short Sword"
        }]
      },
      {
        name: "Enemy", combatants: [
          { forename: "Zok", name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3, str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger" },
          {
            forename: "Mog", name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3,
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger"
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

  async pcTurn(combatant: Combatant, validTargets: Combatant[]): Promise<string> {
    let description = `${combatant.name}'s turn. `;
    // Player chooses action
    const action = await this.select(
      `Your turn, ${Presenter.combatant(combatant)} - what do you do?`,
      [
        { disabled: false, short: "Attack!", name: "⚔️  Attack", value: "attack" },
        { disabled: false, short: "Defend", name: "🛡️  Defend (gain +4 AC until your next turn)", value: "defend" },
        { disabled: false, short: "First Aid", name: "🩹 First Aid (heal 1d4+1 HP to self or ally)", value: "heal" },
      ]
    );

    combatant.turnBonus = combatant.turnBonus || {};
    console.log('Action chosen:', action);
    switch (action) {
      case "attack":
        // this.note(`${combatant.name} prepares to attack... (${validTargets.length} valid targets)`);
        description += await this.pcAttacks(combatant, validTargets);
        break;
      case "defend":
        description += `${combatant.name} takes a defensive stance, gaining +4 AC until their next turn.`;
        combatant.turnBonus = { ac: -4 };
        break;
      case "heal":
        // this.note(`${combatant.name} prepares to heal...`);
        description += await this.pcHeal(combatant);
        break;
    }
    return description;
  }

  async pcHeal(combatant: Combatant): Promise<string> {
    let description = `${combatant.name} uses First Aid. `;
    // this.note(`${combatant.name} prepares to heal...`);
    const healAmount = Combat.rollDie(combatant, "for healing", 4, 1).amount + 1;
    let validTargets = this.living(this.teams[0].combatants);
    if (validTargets.length > 1) {
      const targetOptions: Choice<Combatant>[] = validTargets.map(t => ({ name: t.name, short: t.forename.substring(0, 8), description: `${t.name} (HP: ${t.hp}/${t.maxHp})`, value: t, disabled: false }));
      let target = (await this.select(`Select target for healing:`, targetOptions)); //.value;

      // somehow we were getting a Choice object instead of the value, so added this check
      // if (target?.value) { target = target.value; }
      target.hp = Math.min(target.maxHp, target.hp + healAmount);
      description += `${target.name} heals for ${healAmount} HP (HP: ${target.hp}/${target.maxHp}).`;
      this.note(`${target.name} healed for ${healAmount} HP (HP: ${target.hp}/${target.maxHp}).`);
    } else {
      let target = validTargets[0];
      target.hp = Math.min(target.maxHp, target.hp + healAmount);
      description += `${target.name} heals for ${healAmount} HP (HP: ${target.hp}/${target.maxHp}).`;
      this.note(`${target.name} healed for ${healAmount} HP (HP: ${target.hp}/${target.maxHp}).`);
    }

    return description;
  }

  async pcAttacks(combatant: Combatant, validTargets: Combatant[]): Promise<string> {
    let description = `${combatant.name} attacks. `;
    // this.note(`${combatant.name} prepares to attack... (${validTargets.length} valid targets)`);
    let target = this.weakest(validTargets);
    if (validTargets.length > 1) {
      const targetOptions: Choice<Combatant>[] = validTargets.map(t => ({ name: t.name, short: t.forename.substring(0, 8), description: `${t.name} (HP: ${t.hp}/${t.maxHp})`, value: t, disabled: false }));
      target = (await this.select(`Select target for ${combatant.name}:`, targetOptions)); //.value;

      // somehow we were getting a Choice object instead of the value, so added this check
      // if (target?.value) { target = target.value; }
    }
    const turnDescription = await Fighting.attack(this.roller, combatant, target, this.note.bind(this));
    description += turnDescription;
    if (target.hp <= 0) {
      description += `\n${target.name} is defeated! `;
      this.note(`${target.name} falls unconscious!`);
    }
    return description;
  }

  async turn(combatant: Combatant): Promise<string> {
    let description = `${combatant.name}'s turn. `;
    const targets = this.teams.find(team => team.combatants.includes(combatant)) === this.teams[0] ? (this.teams[1].combatants) : (this.teams[0].combatants);

    let validTargets = this.living(targets);
    if (validTargets.length === 0) {
      return description + "No valid targets.";
    }

    if (combatant.playerControlled) {
      description += await this.pcTurn(combatant, validTargets);
    } else {
      let target = this.weakest(validTargets);
      const turnDescription = await Fighting.attack(this.roller, combatant, target, this.note.bind(this));
      description += turnDescription;
      if (target.hp <= 0) {
        description += `\n${target.name} is defeated! `;
        this.note(`${target.name} falls unconscious!`);
      }
    }

    return description;
  }

  async nextTurn() { //}_roll = this.roller) {
    if (this.isOver()) {
      throw new Error('Combat is already over');
    }
    this.turnNumber++;
    let description = `Turn ${this.turnNumber}:\n`;
    this.note(`\n==== Turn ${this.turnNumber} ==== `);
    this.note(`Combatants: ${this.teams.map(t => `${t.name} (${this.living(t.combatants).map(c => `${c.name} (HP: ${c.hp}/${c.maxHp})`).join(", ")})`).join(" vs. ")}`);
    for (const { combatant } of this.combatantsByInitiative) {
      if (combatant.hp <= 0) continue; // Skip defeated combatants
      const turnDescription = await this.turn(combatant);
      description += turnDescription + "\n";
      // this.note(turnDescription);
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
    // roller: Roll,
    combat: Combat,
    teams: Team[] = Combat.defaultTeams()
  ) {
    const initOrder = await combat.setUp(teams);
    console.log(initOrder);
    while (!combat.isOver()) {
      await combat.nextTurn() //roller);
    }
  }

  static xpForLevel(level: number): number {
    return (level * level * 125) + (level * 25) - 500;
  }
  static crForParty(party: Combatant[]): number {
    const totalLevels = party.reduce((sum, c) => sum + c.level, 0);
    return Math.max(1, Math.round(totalLevels / 3));
  }

  async run(
    options: Record<string, any> = {}
  ) {
    let playing = true;
    const teams: Team[] = options.teams || Combat.defaultTeams();
    if (options.pcs) {
      teams[0].combatants = options.pcs;
      teams[0].combatants.forEach(c => c.playerControlled = true);
      console.log('Player characters:', teams[0].combatants.map(c => Presenter.combatant(c)).join(", "));
    }

    const combat = new Combat({
      ...options,
      select: this.select,
      roller: this.roller,
      outputSink: this.outputSink
    });
    while (playing) {
      let encounter: Record<string, any> | null = null;
      if (options.encounterGen) {
        let cr = Gauntlet.crForParty(teams[0].combatants);
        //Math.max(1, Math.round(teams[0].combatants.reduce((sum, c) => sum + c.level, 0)));
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
        c => Presenter.combatant(c, false)
      ).join("; ")})!\n\n`);
      await Gauntlet.singleCombat(combat, teams);
      if (combat.winner === "Player") {
        const xpBonus = teams[1].combatants.reduce((sum, c) => sum + ((c?.xp || 1) * 10), 0);
        const goldDrop = teams[1].combatants.reduce((sum, c) => sum + ((Number(Deem.evaluate(String(c.gp) || "1d4"))) || 0), 0); // + (encounter?.bonusGold || 0);

        this.outputSink("You win the combat! You gain " + xpBonus + " XP and " + goldDrop + " GP.");
        const playerCombatants = combat.teams[0].combatants.filter(c => c.playerControlled);
        // random chance to discover 10 hp potion
        if (Math.random() < 0.5) {
          console.log('You found a health potion!');
          // teams.forEach(team => team.combatants.forEach(c => {
          // if (c.playerControlled) {
          playerCombatants.forEach(c => {
            c.hp = Math.min(c.maxHp, c.hp + 10);
            console.log(`Healing ${c.name} for 10 HP (HP: ${c.hp}/${c.maxHp})`);
          });
          // }
          // }));
        }
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
            // @ts-ignore
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

      } else {
        playing = false;
        console.warn('You lost the combat. Better luck next time!');
      }
    }
  }
}