import Dungeoneer, { Dungeon } from "./Dungeoneer";
import Events, { ModuleEvent } from "./Events";
import Presenter from "./tui/Presenter";
import Shop from "./campaign/Shop";
import Stylist from "./tui/Style";
import Tavern from "./campaign/Tavern";
import Temple from "./campaign/Temple";
import TownFeature from "./campaign/TownFeature";
import Words from "./tui/Words";
import { Combatant } from "./types/Combatant";
import { Commands } from "./rules/Commands";
import { Driver, NullDriver } from "./Driver";
import { Fighting } from "./rules/Fighting";
import { GameState, GameStateReducer, newGameState } from "./types/GameState";
import { GeneratedValue, GeneratorOptions } from "./Generator";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import { Inventory } from "./Inventory";
import { ItemInstance } from "./types/ItemInstance";
import { Roll } from "./types/Roll";
import { StatusModifications } from "./Status";

type TownSize = 'hamlet' | 'village' | 'town' | 'city' | 'metropolis' | 'capital';
type Race = 'human' | 'elf' | 'dwarf' | 'halfling' | 'gnome' | 'orc' | 'fae';

export interface Deity {
  name: string;
  domain: string;
  blessing: StatusModifications;
  forename: string;
  gender: "male" | "female";
  title: string;
}

export interface Town {
  tavern: { hirelings: Combatant[] };
  townName: string;
  translatedName: string;
  adjective: string;
  population: number;
  size: TownSize;
  deity: Deity;
  race: Race;
}

export interface CampaignModule {
  name: string;
  plane: string;
  terrain: string;
  weather: string;
  town: Town;
  dungeons: Dungeon[];
  globalEffects?: StatusModifications;
}


type RunnerOptions = {
  roller?: Roll;
  driver?: Driver;
  moduleGen?: (options?: GeneratorOptions) => CampaignModule;
  pcs?: Combatant[];
  gen?: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue | GeneratedValue[];
  inventory?: ItemInstance[];
}

export class ModuleRunner {
  static configuration = {
    sharedGold: 10000
  }

  private roller: Roll;
  private driver: Driver;
  private moduleGen: (options?: GeneratorOptions) => CampaignModule;
  private readonly gameState: GameState;

  private gen: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue | GeneratedValue[];

  journal: ModuleEvent[] = [];

  get activeModule(): CampaignModule {
    return this.gameState.campaignModule;
  }

