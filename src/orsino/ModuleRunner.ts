import Combat from "./Combat";
import Dungeoneer, { Dungeon } from "./Dungeoneer";
import { Combatant, EquipmentSlot } from "./types/Combatant";
import { Roll } from "./types/Roll";
import { Select } from "./types/Select";
import Choice from "inquirer/lib/objects/choice";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import Stylist from "./tui/Style";
import Words from "./tui/Words";
import Presenter from "./tui/Presenter";
import { Commands } from "./rules/Commands";
import Deem from "../deem";
import { ItemInstance } from "./types/ItemInstance";
import { Inventory } from "./Inventory";

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
  inventory: Array<ItemInstance>;
  completedDungeons: number[];
}

export class ModuleRunner {
  private roller: Roll; // (subject: Combatant, description: string, sides: number, dice: number) => Promise<RollResult>;
  private select: Select<any>;
  // private prompt: (message: string) => string;

  private outputSink: (message: string) => void;
  private moduleGen: () => Promise<CampaignModule>;
  private state: GameState = {
    party: [],
    sharedGold: 200,
    inventory: [],
    completedDungeons: []
  };

  private gen: (type: GenerationTemplateType, options?: Record<string, any>) => any;

  activeModule: CampaignModule | null = null;

  constructor(options: Record<string, any> = {}) {
    this.roller = options.roller || Commands.roll;
    this.select = options.select || Combat.samplingSelect;
    // this.prompt = options.prompt || ModuleRunner.randomInt;
    this.outputSink = options.outputSink || console.log;
    this.moduleGen = options.moduleGen || this.defaultModuleGen;
    this.gen = options.gen || (() => { throw new Error("No gen function provided") });

    this.state.party = options.pcs || [];
  }

  get pcs() { return this.state.party; }
  get sharedGold() { return this.state.sharedGold; }
  // get sharedPotions() { return this.state.sharedPotions; }
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

    // give initial gold to party
    this.state.sharedGold += this.pcs.reduce((sum, pc) => sum + (pc.gp || 0), 0);
    this.pcs.forEach(pc => pc.gp = 0);

