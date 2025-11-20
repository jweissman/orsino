import Deem from "../deem";
import Combat from "./Combat";
import Presenter from "./tui/Presenter";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { Select } from "./types/Select";
import { Team } from "./types/Team";


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
    combat: Combat,
    teams: Team[] = Combat.defaultTeams()
  ) {
    await combat.setUp(teams);
    while (!combat.isOver()) {
      await combat.round();
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
        // const goldDrop = teams[1].combatants.reduce((sum, c) => sum + ((Number(Deem.evaluate(String(c.gp) || "1d4"))) || 0), 0); // + (encounter?.bonusGold || 0);
        let goldDrop = 0;
        for (const c of teams[1].combatants) {
          const monsterGold = await Deem.evaluate(String(c.gp) || "1d4");
          goldDrop += monsterGold;
        }
        // goldDrop += encounter?.bonusGold || 0;

        this.outputSink("You win the combat! You gain " + xpBonus + " XP and " + goldDrop + " GP.");
        const playerCombatants = combat.teams[0].combatants.filter(c => c.playerControlled);
        // random chance to discover 10 hp potion
        if (Math.random() < 0.5) {
          this.outputSink('You found a health potion!');
          combat.teams[0].healingPotions += 1;
        }
        for (const c of playerCombatants) {
          c.xp ||= 0;
          c.xp += Math.round(xpBonus / playerCombatants.length);
          c.gp ||= 0;
          c.gp += Math.round(goldDrop / playerCombatants.length);

          let nextLevelXp = //(c.level * c.level * 25) + 25;
            Gauntlet.xpForLevel(c.level + 1);

          if (c.xp < nextLevelXp) {
            this.outputSink(`${c.name} needs to gain ${nextLevelXp - c.xp} more experience for level ${c.level + 1} (currently at ${c.xp}/${nextLevelXp}).`);

          }
          while (c.xp >= nextLevelXp) {
            c.level++;
            nextLevelXp = Gauntlet.xpForLevel(c.level + 1);
            c.maxHp += 1;
            c.hp = c.maxHp;
            this.outputSink(`${c.name} leveled up to level ${c.level}!`);
            const stat: keyof Combatant = await this.select(`Level up! ${c.name} is now level ${c.level}. Choose a stat to increase:`, [
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
            .map(c => ` - ${Presenter.combatant(c)} (Level: ${c.level}, XP: ${c.xp}, GP: ${c.gp})`)
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