  constructor(options: RunnerOptions = {}) {
    this.roller = options.roller || Commands.roll.bind(Commands);
    this.driver = options.driver || new NullDriver();
    this.moduleGen = options.moduleGen || this.defaultModuleGen.bind(this);
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });

    const initialModule = this.moduleGen();
    console.warn(`Initial module "${initialModule.name}" generated.`);

    this.gameState = newGameState({
      ...ModuleRunner.configuration,
      party: options.pcs || [],
      inventory: options.inventory || [],
      mod: initialModule
    });
  }

  protected clear(): void { this.driver.clear(); }
  protected _outputSink(message: string): void { this.driver.writeLn(message); }
  protected async pause(message: string) { await this.driver.pause(message); }
  protected async select<T>(message: string, choices: (readonly string[] | readonly { name: string; value: T; disabled?: boolean; short: string }[])): Promise<T> {
    return this.driver.select(message, choices);
  }

  get pcs() { return this.gameState.party; }
  get sharedGold() { return this.gameState.sharedGold; }
  get mod(): CampaignModule {
    if (!this.activeModule) {
      throw new Error("No active module!");
    }
    return this.activeModule;
  }

  get inventory() { return this.gameState.inventory; }
  get state() { return this.gameState; }

  private note(message: string): void {
    this._outputSink(message);
  }

  protected async emit(event: ModuleEvent) {
    this.journal.push(event);
    this.note(await Events.present(event));
    // @ts-expect-error -- dynamic update of game state based on event type
    this.gameState = GameStateReducer.processEvent(this.state, event);

    await Events.appendToLogfile(event);
  }

  markDungeonCompleted(dungeonIndex: number) {
    if (!this.state.completedDungeons.includes(dungeonIndex)) {
      this.state.completedDungeons.push(dungeonIndex);
    }
  }

  get availableDungeons(): Dungeon[] {
    if (!this.activeModule) { return []; }
    return this.activeModule.dungeons.filter(d => d.dungeonIndex && !this.state.completedDungeons.includes(d.dungeonIndex));
  }

  gatherStartingGear(pc: Combatant): ItemInstance[] {
    const itemNames: string[] = pc.startingGear || [];
    const items: ItemInstance[] = [];
    for (const itemName of itemNames) {
      const item = { ...Inventory.genLoot(itemName), ownerId: pc.id, ownerSlot: 'backpack' };
      item.shared = item.itemClass === 'consumable';
      items.push(item);
    }
    return items;
  }

  async run(dry = false) {
    if (this.pcs.length === 0) {
      throw new Error("No PCs provided!");
    }

    // give initial gold to party
    this.state.sharedGold += this.pcs.reduce((sum, pc) => sum + (pc.gp || 0), 0);

    // gather inventory from PC starting gear
    for (const pc of this.pcs) {
      pc.gp = 0;
      const items = this.gatherStartingGear(pc);
      this.state.inventory.push(...items);
    }

    await this.emit({
      type: "campaignStart",
      pcs: this.pcs,
      at: new Date().toISOString(),
      day: 0
    });


    let playing = true;
    let moduleOptions = {};
    while (playing) {
      const { newModuleOptions } = await this.runModule(dry);
      if (newModuleOptions !== null) {
        moduleOptions = newModuleOptions;
        this.gameState.campaignModule = this.moduleGen(moduleOptions);
      } else {
        playing = false;
      }
    }
  }

  private async runModule(dry = false): Promise<{ newModuleOptions: GeneratorOptions | null }> {
    if (!this.activeModule) {
      throw new Error("No active module at runModule time!");
    }

    // clear out any existing globals
    this.pcs.forEach(pc => {
      pc.passiveEffects = pc.passiveEffects || [];
      pc.passiveEffects = pc.passiveEffects?.filter(e => !e.planar);
      if (this.activeModule.globalEffects) {
        pc.passiveEffects.push({
          type: "condition",
          name: this.activeModule.plane + " Residency",
          description: `Effects granted by residing on the plane of ${this.activeModule.plane}`,
          effect: this.activeModule.globalEffects || {},
          planar: true
        });
      }
    });

    await this.emit({
      type: "moduleStart",
      moduleName: this.mod.name,
      pcs: this.pcs,
      at: new Date().toISOString(),
      day: 0
    });

    return await this.enter(dry);
  }


  days = 0;
  async enter(dry = false, mod: CampaignModule = this.mod): Promise<{
    newModuleOptions: GeneratorOptions | null
  }> {
    await this.emit({
      type: "townVisited",
      townName: mod.town.townName, day: 0,
      translatedTownName: mod.town.translatedName,
      plane: mod.plane,
      weather: mod.weather,
      race: mod.town.race, size: mod.town.size,
      population: mod.town.population,
      adjective: mod.town.adjective,
      season: this.season,
    });
    const maxDays = 360;
    while (this.days++ < maxDays && this.pcs.some(pc => pc.hp > 0)) {
      await this.status(mod);
      const action = await this.menu(dry);

      if (action === "embark") {
        const dungeon = await this.selectDungeon();
        if (dungeon) {

          const share = Math.floor(this.state.sharedGold / this.pcs.length);
          this.pcs.forEach(pc => pc.gp = (pc.gp || 0) + share);
          this.state.sharedGold -= share * this.pcs.length;

          const dungeoneer = new Dungeoneer({
            dry,
            roller: this.roller,
            driver: this.driver,
            dungeonGen: () => dungeon,
            gen: this.gen,
            playerTeam: {
              name: "Player",
              combatants: this.pcs,
              inventory: this.state.inventory,
            },
          });
          const { newPlane } = await dungeoneer.run();
          if (newPlane !== null && newPlane !== undefined && newPlane !== mod.plane) {
            console.warn(`~~~ The party has shifted to the plane of ${newPlane} ~~~`);
            return { newModuleOptions: { _plane_name: newPlane } };
          }

          if (dungeoneer.winner === "Player") {
            this.markDungeonCompleted(dungeon.dungeonIndex || 0);
          }

          this.state.sharedGold += dungeoneer.playerTeam.combatants
            .reduce((sum, pc) => sum + (pc.gp || 0), 0);
          this.pcs.forEach(pc => pc.gp = 0);

          // do NOT stabilize unconscious PC to 1 HP here - leave that to the inn or temple
          // this.pcs.forEach(pc => {
          for (const pc of this.pcs) {
            if (pc.hp <= 0 && dry) {
              pc.hp = 1;
            }
            // const effective = Fighting.effectiveStats(pc);
            // const healAmount = Math.floor(effective.maxHp * 0.5);
            // pc.hp = Math.max(1, Math.min(effective.maxHp, pc.hp + healAmount));
            pc.spellSlotsUsed = 0;
            pc.activeEffects = [];
          };
        }
      } else if (action === "inn") {
        await this.rest(this.pcs);
      } else if (action === "itemShop") {
        await this.handleTownFeature('market', 'consumables');
      } else if (action === "magicShop") {
        await this.handleTownFeature('market', 'equipment');
      } else if (action === "armory") {
        const weaponsOrArmor: string = await this.select("What would you like to buy?", ['Weapons', 'Armor']);
        if (weaponsOrArmor.toLowerCase() === 'weapons') {
          await this.handleTownFeature('market', 'weapons');
        } else {
          await this.handleTownFeature('market', 'armor');
        }
      } else if (action === "general") {
        await this.handleTownFeature('market', 'loot');
      } else if (action === "blacksmith") {
        await this.handleTownFeature('market', 'enhancements');
      } else if (action === "tavern") {
        await this.handleTownFeature('tavern');
      } else if (action === "temple") {
        await this.handleTownFeature('temple');
      } else if (action === "mirror") {
        const pc = await this.select("Whose character record would you like to view?", this.pcs.map(pc => ({
          short: pc.name, value: pc, name: Presenter.combatant(pc), disabled: !!pc.dead
        })));
        await this.emit({
          type: "characterOverview",
          pc,
          day: this.days,
          inventory: this.state.inventory.filter(item => item.ownerId === pc.id),
        });
      } else {
        throw new Error(`Unknown action selected: ${action}`);
      }

    }

    await this.emit({
      type: "campaignStop",
      reason: this.pcs.every(pc => pc.hp <= 0) ? "Party defeated" : "Module completed",
      at: new Date().toISOString(),
      day: this.days,
    });

    return { newModuleOptions: null };
  }

  static townIcons = {
    hamlet: "🏡",
    village: "🏘️",
    town: "🏰",
    city: "🏙️",
    metropolis: "🌆",
    capital: "🏛️",
  }

  get season(): "spring" | "summer" | "autumn" | "winter" {
    const seasons = ["spring", "summer", "autumn", "winter"];
    return seasons[Math.floor((this.days % 360) / 90)] as "spring" | "summer" | "autumn" | "winter";
  }

  async status(mod: CampaignModule = this.mod) {
    await this.emit({
      type: "townVisited",
      plane: mod.plane,
      townName: mod.town.townName,
      translatedTownName: mod.town.translatedName,
      weather: mod.weather,
      race: mod.town.race,
      size: mod.town.size,
      population: mod.town.population,
      adjective: mod.town.adjective,
      day: this.days,
      season: this.season,
    })

    // this.logGold("status");
  }

  private async menu(dry = false): Promise<string> {
    const basicShops = {
      tavern: "Gather hirelings, hear rumors about the region",
      inn: "Restore HP/slots",
      temple: `Pray to ${Words.capitalize(this.mod.town.deity.name)}`,
    }
    const advancedShops = {
      general: "Buy gear and sell loot",
      armory: "Buy weapons and armor",
      blacksmith: "Improve weapons",
      magicShop: "Buy equipment",
      itemShop: "Buy consumables",
      // jeweler: "Improve gems and jewelry",
      mirror: "Show Party Inventory/Character Records",
    }

    let shops = { ...basicShops };
    if (!dry) {
      shops = { ...basicShops, ...advancedShops };
    }

    const options = //: Choice<Answers>[] =
      Object.entries(shops).map(([value, desc]) => ({
        short: Words.capitalize(value),
        value,
        name: `Visit the ${Words.humanize(value).padEnd(15)} ${Stylist.colorize(desc, 'blue')}`,
        disabled: (value === "temple" && this.sharedGold < 10),
      }));

    const available = this.availableDungeons;
    if (available.length > 0) {
      options.push({ short: "Seek", value: "embark", name: "⚔️ Embark on a Quest", disabled: this.state.discoveredDungeons.length === 0 || this.availableDungeons.length === 0 });
    }

    this.note("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
    return await this.select("What would you like to do?", options);
  }

  private async rest(party: Combatant[]) {
    const cost = 10;
    if (this.sharedGold < cost) {
      console.warn(`You need at least ${cost}g to rest at the inn.`);
      return;
    }
    this.state.sharedGold -= cost;
    // party.forEach(pc => {
    for (const pc of party) {
      pc.spellSlotsUsed = 0;
      pc.activeEffects = []; // Clear status effects!
      if (pc.hp <= 0) {
        const tryStabilize = await this.driver.confirm(`Would you like to attempt to stabilize ${pc.name}?`);
        if (tryStabilize) {
          let systemShockDc = 10;
          const conMod = Fighting.statMod(pc.con);
          systemShockDc += conMod;
          const systemShockRoll = this.roller(pc, `System Shock Save (DC ${systemShockDc})`, 20);
          if (systemShockRoll.amount >= systemShockDc) {
            pc.hp = 1;
            console.warn(`${pc.name} has been stabilized and regains consciousness with 1 HP.`);
          } else {
            console.warn(`${pc.name} failed to stabilize and has died!`);
            pc.dead = true;
          }
        // } else {
        //   console.warn(`${pc.name} remains alive but still unconscious...`);
        }
      } else if (!pc.dead) {
        // console.warn(`${pc.name} rests and recovers to full health.`);
        const effective = Fighting.effectiveStats(pc);
        pc.hp = effective.maxHp;
      }
    }
  }

  townFeatures: { [key: string]: () => TownFeature<string> } = {
    temple: () => new Temple(this.driver, this.state),
    tavern: () => new Tavern(this.driver, this.state),
    market: () => new Shop(this.driver, this.state),
  }

  private async handleTownFeature(
    featureType: 'tavern' | 'temple' | 'market',
    serviceName?: string
  ) {
    const featureEntryEvents = this.townFeatures[featureType]().enter();
    for (const event of await featureEntryEvents) {
      await this.emit(event);
    }

    let done = false;
    while (!done) {
      const feature = this.townFeatures[featureType]();
      await this.emit({ type: "goldStatus", amount: this.sharedGold, day: this.days });
      const { events, done: newDone } = await feature.interact(serviceName);
      for (const event of events) { await this.emit(event); }
      done = newDone;
    }
  }

  private async selectDungeon(): Promise<Dungeon | null> {
    const dungeonChoices = this.availableDungeons.filter(d => this.state.discoveredDungeons.includes(d.dungeonIndex!));
    if (dungeonChoices.length === 0) { return null; }

    const reasonableCr = Math.round(1.5 * this.pcs.map(pc => pc.level).reduce((a, b) => a + b, 0) / this.pcs.length) + 2;
    // console.log(`(Reasonable CR for party level ${this.pcs.map(pc => pc.level).join(", ")} is approx. ${reasonableCr})`);
    // console.log("Available dungeons:");
    // available.forEach(d => {
    //   console.log(` - ${d.dungeon_name} (CR ${d.intendedCr}): ${d.intendedCr > reasonableCr ? Stylist.colorize("⚠️ Too difficult!", 'red') : '✓ Reasonable'}`);
    // });

    const options = dungeonChoices.map(d => ({
      short: d.dungeon_name,
      value: dungeonChoices.indexOf(d),
      name: `${d.dungeon_name} (${d.direction}, CR ${d.intendedCr})`,
      disabled: d.intendedCr > reasonableCr, // Disable if CR is too high
    }))

    options.push({ short: "Cancel", value: -1, name: "Cancel and return to town", disabled: false });

    const choice: number = await this.select("Which dungeon?", options);
    // console.log("Chosen dungeon index:", choice, available[choice].dungeon_name);

    return choice !== -1 ? dungeonChoices[choice] : null;
  }

  private defaultModuleGen(): CampaignModule {
    return {
      name: "The Lost City of Eldoria",
      terrain: "Jungle",
      town: {
        townName: "Port Vesper",
        translatedName: "Safe Harbor",
        adjective: "bustling",
        size: "city",
        race: "human",
        population: 5000,
        deity: { name: "The Serpent Queen", domain: "Trickery", blessing: {}, forename: "Zyra", gender: "female", title: "Goddess of Deception" },
        tavern: { hirelings: [] },
      },
      dungeons: [Dungeoneer.defaultGen()],
      plane: "Prime Material",
      weather: "Tropical",
    }
    // return module;
  }
}