    this.outputSink("Generating module, please wait...");
    this.activeModule = await this.moduleGen();
    this.outputSink(`Module "${this.activeModule.name}" generated: ${this.activeModule.terrain} terrain, ${this.activeModule.town.name} town, ${this.activeModule.dungeons.length} dungeons
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
    let maxDays = 120;
    while (days++ < maxDays && this.pcs.some(pc => pc.hp > 0)) {
      this.status(mod);
      this.outputSink(`\n--- Day ${days}/${maxDays} ---`);
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
            gen: this.gen, //.bind(this),
            playerTeam: {
              name: "Player",
              combatants: this.pcs,
              inventory: this.state.inventory,
            },
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
      } else if (action === "itemShop") {
        await this.shop('consumables');
      } else if (action === "magicShop") {
        await this.shop('equipment');
      } else if (action === "armory") {
        await this.shop('weapons');
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
            this.outputSink(`${pc.name} gains ${Words.humanizeList(
              Object.entries(blessing).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
            )
              } for ${duration} turns!`)
          }
        });
        // recharge wands/staves
        for (const item of this.state.inventory) {
          if (item.maxCharges !== undefined) {
            item.charges = item.maxCharges;
            this.outputSink(`Your ${Words.humanize(item.name)} is fully recharged.`);
          }
        }
      } else if (action === "show") {
        this.outputSink("\n📜 Party Records:")
        for (const pc of this.pcs) {
          // this.outputSink(`\n${Stylist.bold(pc.name)} -- ${Presenter.combatant(pc)}`);
          Presenter.printCharacterRecord(pc);
        }

        if (this.state.inventory.length > 0) {
          this.outputSink("\n🎒 Inventory:");
          let quantities = Inventory.quantities(this.state.inventory);
          for (const [itemName, qty] of Object.entries(quantities)) {
            this.outputSink(` - ${Words.humanize(itemName)} x${qty}`);
          }
        } else {
          this.outputSink("\n🎒 Inventory is empty.");
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
    this.outputSink(`💰 Gold: ${this.sharedGold}g`);
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
          { short: "Arms", value: "armory", name: "Visit the Armorer (buy weapons)", disabled: false },
          { short: "Equip", value: "magicShop", name: "Visit the Magic Shop (buy equipment)", disabled: false },
          { short: "Items", value: "itemShop", name: "Visit the Alchemist (buy consumables)", disabled: false },
          { short: "Chat", value: "rumors", name: "Visit the Tavern (hear rumors about the region)", disabled: available.length === 0 },
          { short: "Pray", value: "pray", name: `Visit the Temple to ${Words.capitalize(this.mod.town.deity)}`, disabled: this.sharedGold < 10 },
          { short: "Show", value: "show", name: `Show Party Inventory/Character Records`, disabled: false },
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

  private async shop(category: 'consumables' | 'weapons' | 'equipment') {
    if (category === 'equipment') {
      console.log("\nWelcome to the Magic Shop! Here are the available items:");
      const magicItemNames = await Deem.evaluate(`gather(equipment)`);
      while (true) {
        // pick wielder
        const pcOptions: Choice<any>[] = this.pcs.map(pc => ({
          short: pc.name,
          value: pc,
          name: `${pc.name} (${pc.equipment ? Words.humanizeList(Object.keys(pc.equipment)) : 'no equipment'})`,
          disabled: false,
        }));
        const wielder = await this.select(`Who needs new equipment?`, pcOptions) as Combatant;

        const options: Choice<any>[] = [];
        // shopItems.map((itemName: string, index: number) => {
        for (let index = 0; index < magicItemNames.length; index++) {
          let itemName = magicItemNames[index];
          let item = await Deem.evaluate(`lookup(equipment, "${itemName}")`);
          item.key = itemName;
          options.push({
            short: Words.humanize(itemName) + ` (${item.value}g)`,
            value: item,
            name: `${Words.humanize(itemName)} - ${item.description} (${item.value}g)`,
            disabled: this.sharedGold < item.value,
          })
        }
        options.push({ disabled: false, short: "Done", value: -1, name: "Finish shopping" });

        console.log("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
        const choice = await this.select("Available equipment to purchase:", options);
        if (choice === -1) {
          this.outputSink("You finish your shopping.");
          break;
        }
        const item = choice;
        console.log("Chosen equipment:", item);

        if (this.sharedGold >= item.value) {
          let maybeOldItem = await Inventory.equip(item.key, wielder);
          if (maybeOldItem) {
            let oldItem = await Deem.evaluate(`lookup(equipment, "${maybeOldItem}")`);
            this.state.sharedGold += oldItem.value || 0;
            this.outputSink(`🔄 Replacing ${Words.humanize(oldItem.key)} equipped to ${wielder.name} (sold old item ${oldItem.name} for ${oldItem.value}g).`)
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
          
          this.outputSink(`Purchased ${Words.humanize(item.name)} for ${item.value}g, equipped to ${wielder.name}`);
        }
      }
    } else if (category === 'consumables') {
      console.log("\nWelcome to the Alchemist's Shop! Here are the available items:");

      const consumableItemNames = await Deem.evaluate(`gather(consumables)`);
      while (true) {
        // console.log("Shop items:", shopItemNames);
        const options: Choice<any>[] = [];
        // shopItems.map((itemName: string, index: number) => {
        for (let index = 0; index < consumableItemNames.length; index++) {
          let itemName = consumableItemNames[index];
          let item = await Deem.evaluate(`lookup(consumables, "${itemName}")`);
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
          this.outputSink("You finish your shopping.");
          break;
        }
        const item = choice;
        //shopItemNames[choice];
        if (this.sharedGold >= item.value) {
          this.state.sharedGold -= item.value;
          // this.state.inventory[item.key] = (this.state.inventory[item.key] || 0) + 1;
          this.state.inventory.push(await Inventory.item(item.key));
          this.outputSink(`✅ Purchased 1x ${item.name} for ${item.value}g`);
        } else {
          this.outputSink("❌ Not enough gold!");
        }
        // this.share
      }
    } else if (category === 'weapons') {
      console.log("\nWelcome to the Armorer's Shop! Here are the available weapons:");

      const weaponItemNames = await Deem.evaluate(`gather(masterWeapon, -1, 'dig(#__it, "natural")')`);
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
          let itemName = weaponItemNames[index];
          let item = await Deem.evaluate(`lookup(masterWeapon, "${itemName}")`);
          item.key = itemName;
          options.push({
            short: Words.humanize(itemName) + ` (${item.value}g)`,
            value: item,
            name: `${Words.humanize(itemName)} - ${item.damage} ${item.weight} ${item.kind} (${item.value}g)`,
            disabled: this.sharedGold < item.value || (wielder.weaponProficiencies ? !Inventory.isWeaponProficient(item, wielder.weaponProficiencies) : true),
          })
        }
        options.push({ disabled: false, short: "Done", value: -1, name: "Finish shopping" });

        console.log("You have " + Stylist.bold(this.sharedGold + "g") + " available.");
        const choice = await this.select("Available weapons to purchase:", options);
        if (choice === -1) {
          this.outputSink("You finish your shopping.");
          break;
        }
        const item = choice;
        console.log("Chosen weapon:", item);

        if (this.sharedGold >= item.value) {
          this.state.sharedGold -= item.value;
          // wielder.equipment = wielder.equipment || {};
          wielder.weapon = item.key;
          wielder.attackDie = item.damage;
          wielder.damageKind = item.type;
          wielder.hasMissileWeapon = item.missile;
          wielder.hasInterceptWeapon = item.intercept;

          let primaryAttack = item.missile ? 'ranged' : 'melee';
          // remove ranged/melee ability from ability list
          wielder.abilities = (wielder.abilities || []).filter((abil: any) => abil.match(/melee|ranged/i) === null);
          // add new ability (keep primary at front)
          wielder.abilities.unshift(primaryAttack);
          
          this.outputSink(`✅ Purchased 1x ${Words.humanize(item.key)} for ${item.value}g, equipped to ${wielder.name}`);
        }
      }

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

    let reasonableCr = Math.round(1.5 * this.pcs.map(pc => pc.level).reduce((a, b) => a + b, 0) / this.pcs.length) + 2;
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