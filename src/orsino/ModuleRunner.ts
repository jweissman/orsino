import Combat from "./Combat";
import Dungeoneer, { Dungeon } from "./Dungeoneer";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { Select } from "./types/Select";
import Choice from "inquirer/lib/objects/choice";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import Stylist from "./tui/Style";
import Words from "./tui/Words";

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
  private moduleGen: () => CampaignModule;
  private state: GameState = {
    party: [],
    sharedGold: 100,
    sharedPotions: 3,
    completedDungeons: []
  };

  private gen: (type: GenerationTemplateType, options?: Record<string, any>) => any;

  activeModule: CampaignModule | null = null;

  constructor(options: Record<string, any> = {}) {
    this.roller = options.roller || Combat.rollDie;
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

  async run() {
    if (this.pcs.length === 0) {
      throw new Error("No PCs provided!");
    }

    this.outputSink("Generating module, please wait...");
    this.activeModule = this.moduleGen();
    // clear screen
    // this.outputSink("\x1Bc");
    this.outputSink(`Welcome to ${Stylist.bold(this.mod.name)}!`);

    await this.enter();
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

  async enter(mod: CampaignModule = this.mod): Promise<void> {
    let days = 0;
    while (days++ < 30 && this.pcs.some(pc => pc.hp > 0)) {
      this.status(mod);
      this.outputSink(`\n--- Day ${days}/30 ---`);
      const action = await this.menu();
      // this.outputSink(`You chose to ${action}.`);

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
            playerTeam: { name: "War Party", combatants: this.pcs, healingPotions: this.sharedPotions },
          });
          await dungeoneer.run();  //dungeon, this.pcs);
          this.markDungeonCompleted(dungeon.dungeonIndex || 0);

          this.state.sharedGold += dungeoneer.playerTeam.combatants
            .reduce((sum, pc) => sum + (pc.gp || 0), 0);

          this.state.sharedPotions = dungeoneer.playerTeam.healingPotions;

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
            this.outputSink(`The priest blesses ${pc.name}. You gain +1 to hit, 2 AC and +3 initiative for the next 10 turns.`);
            pc.activeEffects.push({
              name: `Blessing of ${mod.town.deity}`, duration: 10, effect: { toHit: 1, ac: -2, initiative: 3 }
            });
          }
        });
      }
    }

    if (this.pcs.every(pc => pc.hp <= 0)) {
      this.outputSink("Game over... but thanks for playing " + mod.name + "!");
    } else {
      this.outputSink("Congratulations! You've completed the module: " + mod.name);
    }
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
    this.outputSink(`\n🧙‍ Your Party:`);
    this.pcs.forEach(pc => {
      this.outputSink(`  ${pc.name}: Level ${pc.level} ${pc.race} ${pc.class}, ${pc.hp}/${pc.maxHp} HP`);
    });
    this.outputSink(`💰 Gold: ${this.sharedGold}g`);
    this.outputSink(`🧪 Potions: ${this.sharedPotions}`);
  }

  private async menu(): Promise<string> {
    const available = this.availableDungeons;
    const options: Choice<any>[] = [
      { short: "Rest", value: "rest",   name: "Visit the Inn (restore HP/slots)", disabled: this.pcs.every(pc => pc.hp === pc.maxHp) },
      { short: "Shop", value: "shop",   name: "Visit the Alchemist (buy potions, 50g each)", disabled: this.sharedGold < 50 },
      { short: "Chat", value: "rumors", name: "Visit the Tavern (hear rumors about the region)", disabled: available.length === 0 },
      { short: "Pray", value: "pray",   name: `Visit the Temple to ${Words.capitalize(this.mod.town.deity)}`, disabled: this.sharedGold < 10 },
    ];

    if (available.length > 0) {
      options.push({ short: "Seek", value: "embark", name: "⚔️ Embark on a Quest", disabled: false });
    }

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

    const choice = await this.select(
      "Which dungeon?",
      available.map(d => ({
        short: d.dungeon_name,
        value: d.dungeonIndex,
        name: `${d.dungeon_name} (${d.direction}, CR ${d.intendedCr})`,
        disabled: this.state.completedDungeons.includes(d.dungeonIndex!)
          || d.intendedCr > Math.round(this.pcs.map(pc => pc.level).reduce((a, b) => a + b, 0) + 5), // Disable if CR is too high
      }))
    );

    return available[choice];
  }

  static async randomInt(_message: string): Promise<string> {
    return String(Math.floor(Math.random() * 100) + 1);
  }
}