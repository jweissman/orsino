import Dungeoneer, { Dungeon } from "./Dungeoneer";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { Select } from "./types/Select";
import Choice from "inquirer/lib/objects/choice";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import Stylist from "./tui/Style";
import Words from "./tui/Words";
import { Commands } from "./rules/Commands";
import Deem from "../deem";
import { ItemInstance } from "./types/ItemInstance";
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

interface GameState {
  party: Combatant[];
  sharedGold: number;
  inventory: Array<ItemInstance>;
  completedDungeons: number[];
  discoveredDungeons: number[];
}

type RunnerOptions = {
  roller?: Roll;
  select?: Select<Answers>;
  outputSink?: (message: string) => void;
  moduleGen?: (options?: GeneratorOptions) => CampaignModule;
  pcs?: Combatant[];
  gen?: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue;
}

export class ModuleRunner {
  static configuration = { startingGold: 100 }

  private roller: Roll;
  private select: Select<Answers>;

  private _outputSink: (message: string) => void;
  private moduleGen: (
    options?: GeneratorOptions
      //Record<string, any>
  ) => CampaignModule;
  private state: GameState = {
    party: [],
    sharedGold: ModuleRunner.configuration.startingGold,
    inventory: [],
    completedDungeons: [],
    discoveredDungeons: [],
  };

  private gen: (type: GenerationTemplateType, options?: GeneratorOptions) => GeneratedValue;

  activeModule: CampaignModule | null = null;
  journal: ModuleEvent[] = [];

