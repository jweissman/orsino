import Combat from "./Combat";
import Dungeoneer, { Dungeon } from "./Dungeoneer";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { Select } from "./types/Select";
import Choice from "inquirer/lib/objects/choice";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import Stylist from "./tui/Style";
import Words from "./tui/Words";
import Presenter from "./tui/Presenter";
import { Commands } from "./rules/Commands";

type TownSize = 'hamlet' | 'village' | 'town' | 'city' | 'metropolis' | 'capital';
type Race = 'human' | 'elf' | 'dwarf' | 'halfling' | 'gnome' | 'orc' | 'fae';

export interface Town {
  name: string;
  adjective: string;
  population: number;
  size: TownSize;
  deity: string;
  race: Race;
}

export interface CampaignModule {
  name: string;
  terrain: string;
  town: Town;
  dungeons: Dungeon[];
}

interface GameState {
  party: Combatant[];
  sharedGold: number;
  sharedPotions: number;
  completedDungeons: number[];
}

export class ModuleRunner {
  private roller: Roll; // (subject: Combatant, description: string, sides: number, dice: number) => Promise<RollResult>;
  private select: Select<any>;
  private prompt: (message: string) => string;

  private outputSink: (message: string) => void;
  private moduleGen: () => Promise<CampaignModule>;
  private state: GameState = {
    party: [],
    sharedGold: 100,
    sharedPotions: 3,
    completedDungeons: []
  };

  private gen: (type: GenerationTemplateType, options?: Record<string, any>) => any;

  activeModule: CampaignModule | null = null;

