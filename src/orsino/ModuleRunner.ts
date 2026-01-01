import Dungeoneer, { Dungeon } from "./Dungeoneer";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { Select } from "./types/Select";
import Choice from "inquirer/lib/objects/choice";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import Stylist from "./tui/Style";
import Words from "./tui/Words";
import { Commands } from "./rules/Commands";
import { Inventory } from "./Inventory";
import Events, { ModuleEvent } from "./Events";
import { StatusEffect, StatusModifications } from "./Status";
import Presenter from "./tui/Presenter";
import CharacterRecord from "./rules/CharacterRecord";
import Automatic from "./tui/Automatic";
import { Fighting } from "./rules/Fighting";
import { Answers } from "inquirer";
import { GeneratedValue, GeneratorOptions } from "./Generator";
import Orsino from "../orsino";
import { GameState, newGameState, processEvents } from "./types/GameState";
import Shop, { ShopType } from "../Shop";
import { ItemInstance } from "./types/ItemInstance";

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
  name: string;
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
  select?: Select<Answers>;
  outputSink?: (message: string) => void;
  moduleGen?: (options?: GeneratorOptions) => CampaignModule;
  pcs?: Combatant[];
  gen?: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue | GeneratedValue[];
  inventory?: ItemInstance[];
}

export class ModuleRunner {
  static configuration = { sharedGold: 100 }

  private roller: Roll;
  private select: Select<Answers>;
  private _outputSink: (message: string) => void;
  private moduleGen: (
    options?: GeneratorOptions
  ) => CampaignModule;
  private _state: GameState;

  private gen: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue | GeneratedValue[];

  activeModule: CampaignModule | null = null;
  journal: ModuleEvent[] = [];