  constructor(options: RunnerOptions = {}) {
    this.roller = options.roller || Commands.roll.bind(Commands);
    this.select = options.select || Automatic.randomSelect.bind(Automatic);
    this._outputSink = options.outputSink || Orsino.outputSink;
    this.moduleGen = options.moduleGen || this.defaultModuleGen.bind(this);
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });

    this.state.party = options.pcs || [];
  }

  get pcs() { return this.state.party; }
  get sharedGold() { return this.state.sharedGold; }
  get mod(): CampaignModule {
    if (!this.activeModule) {
      throw new Error("No active module!");
    }
    return this.activeModule;
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
    if (!this.activeModule) {return [];}
    return this.activeModule.dungeons.filter(d => !this.state.completedDungeons.includes(d.dungeonIndex!));
  }

  async run(dry = false) {
    if (this.pcs.length === 0) {
      throw new Error("No PCs provided!");
    }

    // give initial gold to party
    this.state.sharedGold += this.pcs.reduce((sum, pc) => sum + (pc.gp || 0), 0);
    this.pcs.forEach(pc => pc.gp = 0);
    this.logGold("start");
    console.log(`Starting module with party of ${this.pcs.length} adventurers and ${this.state.sharedGold}g shared gold.`);

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

          this.logGold("before dungeoneer");
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
            console.log(`The party has shifted to a new plane: ${newPlane}`);
            return { newModuleOptions: { _plane_name: newPlane } };
          }

          if (dungeoneer.winner === "Player") {
            this.markDungeonCompleted(dungeon.dungeonIndex || 0);
          }

          this.state.sharedGold += dungeoneer.playerTeam.combatants
            .reduce((sum, pc) => sum + (pc.gp || 0), 0);
          this.pcs.forEach(pc => pc.gp = 0);
          this.logGold("after dungeoneer");

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
        await this.shop('weapons');
      } else if (action === "jeweler") {
        const gems = this.pcs.flatMap(pc => pc.gems || []);
        if (gems.length === 0) {
          console.log("You have no gems to sell.");
        } else {
          const totalValue = gems.reduce((sum, gem) => sum + gem.value, 0);
          for (const gem of gems) {
            await this.emit({ type: "sale", itemName: `${gem.name} (${gem.type})`, revenue: gem.value, seller: this.pcs.find(pc => (pc.gems || []).includes(gem))!, day: this.days });
          }
          console.log(`You sold your gems for a total of ${totalValue}g`);
          this.state.sharedGold += totalValue;
          this.pcs.forEach(pc => pc.gems = []);
        }
      } else if (action === "blacksmith") {
        const improvementCost = 50;
          const actor = await this.select("Who will improve their weapon?", this.pcs.map(pc => ({
            short: pc.name, value: pc, name: pc.name, disabled: !pc.weapon
          }))) as Combatant;
          // console.log("Current weapon:", actor.weapon, actor.attackDie);
        if (this.sharedGold > improvementCost) {
          const originalAttackDie = actor.attackDie;
          const alreadyImproved = actor.attackDie.includes("+");
          if (alreadyImproved) {
            // rewrite to improve further
            const [baseDie, plusPart] = actor.attackDie.split("+");
            let plusAmount = parseInt(plusPart);
            if (plusAmount <= 5) {
              plusAmount += 1;
              actor.attackDie = `${baseDie}+${plusAmount}`;
            } else {
              // could add a trait instead but for now improve the base die
              const [dieNumber, dieSides] = baseDie.split("d");
              const dieClasses = [2, 3, 4, 6, 8, 10, 12, 20, 100];
              const currentIndex = dieClasses.indexOf(parseInt(dieSides));
              if (currentIndex < dieClasses.length - 1) {
                const newDieSides = dieClasses[currentIndex + 1];
                actor.attackDie = `${dieNumber}d${newDieSides}+${plusAmount}`;
              } else {
                const newDieNumber = parseInt(dieNumber) + 1;
                actor.attackDie = `${newDieNumber}d${dieSides}+${plusAmount}`;
              }
            }
          } else {
            // improve weapon
            actor.attackDie += "+1";
          }
          // console.log(`🛠️ ${actor.name}'s weapon has been improved to ${actor.attackDie}!`);
          await this.emit({ type: "purchase", itemName: `${Words.humanize(actor.weapon)} Improvement (${originalAttackDie} -> ${actor.attackDie})`, cost: improvementCost, buyer: actor, day: this.days });
          this.state.sharedGold -= improvementCost;
        } else {
          console.log(`You need at least ${improvementCost}g to improve a weapon.`);
        }
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
        this.state.sharedGold -= 10;
        const blessingsGranted: string[] = [];
        const effect = mod.town.deity.blessing;
        const duration = 10;
        const deityName = mod.town.deity.name;
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
            // this.outputSink(`The priest blesses ${pc.name}.`);
            pc.activeEffects.push(
              // { name: `Blessing of ${deityName}`, duration, effect, description }
              blessing
            );
            blessingsGranted.push(`Blessings of ${deityName} upon ${pc.name}`);
            // this.outputSink(`${pc.name} gains ${Words.humanizeList(
            //   Object.entries(blessing).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
            // )} for ${duration} turns!`)
          }
        });
        // recharge wands/staves
        for (const item of this.state.inventory) {
          if (item.maxCharges !== undefined) {
            item.charges = item.maxCharges;
            // this.outputSink(`Your ${Words.humanize(item.name)} is fully recharged.`);
          }
        }
        await this.emit({
          type: "templeVisited", templeName: `${mod.town.name} Temple of ${Words.capitalize(deityName)}`, day: this.days,
          blessingsGranted,
          itemsRecharged: this.state.inventory
            .filter(i => i.maxCharges !== undefined)
            .map(i => i.name),
        });
      } else if (action === "mirror") {
        await this.emit({
          type: "partyOverview",
          pcs: this.pcs,
          day: this.days,
          itemQuantities: Inventory.quantities(this.state.inventory),
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

    this.logGold("status");
  }

  private async menu(dry = false): Promise<string> {
    const basicShops = {
      tavern: "Gather hirelings, hear rumors about the region",
      inn: "Restore HP/slots"
    }
    const advancedShops = {
      armory: "Buy weapons",
      blacksmith: "Improve weapons",
      magicShop: "Buy equipment",
      itemShop: "Buy consumables",
      jeweler: "Sell gems and jewelry",
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
    return await this.select("What would you like to do?", options);
  }

  private rest(party: Combatant[]) {
    party.forEach(pc => {
      const effective = Fighting.effectiveStats(pc);
      pc.hp = effective.maxHp;
      pc.spellSlotsUsed = 0;
      pc.activeEffects = []; // Clear status effects!
    });
    // this.outputSink("💤 Your party rests and recovers fully.");
  }

  private async shop(category: 'consumables' | 'weapons' | 'equipment') {
    if (category === 'equipment') {
      // console.log("\nWelcome to the Magic Shop! Here are the available items:");
      await this.emit({ type: "shopEntered", shopName: "Magician", day: this.days });

      const magicItemNames = Deem.evaluate(`gather(equipment)`);
      while (true) {
        // pick wielder
        const pcOptions: Choice<any>[] = this.pcs.map(pc => ({
          short: pc.name,
          value: pc,
          name: `${pc.name} (${pc.equipment ? Words.humanizeList(Object.values(pc.equipment)) : 'no equipment'})`,
          disabled: false,
        }));
        const wielder = await this.select(`Who needs new equipment?`, pcOptions) as Combatant;

        const options: Choice<any>[] = [];
        // shopItems.map((itemName: string, index: number) => {
        for (let index = 0; index < magicItemNames.length; index++) {
          const itemName = magicItemNames[index];
          const item = Deem.evaluate(`lookup(equipment, "${itemName}")`);
          item.key = itemName;
          options.push({
            short: Words.humanize(itemName) + ` (${item.value}g)`,
            value: item,
            name: `${Words.humanize(itemName)} - ${item.description} (${item.value}g)`,
            disabled: this.sharedGold < item.value,
          })
        }
        options.push({ disabled: false, short: "Done", value: -1, name: "Finish shopping" });

        // console.log("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
        const choice = await this.select("Available equipment to purchase:", options);
        if (choice === -1) {
          // this.outputSink("You finish your shopping.");
          break;
        }
        const item = choice;
        // console.log("Chosen equipment:", item);

        if (this.sharedGold >= item.value) {
          const { oldItemKey: maybeOldItem } = await Inventory.equip(item.key, wielder);
          if (maybeOldItem) {
            const oldItem = Deem.evaluate(`lookup(equipment, "${maybeOldItem}")`);
            this.state.sharedGold += oldItem.value || 0;
            // this.outputSink(`🔄 Replacing ${Words.humanize(oldItem.key)} equipped to ${wielder.name} (sold old item ${oldItem.name} for ${oldItem.value}g).`)
          }
          // let oldItemKey = wielder.equipment ? wielder.equipment[item.kind as EquipmentSlot] : null;
          // if (oldItemKey) {
          //   let oldItem = await Deem.evaluate(`lookup(equipment, "${oldItemKey}")`);
          //   this.state.sharedGold += oldItem.value || 0;
          //   this.outputSink(`🔄 Replacing ${Words.humanize(oldItemKey)} equipped to ${wielder.name} (sold old item for ${oldItem.value}g).`)
          // };
          // this.state.sharedGold -= item.value;
          // wielder.equipment = wielder.equipment || {};
          // wielder.equipment[item.kind as EquipmentSlot] = item.key;

          // this.outputSink(`Purchased ${Words.humanize(item.name)} for ${item.value}g, equipped to ${wielder.name}`);
          await this.emit({
            type: "purchase",
            itemName: item.key,
            cost: item.value,
            buyer: wielder,
            day: this.days,
          });
          this.state.sharedGold -= item.value;
        }
      }
    } else if (category === 'consumables') {
      // console.log("\nWelcome to the Alchemist's Shop! Here are the available items:");
      await this.emit({ type: "shopEntered", shopName: "Alchemist", day: this.days });

      const consumableItemNames = Deem.evaluate(`gather(consumables)`);
      while (true) {
        // console.log("Shop items:", shopItemNames);
        const options: Choice<any>[] = [];
        // shopItems.map((itemName: string, index: number) => {
        for (let index = 0; index < consumableItemNames.length; index++) {
          const itemName = consumableItemNames[index];
          const item = Deem.evaluate(`lookup(consumables, "${itemName}")`);
          item.key = itemName;
          options.push({
            short: item.name + ` (${item.value}g)`,
            value: item,
            name: `${item.name} - ${item.description} (${item.value}g)`,
            disabled: this.sharedGold < item.value,
          })
        }
        options.push({ disabled: false, short: "Done", value: -1, name: "Finish shopping" });

        console.log("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
        const choice = await this.select("Available items to purchase:", options);
        if (choice === -1) {
          // this.outputSink("You finish your shopping.");
          break;
        }
        const item = choice;
        //shopItemNames[choice];
        if (this.sharedGold >= item.value) {
          this.state.sharedGold -= item.value;
          // this.state.inventory[item.key] = (this.state.inventory[item.key] || 0) + 1;
          this.state.inventory.push(await Inventory.item(item.key));
          // this.outputSink(`✅ Purchased 1x ${item.name} for ${item.value}g`);
          const firstPc = this.pcs[0];
          await this.emit({
            type: "purchase",
            itemName: item.key,
            cost: item.value,
            buyer: firstPc,
            day: this.days,
          });
        } else {
          // this.outputSink("❌ Not enough gold!");
        }
        // this.share
      }
    } else if (category === 'weapons') {
      // console.log("\nWelcome to the Armorer's Shop! Here are the available weapons:");
      await this.emit({ type: "shopEntered", shopName: "Armorer", day: this.days });

      const weaponItemNames = Deem.evaluate(`gather(masterWeapon, -1, '!dig(#__it, "natural")')`) as string[];
      // console.log("Weapon items:", weaponItemNames);
      weaponItemNames.sort();

      while (true) {

        // pick wielder
        const pcOptions: Choice<any>[] = this.pcs.map(pc => ({
          short: pc.name,
          value: pc,
          name: `${pc.name} (${pc.weapon || 'unarmed'})`,
          disabled: false,
        }));
        const wielder = await this.select(`Who needs a new weapon?`, pcOptions) as Combatant;

        const options: Choice<any>[] = [];
        // shopItems.map((itemName: string, index: number) => {
        for (let index = 0; index < weaponItemNames.length; index++) {
          const itemName = weaponItemNames[index];
          const item = Deem.evaluate(`lookup(masterWeapon, "${itemName}")`) as unknown as { 
            key: string;
            damage: string;
            type: string;
            missile: boolean;
            intercept: boolean;
            weight: string;
            kind: string;
            value: number;
          };
          item.key = itemName;
          options.push({
            short: Words.humanize(itemName) + ` (${item.value}g)`,
            value: item,
            name: `${Words.humanize(itemName)} - ${item.damage} ${item.weight} ${item.kind} (${item.value}g)`,
            disabled: this.sharedGold < item.value || (wielder.weaponProficiencies ? !Inventory.isWeaponProficient(item, wielder.weaponProficiencies) : true),
          })
        }
        options.push({ disabled: false, short: "Done", value: "done", name: "Finish shopping" });

        // console.log("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
        const choice = await this.select("Available weapons to purchase:", options);
        if (choice === "done") {
          // this.outputSink("You finish your shopping.");
          break;
        }
        const item = choice;
        // console.log("Chosen weapon:", item);

        if (this.sharedGold >= item.value) {
          this.state.sharedGold -= item.value;
          // wielder.equipment = wielder.equipment || {};
          wielder.weapon = item.key;
          wielder.attackDie = item.damage;
          wielder.damageKind = item.type;
          wielder.hasMissileWeapon = item.missile;
          wielder.hasInterceptWeapon = item.intercept;

          const primaryAttack = item.missile ? 'ranged' : 'melee';
          // remove ranged/melee ability from ability list
          wielder.abilities = (wielder.abilities || []).filter((abil: any) => abil.match(/melee|ranged/i) === null);
          // add new ability (keep primary at front)
          wielder.abilities.unshift(primaryAttack);

          // this.outputSink(`✅ Purchased 1x ${Words.humanize(item.key)} for ${item.value}g, equipped to ${wielder.name}`);
          await this.emit({
            type: "purchase",
            itemName: item.key,
            cost: item.value,
            buyer: wielder,
            day: this.days,
          });
        }
      }

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
    const hireling = this.gen("pc", { background: "hireling", setting: "fantasy" }) as Combatant;
    await CharacterRecord.pickInitialSpells(hireling, Automatic.randomSelect);
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
    if (dungeonChoices.length === 0) {return null;}

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

    return dungeonChoices[choice];
  }

  private logGold(tag: string) {
    const pcGold = this.pcs.map(p => `${p.forename}:${p.gp||0}`).join(", ");
    console.log(`🪙 [gold] ${tag} shared=${this.state.sharedGold} pcs=[${pcGold}]`);
  }


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