  constructor(options: Record<string, any> = {}) {
    this.roller = options.roller || Commands.roll;
    this.select = options.select || Combat.samplingSelect;
    this.prompt = options.prompt || ModuleRunner.randomInt;
    this.outputSink = options.outputSink || console.log;
    this.moduleGen = options.moduleGen || this.defaultModuleGen;
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });

    this.state.party = options.pcs || [];
  }

  get pcs() { return this.state.party; }
  get sharedGold() { return this.state.sharedGold; }
  get sharedPotions() { return this.state.sharedPotions; }
  get mod() { return this.activeModule!; }

  markDungeonCompleted(dungeonIndex: number) {
    if (!this.state.completedDungeons.includes(dungeonIndex)) {
      this.state.completedDungeons.push(dungeonIndex);
    }
  }

  get availableDungeons(): Dungeon[] {
    if (!this.activeModule) return [];
    return this.activeModule.dungeons.filter(d => !this.state.completedDungeons.includes(d.dungeonIndex!));
  }

  async run(dry = false) {
    if (this.pcs.length === 0) {
      throw new Error("No PCs provided!");
    }

    this.outputSink("Generating module, please wait...");
    this.activeModule = await this.moduleGen();
    this.outputSink(`Module "${this.activeModule.name}" generated: ${
      this.activeModule.terrain} terrain, ${this.activeModule.town.name} town, ${this.activeModule.dungeons.length} dungeons
    }`);
    // clear screen
    // this.outputSink("\x1Bc");
    this.outputSink(`Welcome to ${Stylist.bold(this.mod.name)}!`);

    await this.enter(dry);

    this.outputSink("\nThank you for playing!");
  }

  private async defaultModuleGen(): Promise<CampaignModule> {
    const module = {
      name: "The Lost City of Eldoria",
      terrain: "Jungle",
      town: {
        name: "Port Vesper",
        population: 5000,
        deity: "The Serpent Queen"
      },
      dungeons: [Dungeoneer.defaultGen()]
    }
    return module as CampaignModule;
  }

  async enter(dry = false, mod: CampaignModule = this.mod): Promise<void> {
    this.outputSink(`You arrive at the ${mod.town.adjective} ${Words.capitalize(mod.town.race)} ${mod.town.size} of ${Stylist.bold(mod.town.name)}.`);
    let days = 0;
    while (days++ < 60 && this.pcs.some(pc => pc.hp > 0)) {
      this.status(mod);
      this.outputSink(`\n--- Day ${days}/60 ---`);
      const action = await this.menu(dry);
      this.outputSink(`You chose to ${action}.`);

      if (action === "embark") {
        const dungeon = await this.selectDungeon();
        if (dungeon) {
          this.outputSink(`You embark on a Quest to the ${Stylist.bold(dungeon.dungeon_name)}...`);
          let dungeoneer = new Dungeoneer({
            roller: this.roller,
            select: this.select,
            outputSink: this.outputSink,
            dungeonGen: () => dungeon,
            gen: this.gen.bind(this),
            playerTeam: { name: "Player", combatants: this.pcs, healingPotions: this.sharedPotions },
          });
          await dungeoneer.run();  //dungeon, this.pcs);

          if (dungeoneer.winner === "Player") {
            console.log(Stylist.bold("\n🎉 Congratulations! You have cleared the dungeon " +
              Stylist.underline(dungeon.dungeon_name)
            + "! 🎉\n"));
            this.markDungeonCompleted(dungeon.dungeonIndex || 0);
          }

          this.state.sharedGold += dungeoneer.playerTeam.combatants
            .reduce((sum, pc) => sum + (pc.gp || 0), 0);

          this.state.sharedPotions = dungeoneer.playerTeam.healingPotions;

          // stabilize unconscious PC to 1 HP
          this.pcs.forEach(pc => {
            if (pc.hp <= 0) {
              pc.hp = 1;
              this.outputSink(`⚠️ ${pc.name} was stabilized to 1 HP!`);
            }
            const healAmount = Math.floor(pc.maxHp * 0.5);
            pc.hp = Math.max(1, Math.min(pc.maxHp, pc.hp + healAmount));
            this.outputSink(`💖 ${pc.name} recovers ${healAmount} HP after the adventure.`);
            pc.spellSlotsUsed = 0;
            pc.activeEffects = [];
          });
        } else {
          this.outputSink("No available dungeons to embark on! (" + this.availableDungeons.length + " still remain)");
          for (const dungeon of this.availableDungeons) {
            this.outputSink(` - ${dungeon.dungeon_name} (CR ${dungeon.intendedCr}): ${dungeon.rumor}`);
          }
        }
      } else if (action === "rest") {
        this.rest(this.pcs);
      } else if (action === "shop") {
        await this.shop();
      } else if (action === "rumors") {
        this.showRumors();
      } else if (action === "pray") {
        this.state.sharedGold -= 10;
        this.outputSink(`You pray to ${Words.capitalize(mod.town.deity)}.`);
        this.pcs.forEach(pc => {
          pc.activeEffects = pc.activeEffects || [];
          if (!pc.activeEffects.some(e => e.name === `Blessing of ${mod.town.deity}`)) {
            this.outputSink(`The priest blesses ${pc.name}.`);
            const blessing = { toHit: 1, initiative: 2 };
            const duration = 5;
            pc.activeEffects.push({
              name: `Blessing of ${mod.town.deity}`, duration, effect: blessing
            });
            this.outputSink(`${pc.name} gains ${
              Words.humanizeList(
                Object.entries(blessing).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
              )
            } for ${duration} turns!`)
          }
        });
      } else if (action === "show") {
        this.outputSink("\n📜 Party Records:")
        for (const pc of this.pcs) {
          // this.outputSink(`\n${Stylist.bold(pc.name)} -- ${Presenter.combatant(pc)}`);
          Presenter.printCharacterRecord(pc);
        }
      }
    }

    // if (this.pcs.every(pc => pc.hp <= 0)) {
    //   this.outputSink("Game over... but thanks for playing " + mod.name + "!");
    // } else {
    //   this.outputSink("Congratulations! You've completed the module: " + mod.name);
    // }
    this.outputSink(`\nGame over! You survived ${days} days in ${mod.name}.`);
  }

  static townIcons = {
    hamlet: "🏡",
    village: "🏘️",
    town: "🏰",
    city: "🏙️",
    metropolis: "🌆",
    capital: "🏛️",
  }

  async status(mod: CampaignModule = this.mod) {
    // let status = "";
    this.outputSink(`\nThe ${mod.town.adjective} ${Words.capitalize(mod.town.race)} ${mod.town.size} of ${ModuleRunner.townIcons[mod.town.size]}  ${Stylist.bold(mod.town.name)}`);
    this.outputSink(`(Pop.: ${mod.town.population.toLocaleString()})`);
    // this.outputSink(`\n🧙‍ Your Party:`);
    // this.pcs.forEach(pc => {
    //   this.outputSink(`  - ${Presenter.combatant(pc)} (${pc.gender} ${pc.background}, ${pc.age})`);
    // });
    // this.outputSink(`💰 Gold: ${this.sharedGold}g`);
    // this.outputSink(`🧪 Potions: ${this.sharedPotions}`);
  }

  private async menu(dry = false): Promise<string> {
    const available = this.availableDungeons;
    const options: Choice<any>[] = [
      { short: "Rest", value: "rest", name: "Visit the Inn (restore HP/slots)", disabled: this.pcs.every(pc => pc.hp === pc.maxHp) },
    ];

    if (!dry) {
      options.push(
        ...[
          { short: "Shop", value: "shop", name: "Visit the Alchemist (buy potions, 50g each)", disabled: this.sharedGold < 50 },
          { short: "Chat", value: "rumors", name: "Visit the Tavern (hear rumors about the region)", disabled: available.length === 0 },
          { short: "Pray", value: "pray", name: `Visit the Temple to ${Words.capitalize(this.mod.town.deity)}`, disabled: this.sharedGold < 10 },
          { short: "Show", value: "show", name: `Show Party Status/Character Records`, disabled: false },
        ]
      );
    }

    if (available.length > 0) {
      options.push({ short: "Seek", value: "embark", name: "⚔️ Embark on a Quest", disabled: available.length === 0 });
    } else {
      // options.push({ short: "Journey", value: "embark", name: "⚔️ Journey to the next region", disabled: false });
    }
    // console.log("Options:", options);

    return await this.select("What would you like to do?", options);
  }

  private rest(party: Combatant[]) {
    party.forEach(pc => {
      pc.hp = pc.maxHp;
      pc.spellSlotsUsed = 0;
      pc.activeEffects = []; // Clear status effects!
    });
    this.outputSink("💤 Your party rests and recovers fully.");
  }

  private async shop() {
    const input = await this.prompt("How many potions? (50g each)");
    this.outputSink(`You want to buy ${input} potions.`);
    const qty = isNaN(Number(input)) ? 0 : Number(input);
    const cost = qty * 50;
    this.outputSink(`You purchase ${qty} potions for ${cost}g.`);
    if (this.sharedGold >= cost) {
      this.state.sharedGold -= cost;
      this.state.sharedPotions += qty;
      this.outputSink(`✅ Purchased ${qty} potions for ${cost}g`);
    } else {
      this.outputSink("❌ Not enough gold!");
    }
  }

  private showRumors() {
    const available = this.availableDungeons;
    if (available.length === 0) {
      this.outputSink("You've cleared all known threats in the region!");
      return;
    }

    this.outputSink("\n📰 The tavern buzzes with rumors:");
    available.forEach(d => {
      this.outputSink(`  • ${d.rumor}`);
    });
  }

  private async selectDungeon(): Promise<Dungeon | null> {
    const available = this.availableDungeons;
    if (available.length === 0) return null;

    let reasonableCr = Math.round(2 * this.pcs.map(pc => pc.level).reduce((a, b) => a + b, 0) / this.pcs.length) + 2;
    // console.log(`(Reasonable CR for party level ${this.pcs.map(pc => pc.level).join(", ")} is approx. ${reasonableCr})`);
    // console.log("Available dungeons:");
    // available.forEach(d => {
    //   console.log(` - ${d.dungeon_name} (CR ${d.intendedCr}): ${d.intendedCr > reasonableCr ? Stylist.colorize("⚠️ Too difficult!", 'red') : '✓ Reasonable'}`);
    // });

    let options = available.map(d => ({
        short: d.dungeon_name,
        value: available.indexOf(d),
        name: `${d.dungeon_name} (${d.direction}, CR ${d.intendedCr})`,
        disabled: d.intendedCr > reasonableCr, // Disable if CR is too high
      }))
    const choice = await this.select("Which dungeon?", options);
    // console.log("Chosen dungeon index:", choice, available[choice].dungeon_name);

    return available[choice];
  }

  static async randomInt(_message: string): Promise<string> {
    return String(Math.floor(Math.random() * 100) + 1);
  }
}