  constructor(options: RunnerOptions = {}) {
    this.roller = options.roller || Commands.roll.bind(Commands);
    this.select = options.select || Automatic.randomSelect.bind(Automatic);
    this._outputSink = options.outputSink || Orsino.outputSink;
    this.moduleGen = options.moduleGen || this.defaultModuleGen.bind(this);
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });

    this._state = newGameState({ ...ModuleRunner.configuration, party: options.pcs || [], inventory: options.inventory || [] });
  }

  get pcs() { return this._state.party; }
  get sharedGold() { return this._state.sharedGold; }
  get mod(): CampaignModule {
    if (!this.activeModule) {
      throw new Error("No active module!");
    }
    return this.activeModule;
  }

  get inventory() {
    return this._state.inventory;
  }

  get state() {
    return this._state;
  }

  private note(message: string): void {
    this._outputSink(message);
  }

  protected async emit(event: ModuleEvent) {
    this.journal.push(event);
    this.note(await Events.present(event));

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

  async run(dry = false) {
    if (this.pcs.length === 0) {
      throw new Error("No PCs provided!");
    }

    // give initial gold to party
    this.state.sharedGold += this.pcs.reduce((sum, pc) => sum + (pc.gp || 0), 0);
    this.pcs.forEach(pc => pc.gp = 0);

    // gather inventory from PC starting gear
    for (const pc of this.pcs) {
      const itemNames: string[] = pc.startingGear || [];
      for (const itemName of itemNames) {
        const item = { ...Inventory.genLoot(itemName), ownerId: pc.id, ownerSlot: 'backpack' };
        item.shared = item.itemClass === 'consumable';
        this.state.inventory.push(item);
      }
    }

    await this.emit({
      type: "campaignStart",
      // moduleName: this.mod.name,
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
      townName: mod.town.name, day: 0,
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
            select: this.select,
            outputSink: this._outputSink,
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

          // stabilize unconscious PC to 1 HP
          this.pcs.forEach(pc => {
            if (pc.hp <= 0) {
              pc.hp = 1;
            }
            const effective = Fighting.effectiveStats(pc);
            const healAmount = Math.floor(effective.maxHp * 0.5);
            pc.hp = Math.max(1, Math.min(effective.maxHp, pc.hp + healAmount));
            pc.spellSlotsUsed = 0;
            pc.activeEffects = [];
          });
        } else {
          console.warn("No available dungeons!");
        }
      } else if (action === "inn") {
        this.rest(this.pcs);
      } else if (action === "itemShop") {
        await this.shop('consumables');
      } else if (action === "magicShop") {
        await this.shop('equipment');
      } else if (action === "armory") {
        const weaponsOrArmor = await this.select("What would you like to buy?", ['Weapons', 'Armor']) as string;
        if (weaponsOrArmor.toLowerCase() === 'weapons') {
          await this.shop('weapons');
        } else {
          await this.shop('armor');
        }
      } else if (action === "general") {
        await this.shop('loot');
      } else if (action === "blacksmith") {
        await this.shop('enhancements');
        // } else if (action === "jeweler") {
        //   const gems = this.pcs.flatMap(pc => pc.gems || []);
        //   if (gems.length === 0) {
        //     console.log("You have no gems to sell.");
        //   } else {
        //     const totalValue = gems.reduce((sum, gem) => sum + gem.value, 0);
        //     for (const gem of gems) {
        //       await this.emit({ type: "sale", itemName: `${gem.name} (${gem.type})`, revenue: gem.value, seller: this.pcs.find(pc => (pc.gems || []).includes(gem))!, day: this.days });
        //     }
        //     console.log(`You sold your gems for a total of ${totalValue}g`);
        //     this.state.sharedGold += totalValue;
        //     this.pcs.forEach(pc => pc.gems = []);
        //   }
        // } else if (action === "blacksmith") {
        //   const improvementCost = 50;
        //     const actor = await this.select("Who will improve their weapon?", this.pcs.map(pc => ({
        //       short: pc.name, value: pc, name: pc.name, disabled: !pc.equipment?.weapon
        //     }))) as Combatant;
        //     // console.log("Current weapon:", actor.weapon, actor.attackDie);
        //   if (this.sharedGold > improvementCost) {
        //     const originalAttackDie = actor.attackDie;
        //     const alreadyImproved = actor.attackDie.includes("+");
        //     if (alreadyImproved) {
        //       // rewrite to improve further
        //       const [baseDie, plusPart] = actor.attackDie.split("+");
        //       let plusAmount = parseInt(plusPart);
        //       if (plusAmount <= 5) {
        //         plusAmount += 1;
        //         actor.attackDie = `${baseDie}+${plusAmount}`;
        //       } else {
        //         // could add a trait instead but for now improve the base die
        //         const [dieNumber, dieSides] = baseDie.split("d");
        //         const dieClasses = [2, 3, 4, 6, 8, 10, 12, 20, 100];
        //         const currentIndex = dieClasses.indexOf(parseInt(dieSides));
        //         if (currentIndex < dieClasses.length - 1) {
        //           const newDieSides = dieClasses[currentIndex + 1];
        //           actor.attackDie = `${dieNumber}d${newDieSides}+${plusAmount}`;
        //         } else {
        //           const newDieNumber = parseInt(dieNumber) + 1;
        //           actor.attackDie = `${newDieNumber}d${dieSides}+${plusAmount}`;
        //         }
        //       }
        //     } else {
        //       // improve weapon
        //       actor.attackDie += "+1";
        //     }
        //     // console.log(`🛠️ ${actor.name}'s weapon has been improved to ${actor.attackDie}!`);
        //     await this.emit({ type: "purchase", itemName: `${Words.humanize(actor.weapon)} Improvement (${originalAttackDie} -> ${actor.attackDie})`, cost: improvementCost, buyer: actor, day: this.days });
        //     this.state.sharedGold -= improvementCost;
        //   } else {
        //     console.log(`You need at least ${improvementCost}g to improve a weapon.`);
        //   }
      } else if (action === "tavern") {
        // let spend = 5;
        // if (this.sharedGold < spend) {
        //   console.log(`You need at least ${spend}g to gather rumors and hirelings at the tavern.`);
        //   continue;
        // }
        // this.state.sharedGold -= spend;
        // console.log("You spend time at the tavern gathering rumors...");
        await this.showRumors();
        await this.presentHireling();
      } else if (action === "temple") {
        await this.temple();
      } else if (action === "mirror") {
        await this.emit({
          type: "partyOverview",
          pcs: this.pcs,
          day: this.days,
          inventory: this.state.inventory,
          // itemQuantities: Inventory.quantities(this.state.inventory),
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
      townName: mod.town.name,
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
      inn: "Restore HP/slots"
    }
    const advancedShops = {
      general: "Sell loot and other items",
      armory: "Buy weapons",
      blacksmith: "Improve weapons",
      magicShop: "Buy equipment",
      itemShop: "Buy consumables",
      // jeweler: "Sell gems and jewelry",
      temple: `Pray to ${Words.capitalize(this.mod.town.deity.name)}`,
      mirror: "Show Party Inventory/Character Records",
    }

    let shops = { ...basicShops };
    if (!dry) {
      shops = { ...shops, ...advancedShops };
    }

    const options: Choice<Answers>[] =
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
    return await this.select("What would you like to do?", options) as string;
  }

  private rest(party: Combatant[]) {
    const cost = 10;
    if (this.sharedGold < cost) {
      console.log(`You need at least ${cost}g to rest at the inn.`);
      return;
    }
    this.state.sharedGold -= cost;
    party.forEach(pc => {
      if (!pc.dead) {
        const effective = Fighting.effectiveStats(pc);
        pc.hp = effective.maxHp;
        pc.spellSlotsUsed = 0;
        pc.activeEffects = []; // Clear status effects!
      } else {
        console.warn(`${pc.name} is dead and must seek resurrection.`);
      }
    });
    // this.outputSink("💤 Your party rests and recovers fully.");
  }

  private async temple() {
    const mod = this.mod;
    const deityName = mod.town.deity.name;
    const blessingsGranted: string[] = [];
    const offerDonation = await this.select(
      `The Temple of ${Words.capitalize(deityName)} offers blessings for 10g. Wands will also be recharged. Would you like to make a donation?`,
      [
        { short: "Yes", value: true, name: `Donate to ${deityName} Temple`, disabled: this.sharedGold < 10 },
        { short: "No", value: false, name: "Decline", disabled: false },
      ]
    ) as unknown as boolean;

    if (offerDonation) {
      this.state.sharedGold -= 10;
      const effect = mod.town.deity.blessing;
      const duration = 10;
      const blessingName = `${mod.town.deity.forename}'s Favor`;
      const blessing: StatusEffect = {
        name: blessingName,
        description: "Blessed by " + Words.capitalize(deityName),
        duration, effect, aura: false
      };
      blessing.description = Presenter.describeStatusWithName(blessing);
      // this.outputSink(`You pray to ${Words.capitalize(mod.town.deity)}.`);
      this.pcs.forEach(pc => {
        pc.activeEffects = pc.activeEffects || [];
        if (!pc.activeEffects.some(e => e.name === blessingName)) {
          pc.activeEffects.push(blessing);
          blessingsGranted.push(`Blessings of ${deityName} upon ${pc.name}`);
        }
      });
      // recharge wands/staves
      for (const item of this.state.inventory) {
        if (item.maxCharges !== undefined) {
          item.charges = item.maxCharges;
        }
      }
    }

    let anyDead = this.pcs.some(pc => pc.dead);
    const rezCost = 100;
    if (anyDead) {
      for (const pc of this.pcs) {
        if (pc.dead) {
          const choice = await this.select(
            `${pc.name} is dead. Would you like to be resurrected for ${rezCost}g?`,
            [
              { short: "Yes", value: true, name: `Resurrect ${pc.forename}`, disabled: this.sharedGold < rezCost },
              { short: "No", value: false, name: "Decline resurrection", disabled: false },
            ]
          ) as unknown as boolean;

          if (choice) {
            this.state.sharedGold -= rezCost;
            pc.dead = false;
            pc.hp = Math.max(1, Math.floor(Fighting.effectiveStats(pc).maxHp * 0.5));
            pc.spellSlotsUsed = 0;
            pc.activeEffects = [];
            blessingsGranted.push(`${pc.name} was resurrected by ${deityName}`);
          }
        }
      };
    }

    await this.emit({
      type: "templeVisited", templeName: `${mod.town.name} Temple of ${Words.capitalize(deityName)}`, day: this.days,
      blessingsGranted,
      itemsRecharged: this.state.inventory
        .filter(i => i.maxCharges !== undefined)
        .map(i => i.name),
    });
  }

  private async shop(category: ShopType) {
    await this.emit({ type: "shopEntered", shopName: Shop.name(category), day: this.days });
    const shop = new Shop(this.select);
    let done = false;
    while (!done) {
      await this.emit({ type: "goldStatus", amount: this.sharedGold, day: this.days });
      const { events, done: newDone } = await shop.interact(category, this.state);
      for (const event of events) { await this.emit(event); }
      this._state = processEvents(this.state, events);
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
    // gen a level 1 PC as hireling
    const hireling = this.gen("pc", { background: "hireling", setting: "fantasy" }) as unknown as Combatant;
    // await CharacterRecord.pickInitialSpells(hireling, Automatic.randomSelect);
    await CharacterRecord.chooseTraits(hireling, Automatic.randomSelect.bind(Automatic));
    const wouldLikeHireling = await this.select(
      // "A hireling is available to join your party. Would you like to consider their merits?",
      `A ${hireling.class} named ${hireling.name} is looking for work. Would you like to interview them?`,
      [
        { short: "Yes", value: true, name: `Interview ${hireling.forename}`, disabled: false },
        { short: "No", value: false, name: "Decline", disabled: false },
      ]);

    if (!wouldLikeHireling) {
      return;
    }

    await this.emit({
      type: "hirelingOffered",
      hireling,
      cost,
      day: this.days,
    });

    const choice = await this.select(`Would you like to hire ${hireling.name} for ${cost}?`, [
      { short: "Yes", value: true, name: `Hire ${hireling.forename}`, disabled: this.sharedGold < cost },
      { short: "No", value: false, name: "Decline the offer", disabled: false },
    ]);

    if (choice) {
      this.state.sharedGold -= cost;
      this.state.party.push(hireling);
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

    options.push({ short: "Cancel", value: null as any, name: "Cancel and return to town", disabled: false });

    const choice = await this.select("Which dungeon?", options);
    // console.log("Chosen dungeon index:", choice, available[choice].dungeon_name);

    return dungeonChoices[choice as unknown as number];
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
        name: "Port Vesper",
        population: 5000,
        deity: { name: "The Serpent Queen" }
      },
      dungeons: [Dungeoneer.defaultGen()]
    }
    return module as CampaignModule;
  }
}