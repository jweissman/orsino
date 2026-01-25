import Dungeoneer, { Dungeon } from "./Dungeoneer";
import Events, { ModuleEvent } from "./Events";
import Shop, { SHOP_KINDS, ShopDefinition, ShopKind } from "./campaign/Shop";
import Stylist from "./tui/Style";
import Tavern from "./campaign/Tavern";
import Temple from "./campaign/Temple";
import TownFeature from "./campaign/TownFeature";
import Words from "./tui/Words";
import { Combatant } from "./types/Combatant";
import { Commands } from "./rules/Commands";
import { Driver, NullDriver } from "./Driver";
import { GameState, newGameState } from "./types/GameState";
import { GameStateReducer } from "./rules/GameStateReducer";
import { GeneratedValue, GeneratorOptions } from "./Generator";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import { Inventory } from "./Inventory";
import { ItemInstance } from "./types/ItemInstance";
import { Roll } from "./types/Roll";
import { StatusModifications } from "./Status";
import Deem from "../deem";
import CombatantPresenter from "./presenter/CombatantPresenter";

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

type Climate
  = 'arid'
  | 'coastal'
  | 'cold'
  | 'humid'
  | 'polar'
  | 'temperate'
  | 'tropical'
  | 'unpredicatable'
  | 'volcanic';

interface ShopDefinition {
  type: string;
  name: string;
  // owner: Combatant;
  kind: ShopKind;
  itemTypes?: ('consumable' | 'weapon' | 'armor' | 'equipment' | 'gear')[];
  itemRestrictions?: { kind?: string[]; rarity?: string[] };
}
export interface Town {
shops: ShopDefinition[];
  climate: Climate;
  tavern: { name: string; hirelings: Combatant[] };
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
  // climate: Climate;     
  weather: string;
  town: Town;
  dungeons: Dungeon[];
  globalEffects?: StatusModifications;

  completedDungeons: number[];
  discoveredDungeons: number[];
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
  private readonly state: GameState;

  private gen: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue | GeneratedValue[];

  private get season(): "spring" | "summer" | "autumn" | "winter" {
    const seasons = ["spring", "summer", "autumn", "winter"];
    return seasons[Math.floor((this.days % 360) / 90)] as "spring" | "summer" | "autumn" | "winter";
  }
  private journal: ModuleEvent[] = [];

  private get campaignModule(): CampaignModule { return this.state.campaignModule; }

