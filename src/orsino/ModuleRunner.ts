import Dungeoneer, { Dungeon } from "./Dungeoneer";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import Stylist from "./tui/Style";
import Words from "./tui/Words";
import { Commands } from "./rules/Commands";
import { Inventory } from "./Inventory";
import Events, { ModuleEvent } from "./Events";
import { StatusModifications } from "./Status";
import Presenter from "./tui/Presenter";
import CharacterRecord from "./rules/CharacterRecord";
import Automatic from "./tui/Automatic";
import { Fighting } from "./rules/Fighting";
import { GeneratedValue, GeneratorOptions } from "./Generator";
import { GameState, GameStateReducer, newGameState } from "./types/GameState";
import Shop, { ShopType } from "./campaign/Shop";
import { ItemInstance } from "./types/ItemInstance";
import { Driver, NullDriver } from "./Driver";
import Temple from "./campaign/Temple";

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
  private moduleGen: (
    options?: GeneratorOptions
  ) => CampaignModule;
  private gameState: GameState;

  private gen: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue | GeneratedValue[];

  activeModule: CampaignModule | null = null;
  journal: ModuleEvent[] = [];

  constructor(options: RunnerOptions = {}) {
    this.roller = options.roller || Commands.roll.bind(Commands);
    this.driver = options.driver || new NullDriver();
    this.moduleGen = options.moduleGen || this.defaultModuleGen.bind(this);
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });
    this.gameState = newGameState({ ...ModuleRunner.configuration, party: options.pcs || [], inventory: options.inventory || [] });
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
    return this.activeModule.dungeons.filter(d => !this.state.completedDungeons.includes(d.dungeonIndex!));
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
      const { newModuleOptions } = await this.runModule(dry, moduleOptions);
      if (newModuleOptions !== null) {
        moduleOptions = newModuleOptions;
      } else {
        playing = false;
      }
    }
  }

  private async runModule(dry = false, moduleOptions: Record<string, any> = {}): Promise<{ newModuleOptions: Record<string, any> | null }> {
    // this.outputSink("Generating module, please wait...");
    this.activeModule = this.moduleGen(
      moduleOptions
    );

    // clear out any existing globals
    this.pcs.forEach(pc => {
      pc.passiveEffects = pc.passiveEffects || [];
      pc.passiveEffects = pc.passiveEffects?.filter(e => !e.planar);
      if (this.activeModule!.globalEffects) {
        pc.passiveEffects.push({
          type: "condition",
          name: this.activeModule!.plane + " Residency",
          description: `Effects granted by residing on the plane of ${this.activeModule!.plane}`,
          effect: this.activeModule!.globalEffects || {},
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

    // this.outputSink(`Module "${this.activeModule.name}" generated: ${this.activeModule.terrain} terrain, ${this.activeModule.town.name} town, ${this.activeModule.dungeons.length} dungeons
    // }`);
    // clear screen
    // this.outputSink("\x1Bc");
    // this.outputSink(`Welcome to ${Stylist.bold(this.mod.name)}!`);
    return await this.enter(dry);

    // this.outputSink("\nThank you for playing!");
  }


  days = 0;
  async enter(dry = false, mod: CampaignModule = this.mod): Promise<{
    newModuleOptions: Record<string, any> | null
  }> {
    // this.outputSink(`You arrive at the ${mod.town.adjective} ${Words.capitalize(mod.town.race)} ${mod.town.size} of ${Stylist.bold(mod.town.name)}.`);
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
      // this.outputSink(`\n--- Day ${days}/${maxDays} ---`);
      const action = await this.menu(dry);
      // this.outputSink(`You chose to ${action}.`);

      if (action === "embark") {
        // don't we need to distribute gold to PCs? is this already done somehow
        const dungeon = await this.selectDungeon();
        if (dungeon) {

          const share = Math.floor(this.state.sharedGold / this.pcs.length);
          this.pcs.forEach(pc => pc.gp = (pc.gp || 0) + share);
          this.state.sharedGold -= share * this.pcs.length;

          // this.logGold("before dungeoneer");
          // this.outputSink(`You embark on a Quest to the ${Stylist.bold(dungeon.dungeon_name)}...`);
          const dungeoneer = new Dungeoneer({
            dry,
            roller: this.roller,
            // select: this.select,
            // pause: this.pause,
            // clear: this.clear,
            // outputSink: this._outputSink,
            driver: this.driver,
            dungeonGen: () => dungeon,
            gen: this.gen, //.bind(this),
            playerTeam: {
              name: "Player",
              combatants: this.pcs,
              inventory: this.state.inventory,
            },
          });
          const { newPlane } = await dungeoneer.run();  //dungeon, this.pcs);
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
          // this.logGold("after dungeoneer");

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
        // } else {
        //   console.warn("No available dungeons!");
        }
      } else if (action === "inn") {
        await this.rest(this.pcs);
      } else if (action === "itemShop") {
        await this.shop('consumables');
      } else if (action === "magicShop") {
        await this.shop('equipment');
      } else if (action === "armory") {
        const weaponsOrArmor: string = await this.select("What would you like to buy?", ['Weapons', 'Armor']);
        if (weaponsOrArmor.toLowerCase() === 'weapons') {
          await this.shop('weapons');
        } else {
          await this.shop('armor');
        }
      } else if (action === "general") {
        await this.shop('loot');
      } else if (action === "blacksmith") {
        await this.shop('enhancements');
      } else if (action === "tavern") {
        await this.showRumors();
        await this.presentHireling();
      } else if (action === "temple") {
        await this.temple();
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
        } else {
          console.warn(`${pc.name} remains alive but still unconscious...`);
        }
      } else if (!pc.dead) {
        console.warn(`${pc.name} rests and recovers to full health.`);
        const effective = Fighting.effectiveStats(pc);
        pc.hp = effective.maxHp;
      // } else {
      //   console.warn(`${pc.name} is dead and must seek resurrection.`);
      }
    }
    // this.outputSink("💤 Your party rests and recovers fully.");
  }

  private async temple() {
    const templeName = `${this.mod.town.townName} Temple of ${Words.capitalize(this.mod.town.deity.name)}`;
    await this.emit({ type: "templeEntered", templeName, day: this.days });
    const temple = new Temple(this.mod.town.deity, this.driver);
    let done = false;
    while (!done) {
      await this.emit({ type: "goldStatus", amount: this.sharedGold, day: this.days });
      const { events, done: newDone } = await temple.interact(this.state);
      for (const event of events) { await this.emit(event); }
      done = newDone;
    }
  }

  private async shop(category: ShopType) {
    await this.emit({ type: "shopEntered", shopName: Shop.name(category), day: this.days });
    const shop = new Shop(this.select.bind(this));
    let done = false;
    while (!done) {
      await this.emit({ type: "goldStatus", amount: this.sharedGold, day: this.days });
      const { events, done: newDone } = await shop.interact(category, this.state);
      for (const event of events) { await this.emit(event); }
      // this.gameState = processEvents(this.state, events);
      done = newDone;
    }
  }

  private async showRumors() {
    const available = this.availableDungeons;
    if (available.length === 0) {
      // this.outputSink("You've cleared all known threats in the region!");
      return;
    }

    const index = Math.floor(Math.random() * available.length);
    const rumor = available[index].rumor;
    await this.emit({
      type: "rumorHeard",
      rumor,
      day: this.days,
    });

    this.state.discoveredDungeons = this.state.discoveredDungeons.concat(
      available.filter(d => d.dungeonIndex === available[index].dungeonIndex).map(d => d.dungeonIndex!)
    );
  }

  private async presentHireling() {
    const cost = 100;
    const partySize = this.pcs.length;
    if (partySize >= 6 || this.sharedGold < cost) {
      return;
    }
    const hirelings = this.mod.town.tavern?.hirelings || [];
    if (hirelings.length === 0) {
      return;
    }
    // gen a level 1 PC as hireling
    // const hireling = this.gen("pc", { background: "hireling", setting: "fantasy" }) as unknown as Combatant;
    const hireling = hirelings[Math.floor(Math.random() * hirelings.length)];
    hireling.level = 1;
    hireling.gp = 0;
      //await CharacterRecord.autogen(CharacterRecord.goodRaces, (options) => this.gen("pc", { ...options, background: "hireling" }) as unknown as Combatant) as Combatant;
    // await CharacterRecord.pickInitialSpells(hireling, Automatic.randomSelect);
    await CharacterRecord.chooseTraits(hireling, Automatic.randomSelect.bind(Automatic));
    const race = hireling.race;
    const charClass = hireling.class;
    if (!race || !charClass) {
      throw new Error("Hireling generation failed!");
    }
    const wouldLikeHireling = await this.driver.confirm(
      // "A hireling is available to join your party. Would you like to consider their merits?",
      `A ${Words.humanize(race)} ${Words.humanize(charClass)} named ${hireling.name} is looking for work. Would you like to interview them?`,
    );
      // [
      //   { short: "Yes", value: true, name: `Interview ${hireling.forename}`, disabled: false },
      //   { short: "No", value: false, name: "Decline", disabled: false },
      // ]);

    if (!wouldLikeHireling) {
      return;
    }

    await this.emit({
      type: "hirelingOffered",
      hireling,
      cost,
      day: this.days,
    });

    const choice: boolean = await this.driver.confirm(`Would you like to hire ${hireling.name} for ${cost}?`);

    if (choice) {
      this.mod.town.tavern.hirelings = this.mod.town.tavern.hirelings.filter(h => h.id !== hireling.id);
      this.state.sharedGold -= cost;
      this.state.party.push(hireling);
      this.state.inventory.push(...this.gatherStartingGear(hireling));
      // this.outputSink(`✅ You have hired ${hireling.name} into your party!`);
      await this.emit({
        type: "hirelingHired",
        hireling,
        cost,
        day: this.days,
      });
    } else {
      this._outputSink(`You declined to hire ${hireling.name}.`);
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

  // private logGold(tag: string) {
  //   const pcGold = this.pcs.map(p => `${p.forename}:${p.gp||0}`).join(", ");
  //   console.log(`🪙 [gold] ${tag} shared=${this.state.sharedGold} pcs=[${pcGold}]`);
  // }


  private defaultModuleGen(): CampaignModule {
    const module = {
      name: "The Lost City of Eldoria",
      terrain: "Jungle",
      town: {
        townName: "Port Vesper",
        population: 5000,
        deity: { name: "The Serpent Queen" }
      },
      dungeons: [Dungeoneer.defaultGen()],
      plane: "Prime Material",
      weather: "Tropical",
    }
    return module as CampaignModule;
  }
}