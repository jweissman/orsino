import Choice from "inquirer/lib/objects/choice";

import Deem from "./deem";
import { ModuleEvent } from "./orsino/Events";
import { Armor, Equipment, Inventory, Weapon } from "./orsino/Inventory";
import Words from "./orsino/tui/Words";
import { Combatant } from "./orsino/types/Combatant";
import { GameState } from "./orsino/types/GameState";
import Automatic from "./orsino/tui/Automatic";
import { never } from "./orsino/util/never";
import { ItemInstance, materializeItem } from "./orsino/types/ItemInstance";

export type ShopType
  = 'loot'
  | 'consumables'
  | 'weapons'
  | 'equipment'
  | 'armor'
  | 'enhancements'

type ShopStepResult =
  | { done: true; events: ModuleEvent[] }
  | { done: false; events: ModuleEvent[] }

export default class Shop {
  static name(type: ShopType): string {
    switch (type) {
      case 'consumables':
        return "Alchemist";
      case 'weapons':
      case 'armor':
        return "Armorer";
      case 'enhancements':
        return "Blacksmith";
      case 'equipment':
        return "Magician";
      case 'loot':
        return "Provisioner";
      default:
        return never(type);
    }
  }

  constructor(private select = Automatic.randomSelect.bind(Automatic)) { }

  gameState!: GameState;
  leaving = false;
  currentGold: number = 0;

  get gold() { return this.currentGold }
  get day() { return this.gameState.day }
  get party() { return this.gameState.party }

  async interact(shopType: ShopType, gameState: GameState): Promise<ShopStepResult> {
    this.gameState = gameState;
    this.currentGold = this.gameState.sharedGold;
    this.leaving = false;
    const stores: Record<ShopType, () => Promise<ModuleEvent[]>> = {
      equipment: this.equipmentShop.bind(this),
      consumables: this.consumablesShop.bind(this),
      weapons: this.weaponsShop.bind(this),
      armor: this.armorShop.bind(this),
      loot: this.lootShop.bind(this),
      enhancements: this.blacksmithShop.bind(this),
    };
    const events: ModuleEvent[] = await stores[shopType].bind(this)();
    return { done: this.leaving, events };
  }