  constructor(options: RunnerOptions = {}) {
    this.roller = options.roller || Commands.roll.bind(Commands);
    this.driver = options.driver || new NullDriver();
    this.moduleGen = options.moduleGen || this.defaultModuleGen.bind(this);
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });

    const initialModule = this.moduleGen();
    console.warn(`Initial module "${initialModule.name}" generated.`);

    this.state = newGameState({
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

  get pcs() { return this.state.party; }
  get sharedGold() { return this.state.sharedGold; }
  get inventory() { return this.state.inventory; }

  private note(message: string): void {
    this._outputSink(message);
  }

  protected async emit(event: ModuleEvent) {
    this.journal.push(event);
    this.note(await Events.present(event, this.state));
    // @ts-expect-error -- dynamic update of game state based on event type
    this.state = GameStateReducer.processEvent(this.state, event);

    await Events.appendToLogfile(event);
  }

  get discoveredDungeons(): number[] {
    return this.state.campaignModule.discoveredDungeons;
  }

  get completedDungeons(): number[] {
    return this.state.campaignModule.completedDungeons;
  }

  get days() { return this.state.day; }

  // markDungeonCompleted(dungeonIndex: number) {
  //   if (!this.completedDungeons.includes(dungeonIndex)) {
  //     this.completedDungeons.push(dungeonIndex);
  //   }
  // }

  get availableDungeons(): Dungeon[] {
    if (!this.campaignModule) { return []; }
    return this.campaignModule.dungeons.filter(d => d.dungeonIndex && !this.completedDungeons.includes(d.dungeonIndex));
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
        const campaignModule = this.moduleGen(moduleOptions);
        // @ts-expect-error -- updating state with new module
        this.state = newGameState({
          party: this.pcs,
          sharedGold: this.state.sharedGold,
          inventory: this.state.inventory,
          mod: { ...campaignModule, completedDungeons: [], discoveredDungeons: [] }
        });
      } else {
        playing = false;
      }
    }
  }

  private async runModule(dry = false): Promise<{ newModuleOptions: GeneratorOptions | null }> {
    if (!this.campaignModule) {
      throw new Error("No active module at runModule time!");
    }

    // clear out any existing globals
    this.pcs.forEach(pc => {
      pc.passiveEffects = pc.passiveEffects || [];
      pc.passiveEffects = pc.passiveEffects?.filter(e => !e.planar);
      if (this.campaignModule.globalEffects) {
        pc.passiveEffects.push({
          type: "condition",
          name: this.campaignModule.plane + " Residency",
          description: `Effects granted by residing on the plane of ${this.campaignModule.plane}`,
          effect: this.campaignModule.globalEffects || {},
          planar: true
        });
      }
    });

    await this.emit({
      type: "moduleStart",
      moduleName: this.campaignModule.name,
      pcs: this.pcs,
      at: new Date().toISOString(),
      day: 0
    });

    return await this.enter(dry);
  }

  // days = 0;
  async enter(dry = false, mod: CampaignModule = this.campaignModule): Promise<{
    newModuleOptions: GeneratorOptions | null
  }> {
    const maxDays = 360;
    while (this.days < maxDays && this.pcs.some(pc => pc.hp > 0)) {
      const weather = Deem.evaluate(`lookup(climateWeather, ${mod.town.climate})`) as string;
      await this.emit({ type: "newDay", day: this.days + 1, season: this.season, weather })
      await this.status();
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

          this.state.sharedGold += dungeoneer.playerTeam.combatants
            .reduce((sum, pc) => sum + (pc.gp || 0), 0);
          this.pcs.forEach(pc => pc.gp = 0);

          if (newPlane !== null && newPlane !== undefined && newPlane !== mod.plane) {
            console.warn(`~~~ The party has shifted to the plane of ${newPlane} ~~~`);
            return { newModuleOptions: { _plane_name: newPlane } };
          }

          if (dungeoneer.winner === "Player") {
            // this.markDungeonCompleted(dungeon.dungeonIndex || 0);
            const dungeonIndex = dungeon.dungeonIndex;
            if (dungeonIndex === undefined) {
              throw new Error("Dungeon index undefined on completed dungeon!");
            }
            await this.emit({
              type: "dungeonCompleted",
              dungeonIndex,
              day: this.days,
            });
          }


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
        // } else if (action === "inn") {
        //   await this.rest(this.pcs);
        // } else if (action === "itemShop") {
        //   await this.handleTownFeature('market', 'consumables');
        // } else if (action === "magicShop") {
        //   await this.handleTownFeature('market', 'equipment');
        // } else if (action === "armory") {
        //   const weaponsOrArmor: string = await this.select("What would you like to buy?", ['Weapons', 'Armor']);
        //   if (weaponsOrArmor.toLowerCase() === 'weapons') {
        //     await this.handleTownFeature('market', 'weapons');
        //   } else {
        //     await this.handleTownFeature('market', 'armor');
        //   }
        // } else if (action === "general") {
        //   await this.handleTownFeature('market', 'loot');
        // } else if (action === "blacksmith") {
        //   await this.handleTownFeature('market', 'enhancements');
      } else if (action === "tavern") {
        await this.handleTownFeature('tavern');
      } else if (action === "temple") {
        await this.handleTownFeature('temple');
        // } else if (SHOP_KINDS.includes(action as ShopKind)) {
      } else if (action.match(/shop:/)) {
        const [, shopKind] = action.split(":");
        // pick item type to browse
        const shopDef: ShopDefinition = Deem.evaluate(`lookup(shopTypes, '${shopKind}')`) as unknown as ShopDefinition;
        if (!shopDef) {
          throw new Error(`No shop definition found for kind: ${shopKind}`);
        }
        const itemTypes = shopDef.itemTypes || [];
        if (itemTypes.length === 0) {
          // throw new Error(`Shop of kind ${shopKind} has no item types defined.`);
          await this.handleTownFeature('market', shopKind);
        } else {
          let serviceName: string | undefined = undefined;
          if (itemTypes.length === 1) {
            serviceName = itemTypes[0];
          } else {
            serviceName = await this.select(`What would you like to browse at the ${shopDef.type}?`, itemTypes.map(it => ({
              name: Words.capitalize(it),
              value: it,
              short: it
            })));
          }
          // await this.handleTownFeature('market', shopKind);
          console.warn(`Visiting shop of kind ${shopKind} to browse ${serviceName} (restrictions: ${JSON.stringify(shopDef.itemRestrictions)})`);

          await this.handleTownFeature('market', serviceName as ShopKind, shopDef.itemRestrictions);
        }
      } else if (action === "mirror") {
        const pc = await this.select("Whose character record would you like to view?", this.pcs.map(pc => ({
          short: pc.name, value: pc, name: CombatantPresenter.combatant(pc), disabled: !!pc.dead
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



  async status() { //}mod: CampaignModule = this.campaignModule) {
    const mod = this.campaignModule;

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
      tavern: `Relax at ${this.campaignModule.town.tavern.name}`,
      temple: `Pray to ${Words.capitalize(this.campaignModule.town.deity.name)}`,
      mirror: "Show Party Inventory/Character Records",
    }

    const advancedShops: {
      [key: string]: string
    } = {
      // inn: "Restore HP/slots",
      // general: "Buy gear and sell loot",
      // armory: "Buy weapons and armor",
      // blacksmith: "Improve weapons",
      // magicShop: "Buy equipment",
      // itemShop: "Buy consumables",
      // jeweler: "Improve gems and jewelry",
    }

    for (const shop of this.campaignModule.town.shops || []) {
      advancedShops['shop:' + shop.kind] = `Visit ${shop.name}`;
    }

    let shops = { ...basicShops };
    if (!dry) {
      shops = { ...basicShops, ...advancedShops };
    }

    const options = Object.entries(shops).map(([value, desc]) => ({
      short: Words.capitalize(value),
      value,
      name: `${desc.padEnd(36)} ${Stylist.colorize(`Visit the ${Words.humanize(value)}`, 'blue')}`,
      disabled: false // (value === "temple" && this.sharedGold < 10),
    })).sort((a, b) => a.name.localeCompare(b.name));

    const available = this.availableDungeons;
    if (available.length > 0) {
      options.push({ short: "Seek", value: "embark", name: "⚔️ Embark on a Quest", disabled: this.discoveredDungeons.length === 0 || this.availableDungeons.length === 0 });
    }

    this.note("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
    const choice = await this.select("What would you like to do?", options);
    return choice;
  }

  townFeatures: { [key: string]: () => TownFeature<string> } = {
    temple: () => new Temple(this.driver, this.state),
    tavern: () => new Tavern(this.driver, this.state),
    market: () => new Shop(this.driver, this.state),
  }

  private async handleTownFeature(
    featureType: 'tavern' | 'temple' | 'market',
    serviceName?: string,
    itemRestrictions?: { kind?: string[]; rarity?: string[] }
  ) {
    const featureEntryEvents = this.townFeatures[featureType]().enter();
    for (const event of await featureEntryEvents) {
      await this.emit(event);
    }

    let done = false;
    while (!done) {
      const feature = this.townFeatures[featureType]();
      await this.emit({ type: "goldStatus", amount: this.sharedGold, day: this.days });
      const { events, done: newDone } = await feature.interact(serviceName, itemRestrictions);
      for (const event of events) { await this.emit(event); }
      done = newDone;
    }
  }

  private async selectDungeon(): Promise<Dungeon | null> {
    const dungeonChoices = this.availableDungeons.filter(d => d.dungeonIndex && this.discoveredDungeons.includes(d.dungeonIndex));
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
        climate: "coastal",
        size: "city",
        race: "human",
        population: 5000,
        deity: { name: "The Serpent Queen", domain: "Trickery", blessing: {}, forename: "Zyra", gender: "female", title: "Goddess of Deception" },
        tavern: { hirelings: [], name: "The Salty Mermaid"},
        shops: [],
      },
      dungeons: [Dungeoneer.defaultGen()],
      plane: "Prime Material",
      weather: "Tropical",
      completedDungeons: [],
      discoveredDungeons: [],
    }
    // return module;
  }
}