  private async armorShop(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const armorItemNames = Deem.evaluate(`gather(masterArmor, -1, '!dig(#__it, "natural")')`) as string[];
    // const weaponItemNames = Deem.evaluate(`gather(masterWeapon, -1, '!dig(#__it, "natural")')`) as string[];
    const pcEquipment = (combatant: Combatant) => {
      let equipmentWithoutWeapon = { ...combatant.equipment };
      delete equipmentWithoutWeapon.weapon;
      let equipmentIds = Object.values(equipmentWithoutWeapon || {});
      return Words.humanizeList(
        equipmentIds.map(eid => materializeItem(eid, this.gameState.inventory).name)
      );
    }
    const pcOptions = this.party.map(pc => ({
      short: pc.name,
      value: pc,
      name: `${pc.name} (${pcEquipment(pc)})`,
      disabled: false,
    }));
    const wearer = await this.select(`Who needs new armor?`, pcOptions) as Combatant;

    const options = [];
    for (let index = 0; index < armorItemNames.length; index++) {
      const itemName = armorItemNames[index];
      // const item = Deem.evaluate(`lookup(masterArmor, "${itemName}")`) as unknown as Equipment;
      const item = materializeItem(itemName, []) as Armor & ItemInstance;
      item.key = itemName;
      options.push({
        short: Words.humanize(itemName) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemName)} - ${item.description} (${item.value}g)`,
        disabled: this.currentGold < item.value || (wearer.armorProficiencies ? !Inventory.isArmorProficient(item, wearer.armorProficiencies) : true),
        // disabled: this.currentGold < item.value || (wielder.weaponProficiencies ? !Inventory.isWeaponProficient(item, wielder.weaponProficiencies) : true),
      })
    }
    options.push({ disabled: false, short: "Done", value: "done", name: "Finish shopping" });

    const choice = await this.select("Available armor to purchase:", options);
    if (choice === "done") {
      this.leaving = true;
      return events;
    }
    const item = choice as Equipment;

    if (this.currentGold >= item.value) {
      const { oldItemRef: maybeOldItem } = Inventory.equipmentSlotAndExistingItem(item.key, wearer);
      if (maybeOldItem) {
        const oldItem = materializeItem(maybeOldItem, this.gameState.inventory);
        events.push({
          type: "sale",
          itemName: maybeOldItem,
          revenue: oldItem.value,
          seller: wearer,
          day: this.day,
        });
      }

      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        buyer: wearer,
        day: this.day,
      });
      this.currentGold -= item.value;
      const equipment = Deem.evaluate(`lookup(masterArmor, "${item.key}")`) as unknown as Equipment;
      const slot = equipment.kind;
      events.push({
        type: "equip",
        itemName: item.key,
        slot,
        wearerId: wearer.id,
        wearerName: wearer.forename,
        day: this.day,
      })
    }
    return events;
  }

  private async lootShop(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];

    const buyingSelling = await this.select("Would you like to buy or sell?", [
      {
        short: "Buy Gear",
        value: "buy",
        name: "Purchase gear from the shop",
        disabled: false,
      },
      {
        short: "Sell Items",
        value: "sell",
        name: "Sell items from your inventory",
        disabled: this.gameState.inventory.length === 0,
      },
      {
        short: "Sell All Junk",
        value: "sell_junk",
        name: "Sell all junk items from your inventory",
        disabled: this.gameState.inventory.filter(ii => ii.itemClass === 'junk').length === 0,
      },
      {
        short: "Done",
        value: "done",
        name: "Finish shopping",
        disabled: false,
      },
    ]) as string;

    if (buyingSelling === "buy") {
      events.push(...await this.buyGear())
    } else if (buyingSelling === "sell") {
      events.push(...await this.sellItems());
    } else if (buyingSelling === "sell_junk") {
      events.push(...await this.sellJunk());
    } else if (buyingSelling === "done") {
      this.leaving = true;
    }

    return events;
  }

  private async buyGear(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const gearItemNames = Deem.evaluate(`gather(masterGear)`) as string[];
    const options: Choice[] = [];
    for (let index = 0; index < gearItemNames.length; index++) {
      const itemName = gearItemNames[index];
      const item = Deem.evaluate(`lookup(masterGear, "${itemName}")`) as unknown as Equipment;
      item.key = itemName;
      options.push({
        short: Words.humanize(itemName) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemName)} - ${item.description || 'no description'} (${item.value}g)`,
        disabled: this.currentGold < item.value,
      })
    }

    options.push({ disabled: false, short: "Done", value: "done", name: "Finish shopping" });

    const choice = await this.select("Available gear to purchase:", options);
    if (choice === "done") {
      this.leaving = true;
      return events;
    }

    const item = choice as Equipment;

    if (this.currentGold >= item.value) {
      const firstPc = this.party[0];
      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        buyer: firstPc,
        day: this.day,
      });
      this.currentGold -= item.value;
      
      events.push({
        type: "acquire",
        itemName: item.key,
        quantity: 1,
        acquirer: firstPc,
        day: this.day,
      });
    }

    return events;
  }

  private async sellItems(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const lootQuantities = Inventory.quantities(this.gameState.inventory);
    const lootOptions: Choice[] = [];
    for (const [itemKey, qty] of Object.entries(lootQuantities)) {
      const item = this.gameState.inventory.find(ii => ii.key === itemKey);
      if (!item) {
        console.warn(`Could not find item instance for key ${itemKey} in inventory.`);
        continue;
      }
      lootOptions.push({
        short: `${Words.humanize(itemKey)} x${qty} (${item.value}g each)`,
        value: item,
        name: `${Words.humanize(itemKey)} - ${item.description || 'no description'} x${qty} (${item.value}g each)`,
        disabled: false,
      });
    }
    lootOptions.push({ disabled: false, short: "Done", value: "done", name: "Finish selling" });

    const choice = await this.select("Available items to sell:", lootOptions);
    if (choice === "done") {
      this.leaving = true;
      return events;
    }
    const item = choice as Equipment;

    // sell one unit of the item
    const itemIndex = this.gameState.inventory.findIndex(ii => ii.key === item.key);
    if (itemIndex >= 0) {
      this.gameState.inventory.splice(itemIndex, 1);
      events.push({
        type: "sale",
        itemName: item.key,
        revenue: item.value,
        seller: this.party[0],
        day: this.day,
      });
      this.currentGold += item.value;
    }
    return events;
  }

  private async sellJunk(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const junkItems = this.gameState.inventory.filter(ii => ii.itemClass === 'junk');
    for (const item of junkItems) {
      const itemIndex = this.gameState.inventory.findIndex(ii => ii.id === item.id);
      if (itemIndex >= 0) {
        this.gameState.inventory.splice(itemIndex, 1);
        events.push({
          type: "sale",
          itemName: item.key,
          revenue: item.value,
          seller: this.party[0],
          day: this.day,
        });
        this.currentGold += item.value;
      }
    }
    return events;
  }

  private async equipmentShop(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const magicItemNames = Deem.evaluate(`gather(masterEquipment)`) as string[];
    const pcEquipment = (combatant: Combatant) => {
      let equipmentIds = Object.values(combatant.equipment || {});
      return Words.humanizeList(
        equipmentIds.map(eid => materializeItem(eid, this.gameState.inventory).name)
      );
    } 
    // const pcOptions = this.party.map(pc => ({
    //   short: pc.name,
    //   value: pc,
    //   name: `${pc.name} (${pcEquipment(pc) || 'no equipment'})`,
    //   disabled: false,
    // }));
    // const wearer = await this.select(`Who needs new equipment?`, pcOptions) as Combatant;
    const wearer = await this.pickPartyMember(`Who needs new equipment?`, (combatant) => {
      return `${combatant.name} (${pcEquipment(combatant) || 'no equipment'})`;
    });

    const options = [];
    for (let index = 0; index < magicItemNames.length; index++) {
      const itemName = magicItemNames[index];
      const item = Deem.evaluate(`lookup(masterEquipment, "${itemName}")`) as unknown as Equipment;
      item.key = itemName;
      options.push({
        short: Words.humanize(itemName) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemName)} - ${item.description} (${item.value}g)`,
        disabled: this.currentGold < item.value,
      })
    }
    options.push({ disabled: false, short: "Done", value: "done", name: "Finish shopping" });

    const choice = await this.select("Available equipment to purchase:", options);
    if (choice === "done") {
      this.leaving = true;
      return events;
    }
    const item = choice as Equipment;

    if (this.currentGold >= item.value) {
      const { oldItemRef: maybeOldItem } = Inventory.equipmentSlotAndExistingItem(item.key, wearer);
      if (maybeOldItem) {
        const oldItem = materializeItem(maybeOldItem, this.gameState.inventory);
        events.push({
          type: "sale",
          itemName: maybeOldItem,
          revenue: oldItem.value,
          seller: wearer,
          day: this.day,
        });
      }

      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        buyer: wearer,
        day: this.day,
      });
      this.currentGold -= item.value;
      const equipment = Deem.evaluate(`lookup(masterEquipment, "${item.key}")`) as unknown as Equipment;
      const slot = equipment.kind;
      events.push({
        type: "equip",
        itemName: item.key,
        slot,
        wearerId: wearer.id,
        wearerName: wearer.forename,
        day: this.day,
      })
    }
    return events;
  }

  private async consumablesShop(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const consumableItemNames = Deem.evaluate(`gather(consumables)`) as string[];
    const options: Choice[] = [];
    for (let index = 0; index < consumableItemNames.length; index++) {
      const itemName = consumableItemNames[index];
      const item = materializeItem(itemName, []);
      // const item = Deem.evaluate(`lookup(consumables, "${itemName}")`) as unknown as {
      //   key: string;
      //   name: string;
      //   description: string;
      //   value: number;
      // };
      // item.key = itemName;
      let anyoneProficient = this.party.some(pc => {
        return pc.itemProficiencies ? Inventory.isItemProficient(item, pc.itemProficiencies) : false;
      });
      options.push({
        short: item.name + ` (${item.value}g)`,
        value: item,
        name: `${item.name} - ${item.description} (${item.value}g)`,
        disabled: this.currentGold < item.value || (!anyoneProficient),
      })
    }
    options.push({ disabled: false, short: "Done", value: "done", name: "Finish shopping" });

    const choice = await this.select("Available items to purchase:", options);
    if (choice === "done") {
      this.leaving = true;
      return events;
    }
    const item = choice as {
      key: string;
      name: string;
      description: string;
      value: number;
    };

    if (this.currentGold >= item.value) {
      const firstPc = this.party[0];
      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        buyer: firstPc,
        day: this.day,
      });
      this.currentGold -= item.value;

      events.push({
        type: "acquire",
        itemName: item.key,
        quantity: 1,
        acquirer: firstPc,
        day: this.day,
      });
    }
    return events;
  }

  private async weaponsShop(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const weaponItemNames = Deem.evaluate(`gather(masterWeapon, -1, '!dig(#__it, "natural")')`) as string[];
    weaponItemNames.sort();
    const pcWeapon = (combatant: Combatant) => {
      return combatant.equipment && combatant.equipment.weapon ? materializeItem(combatant.equipment.weapon, this.gameState.inventory).name : 'unarmed';
    } 
    // pick wielder
    // const pcOptions: Choice<Combatant>[] = this.party.map(pc => ({
    //   short: pc.name,
    //   value: pc,
    //   name: `${pc.name} (${pcWeapon(pc)})`,
    //   disabled: false,
    // }));
    // const wielder = await this.select(`Who needs a new weapon?`, pcOptions) as Combatant;
    const wielder = await this.pickPartyMember(`Who needs a new weapon?`, (combatant) => {
      return `${combatant.name} (${pcWeapon(combatant)})`;
    });

    const options: Choice<Weapon>[] = [];
    for (let index = 0; index < weaponItemNames.length; index++) {
      const itemName = weaponItemNames[index];
      const item = Deem.evaluate(`lookup(masterWeapon, "${itemName}")`) as unknown as Weapon;
      item.key = itemName;
      options.push({
        short: Words.humanize(itemName) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemName)} - ${item.damage} ${item.weight} ${item.kind} (${item.value}g)`,
        disabled: this.currentGold < item.value || (wielder.weaponProficiencies ? !Inventory.isWeaponProficient(item, wielder.weaponProficiencies) : true),
      })
    }
    options.push({ disabled: false, short: "Done", value: "done", name: "Finish shopping" });

    const choice = await this.select("Available weapons to purchase:", options);
    if (choice === "done") {
      this.leaving = true;
      return events;
    }
    const item = choice as Weapon & { key: string };
    if (this.currentGold >= item.value) {
      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        buyer: wielder,
        day: this.day,
      });
      this.currentGold -= item.value;
      events.push({
        type: "wield",
        weaponName: item.key,
        wielderId: wielder.id,
        wielderName: wielder.forename,
        day: this.day,
      });
    }
    return events;
  }

  private async blacksmithShop(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];

    const weaponDetails = (combatant: Combatant) => {
      if (combatant.equipment && combatant.equipment.weapon) {
        const weapon = materializeItem(combatant.equipment.weapon, this.gameState.inventory) as Weapon & ItemInstance;
        return `${weapon.name} (${weapon.damage}, ${weapon.weight})`;
      } else {
        return 'unarmed';
      }
    }

    const improver = await this.pickPartyMember(`Who needs an enhancement?`, (combatant) => {
      return `${combatant.name} (${weaponDetails(combatant)})`;
    });

    const currentWeaponInstance = improver.equipment && improver.equipment.weapon
      ? materializeItem(improver.equipment.weapon, this.gameState.inventory) as Weapon & ItemInstance
      : null;

    if (!currentWeaponInstance) {
      console.log(`${improver.name} is unarmed and cannot have their weapon enhanced.`);
      return events;
    }

    // if (!improver.equipment?.weapon?.includes(":")) {
    //   console.log(`Reifying ${improver.name}'s weapon ${currentWeaponInstance.name} for enhancement...`);
    //   events.push({
    //     type: "reifyWeapon",
    //     weaponName: currentWeaponInstance.name,
    //     weaponId: currentWeaponInstance.id!,
    //     wielderId: improver.id,
    //     weaponInstance: currentWeaponInstance,
    //     day: this.day,
    //   });
      
    // }

    const originalAttackDie = currentWeaponInstance.damage;
    let [baseDie, modifier] = originalAttackDie.split('+').map(s => s.trim());

    const modifierNumber = modifier ? parseInt(modifier) : 0;

    const [dieNumber, dieSides] = baseDie.split('d').map(s => s.trim()).map(s => parseInt(s));
    const dieClasses = [2, 3, 4, 6, 8, 10, 12, 20, 30, 60, 100];
    const baseDieIndex = dieClasses.indexOf(dieSides);
    if (baseDieIndex < 0) {
      console.log(`Cannot enhance weapon with unknown damage die ${originalAttackDie}.`);
      return events;
    }

    const upgradedAttackDie = dieClasses[Math.min(baseDieIndex + 1, dieClasses.length - 1)];

    const costs = {
      sharpen:   500  + (modifierNumber * 200),
      reinforce: 750  + (baseDieIndex * 300),
      imbue:     1000 + (dieNumber * 500),
    }

    const improvementRequested = await this.select("What type of enhancement would you like?", [
      {
        short: "Sharpen Weapon",
        value: "sharpen",
        name: `${'Sharpen'.padEnd(12)} | Improve your weapon's minimum damage (from ${originalAttackDie} to ${baseDie}+${modifierNumber + 1}) (Cost: ${costs.sharpen} gp)`,
        disabled: modifierNumber >= 5 || costs.sharpen > this.currentGold,
      },
      {
        short: "Reinforce Weapon",
        value: "reinforce",
        name: `${'Reinforce'.padEnd(12)} | Improve your weapon's base damage die (from ${originalAttackDie} to ${dieNumber}d${upgradedAttackDie}${modifier ? ` + ${modifierNumber}` : ''}) (Cost: ${costs.reinforce} gp)`,
        disabled: baseDieIndex >= dieClasses.length - 1 || costs.reinforce > this.currentGold,
      },
      {
        short: "Imbue Weapon",
        value: "imbue",
        name: `${'Imbue'.padEnd(12)} | Improve your weapon's die number (from ${originalAttackDie} to ${dieNumber + 1}d${dieSides}${modifier ? ` + ${modifierNumber}` : ''}) (Cost: ${costs.imbue} gp)`,
        disabled: dieNumber >= 5 || costs.imbue > this.currentGold,
      },
      {
        short: "Done",
        value: "done",
        name: "Finish shopping",
        disabled: false,
      },
    ]) as string;

    if (improvementRequested === "done") {
      this.leaving = true;
      return events;
    }

    // modify weapon
    console.log(`Enhancing ${improver.name}'s ${currentWeaponInstance.name}... (${improvementRequested})`);
    // const weaponQualities = {
    //   1: "sharpened",
    //   2: "fine",
    //   3: "excellent",
    //   4: "superior",
    //   5: "masterwork",
    // }

    let cost = costs[improvementRequested as keyof typeof costs];
    events.push({
      type: "purchase",
      itemName: `${improvementRequested} enhancement`,
      cost,
      buyer: improver,
      day: this.day,
    })
    switch (improvementRequested) {
      case "sharpen": {
        const newModifier = modifierNumber + 1;
        const newAttackDie = `${baseDie} + ${newModifier}`;
        events.push({
          type: "enhanceWeapon",
          weaponName: currentWeaponInstance.name,
          weaponId: currentWeaponInstance.id!,
          wielderId: improver.id,
          wielderName: improver.forename,
          enhancement: "sharpen",
          oldDamage: originalAttackDie,
          newDamage: newAttackDie,
          day: this.day,
          cost
        });
        break;
      }
      case "reinforce": {
        const newAttackDie = `${dieNumber}d${upgradedAttackDie}` + (modifier ? ` + ${modifierNumber}` : '');
        events.push({
          type: "enhanceWeapon",
          weaponName: currentWeaponInstance.name,
          weaponId: currentWeaponInstance.id!,
          wielderId: improver.id,
          wielderName: improver.forename,
          enhancement: "reinforce",
          oldDamage: originalAttackDie,
          newDamage: newAttackDie,
          day: this.day,
          cost
        });
        break;
      }
      case "imbue": {
        const newDieNumber = dieNumber + 1;
        const newAttackDie = `${newDieNumber}d${dieSides}` + (modifier ? ` + ${modifierNumber}` : '');
        events.push({
          type: "enhanceWeapon",
          weaponName: currentWeaponInstance.name,
          weaponId: currentWeaponInstance.id!,
          wielderId: improver.id,
          wielderName: improver.forename,
          enhancement: "imbue",
          oldDamage: originalAttackDie,
          newDamage: newAttackDie,
          day: this.day,
          cost
        });
        break;
      }
    }

    return events;
  }

  private async pickPartyMember(
    prompt: string, presenter: (combatant: Combatant) => string = (combatant) => combatant.name
  ): Promise<Combatant> {
    const pcOptions: Choice<Combatant>[] = this.party.map(pc => ({
      short: pc.name,
      value: pc,
      name: presenter(pc),
      disabled: false,
    }));
    const pc = await this.select(prompt, pcOptions) as Combatant;
    return pc;
  }
}