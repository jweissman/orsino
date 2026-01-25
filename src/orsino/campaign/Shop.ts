import Choice from "inquirer/lib/objects/choice";

import Deem from "../../deem";
import Words from "../tui/Words";
import { Armor, Equipment, Inventory, Weapon } from "../Inventory";
import { Combatant } from "../types/Combatant";
import { ItemInstance, materializeItem } from "../types/ItemInstance";
import { ModuleEvent, WieldEvent } from "../Events";
import { never } from "../util/never";
import TownFeature from "./TownFeature";

type ItemRestrictions = {
  kind?: string[];
  rarity?: string[];
  aspect?: string[];
  type?: string[];
};

export const SHOP_KINDS = [
  'consumable',
  'armor',
  'equipment',
  'gear',
  'weapon',
  'loot',

  // specialty
  'blacksmith',
] as const;

export type ShopKind = typeof SHOP_KINDS[number];

class Catalog {
  static gatherWithRestrictions(type: string, r: ItemRestrictions = {}): string[] {
    const allItemKeys: string[] = Deem.evaluate(`gather(${type})`) as string[];
    return allItemKeys.filter(itemKey => {
      const item = Inventory.reifyFromKey(itemKey);
      return this.passesRestrictions(item, r);
    });
  }

  private static passesRestrictions(item: ItemInstance, r: ItemRestrictions): boolean {
    if (item?.natural) { return false; }

    if (r.kind && !r.kind.includes(item?.kind || "")) {
      return false;
    }
    if (item.rarity && r.rarity && !r.rarity.includes(item?.rarity || "")) {
      return false;
    }
    if (r.aspect && !r.aspect.includes(item?.aspect || "")) {
      return false;
    }
    if (r.type && !r.type.includes(item?.type || "")) {
      return false;
    }

    return true;
  }
}

export default class Shop extends TownFeature<ShopKind> {
  static name(type: ShopKind): string {
    switch (type) {
      case 'consumable':
        return "Alchemist";
      case 'blacksmith':
        return "Blacksmith";
      case 'equipment':
        return "Magician";
      case 'loot':
        return "Merchant";
      case 'armor':
        return "Armorer";
      case 'weapon':
        return "Weaponsmith";
      case 'gear':
        return "Provisioner";
      default:
        return never(type);
    }
  }

  serviceName(type: ShopKind): string {
    return Shop.name(type) + "'s Shop";
  }

  services: Record<ShopKind, () => Promise<ModuleEvent[]>> = {
    consumable: this.consumablesShop.bind(this),
    armor: this.armorShop.bind(this),
    equipment: this.equipmentShop.bind(this),
    weapon: this.weaponsShop.bind(this),

    // split gear into its own shop?
    gear: this.lootShop.bind(this),
    loot: this.lootShop.bind(this),

    blacksmith: this.blacksmithShop.bind(this),
  };


  private async armorShop(itemRestrictions: ItemRestrictions = {}): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    // const armorItemNames = Deem.evaluate(`gather(masterArmor, -1, '!dig(#__it, "natural")')`) as string[];
    const armorItemNames = Catalog.gatherWithRestrictions('masterArmor', itemRestrictions);
    const pcEquipment = (combatant: Combatant) => {
      const equipmentWithoutWeapon = { ...combatant.equipment };
      delete equipmentWithoutWeapon.weapon;
      const equipmentIds = Object.values(equipmentWithoutWeapon || {});
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
    const wearer = await this.driver.select(`Who needs new armor?`, pcOptions);

    const options = [];
    for (let index = 0; index < armorItemNames.length; index++) {
      const itemKey = armorItemNames[index];
      const item = materializeItem(itemKey, []) as Armor & ItemInstance;
      item.key = itemKey;
      options.push({
        short: Words.humanize(itemKey) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemKey)} - ${item.description} (${item.value}g)`,
        disabled: this.gold < item.value || (wearer.armorProficiencies ? !Inventory.isArmorProficient(item, wearer.armorProficiencies) : true),
      })
    }
    options.push({ disabled: false, short: "Done", value: null, name: "Finish shopping" });

    const choice = await this.driver.select("Available armor to purchase:", options);
    if (choice === null) {
      this.leaving = true;
      return events;
    }
    const item = choice;

    if (this.gold >= item.value) {
      const inventory = this.gameState.inventory;
      const { oldItemRef: maybeOldItem } = Inventory.equipmentSlotAndExistingItem(item, wearer, inventory);
      if (maybeOldItem) {
        const oldItem = Inventory.materializeRef(maybeOldItem, this.gameState.inventory);
        events.push({
          type: "sale",
          itemName: oldItem.name,
          revenue: oldItem.value,
          seller: wearer,
          day: this.day,
        });
      }

      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        subject: wearer,
        day: this.day,
      });
      const equipment = Deem.evaluate(`lookup(masterArmor, "${item.key}")`) as unknown as Equipment;
      const slot = equipment.kind;
      events.push({
        type: "equip",
        itemName: item.name,
        itemKey: item.key,
        slot,
        wearerId: wearer.id,
        wearerName: wearer.forename,
        day: this.day,
      })
    }
    return events;
  }

  private async lootShop(
    itemRestrictions: ItemRestrictions = {}
  ): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];

    const buyingSelling = await this.driver.select("Would you like to buy or sell?", [
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
    ]);

    if (buyingSelling === "buy") {
      events.push(...await this.buyGear(itemRestrictions))
    } else if (buyingSelling === "sell") {
      events.push(...await this.sellItems());
    } else if (buyingSelling === "sell_junk") {
      events.push(...this.sellJunk());
    } else if (buyingSelling === "done") {
      this.leaving = true;
    }

    return events;
  }

  private async buyGear(itemRestrictions: ItemRestrictions = {}): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    // const gearItemNames = Deem.evaluate(`gather(masterGear)`) as string[];
    const gearItemNames = Catalog.gatherWithRestrictions('masterGear', itemRestrictions);
    const options: Choice[] = [];
    for (let index = 0; index < gearItemNames.length; index++) {
      const itemName = gearItemNames[index];
      const item = Deem.evaluate(`lookup(masterGear, "${itemName}")`) as unknown as Equipment;
      item.key = itemName;
      options.push({
        short: Words.humanize(itemName) + ` (${item.value}g)`,
        value: item as Equipment & ItemInstance,
        name: `${Words.humanize(itemName)} - ${item.description || 'no description'} (${item.value}g)`,
        disabled: this.gold < item.value,
      })
    }

    options.push({ disabled: false, short: "Done", value: null, name: "Finish shopping" });

    const choice = await this.driver.select("Available gear to purchase:", options) as Equipment & ItemInstance | null;
    if (choice === null) {
      this.leaving = true;
      return events;
    }

    const item = choice;

    if (this.gold >= item.value) {
      const firstPc = this.party[0];
      events.push({
        type: "purchase",
        itemName: item.name || item.key,
        cost: item.value,
        subject: firstPc,
        day: this.day,
      });

      events.push({
        type: "acquire",
        subject: firstPc,
        itemName: item.name || item.key,
        itemKey: item.key,
        quantity: 1,
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
        value: item as Equipment,
        name: `${Words.humanize(itemKey)} - ${item.description || 'no description'} x${qty} (${item.value}g each)`,
        disabled: false,
      });
    }
    lootOptions.push({ disabled: false, short: "Done", value: null, name: "Finish selling" });

    const choice = await this.driver.select("Available items to sell:", lootOptions) as Equipment | null;
    if (choice === null) {
      this.leaving = true;
      return events;
    }
    const item = choice; // as Equipment;

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
    }
    return events;
  }

  private sellJunk(): ModuleEvent[] {
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
      }
    }
    return events;
  }

  private async equipmentShop(
    itemRestrictions: { kind?: string[]; rarity?: string[] } = {}
  ): Promise<ModuleEvent[]> {
    // console.warn(`Entering equipment shop with restrictions: ${JSON.stringify(itemRestrictions)}`);
    const events: ModuleEvent[] = [];
    const magicItemNames: string[] = Catalog.gatherWithRestrictions('masterEquipment', itemRestrictions);
    const pcEquipment = (combatant: Combatant) => {
      const equipmentIds = Object.values(combatant.equipment || {});
      return Words.humanizeList(
        equipmentIds.map(eid => materializeItem(eid, this.gameState.inventory).name)
      );
    }

    const wearerId = await this.pickPartyMember(`Who needs new equipment?`, (combatant) => {
      return `${combatant.name} (${pcEquipment(combatant) || 'no equipment'})`;
    });
    if (wearerId === null) {
      this.leaving = true;
      return events;
    }

    const wearer = this.findPartyMember(wearerId);

    const options = [];
    for (let index = 0; index < magicItemNames.length; index++) {
      const itemName = magicItemNames[index];
      const item = Inventory.reifyFromKey(itemName) as Equipment & ItemInstance;
      item.key = itemName;
      options.push({
        short: Words.humanize(itemName) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemName)} - ${item.description} (${item.value}g)`,
        disabled: this.gold < item.value || (!Inventory.isProficient(item as ItemInstance, wearer))
      })
    }
    options.push({ disabled: false, short: "Done", value: null, name: "Finish shopping" });

    const choice = await this.driver.select("Available equipment to purchase:", options);
    if (choice === null) {
      this.leaving = true;
      return events;
    }
    const item = choice; // as Equipment & ItemInstance;

    if (this.gold >= item.value) {
      const inventory = this.gameState.inventory;
      const { oldItemRef: maybeOldItem, slot: newSlot } = Inventory.equipmentSlotAndExistingItem(item, wearer, inventory);

      if (maybeOldItem) {
        // const oldItem = materializeItem(maybeOldItem, this.gameState.inventory);
        const oldItem = Inventory.materializeRef(maybeOldItem, this.gameState.inventory);
        events.push({
          type: "sale",
          itemName: oldItem.name,
          revenue: oldItem.value,
          seller: wearer,
          day: this.day,
        });
      }

      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        subject: wearer,
        day: this.day,
      });
      // this.currentGold -= item.value;
      const equipment = Deem.evaluate(`lookup(masterEquipment, "${item.key}")`) as unknown as Equipment;
      const slot = newSlot || equipment.kind;
      events.push({
        type: "equip",
        itemName: item.name,
        itemKey: item.key,
        slot,
        wearerId: wearer.id,
        wearerName: wearer.forename,
        day: this.day,
      })
    }
    return events;
  }

  private async consumablesShop(
    itemRestrictions: ItemRestrictions = {}
  ): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    // const consumableItemNames = Deem.evaluate(`gather(consumables)`) as string[];
    const consumableItemNames = Catalog.gatherWithRestrictions('consumables', itemRestrictions);
    const options: Choice[] = [];
    for (let index = 0; index < consumableItemNames.length; index++) {
      const itemName = consumableItemNames[index];
      const item = materializeItem(itemName, []);
      const anyoneProficient = this.party.some(pc => {
        return pc.itemProficiencies ? Inventory.isItemProficient(item, pc.itemProficiencies) : false;
      });
      options.push({
        short: item.name + ` (${item.value}g)`,
        value: item,
        name: `${item.name} - ${item.description} (${item.value}g)`,
        disabled: this.gold < item.value || (!anyoneProficient),
      })
    }
    options.push({ disabled: false, short: "Done", value: null, name: "Finish shopping" });

    const choice = await this.driver.select("Available items to purchase:", options) as ItemInstance | null;
    if (choice === null) {
      this.leaving = true;
      return events;
    }
    const item = choice as {
      key: string;
      name: string;
      description: string;
      value: number;
    };

    if (this.gold >= item.value) {
      const firstPc = this.party[0];
      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        subject: firstPc,
        day: this.day,
      });

      events.push({
        type: "acquire",
        itemKey: item.key,
        itemName: item.name,
        quantity: 1,
        subject: firstPc,
        day: this.day,
      });
    }
    return events;
  }

  private async weaponsShop(
    itemRestrictions: ItemRestrictions = {}
  ): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    // const weaponItemKeys = Deem.evaluate(`gather(masterWeapon, -1, '!dig(#__it, "natural")')`) as string[];
    const weaponItemKeys = Catalog.gatherWithRestrictions('masterWeapon', itemRestrictions);
    weaponItemKeys.sort();
    const pcWeapon = (combatant: Combatant) => {
      return combatant.equipment && combatant.equipment.weapon
        ? materializeItem(combatant.equipment.weapon, this.gameState.inventory).name
        : 'unarmed';
    }
    const wielderId = await this.pickPartyMember(`Who needs a new weapon?`, (combatant) => {
      return `${combatant.name} (${pcWeapon(combatant)})`;
    });
    if (wielderId === null) {
      this.leaving = true;
      return events;
    }
    const wielder = this.findPartyMember(wielderId);

    const options: Choice<Weapon & ItemInstance>[] = [];
    for (let index = 0; index < weaponItemKeys.length; index++) {
      const itemKey = weaponItemKeys[index];
      const item = Inventory.reifyFromKey(itemKey) as Weapon & ItemInstance;
      item.key = itemKey;
      options.push({
        short: Words.humanize(itemKey) + ` (${item.value}g)`,
        value: item,
        name: `${Words.humanize(itemKey)} - ${item.damage} ${item.weight} ${item.kind} (${item.value}g)`,
        disabled: this.gold < item.value || (wielder.weaponProficiencies ? !Inventory.isWeaponProficient(item, wielder.weaponProficiencies) : true),
      })
    }
    options.push({ disabled: false, short: "Done", value: null, name: "Finish shopping" });

    const choice = await this.driver.select("Available weapons to purchase:", options) as Weapon & ItemInstance | null;
    if (choice === null) {
      this.leaving = true;
      return events;
    }
    const item = choice;
    if (this.gold >= item.value) {
      events.push({
        type: "purchase",
        itemName: item.key,
        cost: item.value,
        subject: wielder,
        day: this.day,
      });
      events.push({
        type: "wield",
        weaponKey: item.key,
        weaponName: item.name,
        wielderId: wielder.id,
        wielderName: wielder.forename,
        day: this.day,
      } as WieldEvent);
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

    const improverId = await this.pickPartyMember(`Who needs an enhancement?`, (combatant) => {
      return `${combatant.name} (${weaponDetails(combatant)})`;
    });
    if (improverId === null) {
      this.leaving = true;
      return events;
    }
    const improver = this.findPartyMember(improverId);

    const currentWeaponInstance = improver.equipment && improver.equipment.weapon
      ? materializeItem(improver.equipment.weapon, this.gameState.inventory) as Weapon & ItemInstance
      : null;

    if (!currentWeaponInstance) {
      console.warn(`${improver.name} is unarmed and cannot have their weapon enhanced.`);
      return events;
    }

    if (currentWeaponInstance.natural) {
      console.warn(`${improver.name} is wielding a natural weapon (${currentWeaponInstance.name}) and cannot have it enhanced.`);
      return events;
    }

    const originalAttackDie = currentWeaponInstance.damage;
    const [baseDie, modifier] = originalAttackDie.split('+').map(s => s.trim());

    const modifierNumber = modifier ? parseInt(modifier) : 0;

    const [dieNumber, dieSides] = baseDie.split('d').map(s => s.trim()).map(s => parseInt(s));
    const dieClasses = [2, 3, 4, 6, 8, 10, 12, 20, 30, 60, 100];
    const baseDieIndex = dieClasses.indexOf(dieSides);
    if (baseDieIndex < 0) {
      console.warn(`Cannot enhance weapon with unknown damage die ${originalAttackDie}.`);
      return events;
    }

    const upgradedAttackDie = dieClasses[Math.min(baseDieIndex + 1, dieClasses.length - 1)];

    const costs = {
      sharpen: 500 + (modifierNumber * 200),
      reinforce: 750 + (baseDieIndex * 300),
      imbue: 1000 + (dieNumber * 500),
    }

    const improvementRequested = await this.driver.select("What type of enhancement would you like?", [
      {
        short: "Sharpen Weapon",
        value: "sharpen",
        name: `${'Sharpen'.padEnd(12)} | Improve your weapon's minimum damage (from ${originalAttackDie} to ${baseDie}+${modifierNumber + 1}) (Cost: ${costs.sharpen} gp)`,
        disabled: modifierNumber >= 5 || costs.sharpen > this.gold,
      },
      {
        short: "Reinforce Weapon",
        value: "reinforce",
        name: `${'Reinforce'.padEnd(12)} | Improve your weapon's base damage die (from ${originalAttackDie} to ${dieNumber}d${upgradedAttackDie}${modifier ? ` + ${modifierNumber}` : ''}) (Cost: ${costs.reinforce} gp)`,
        disabled: baseDieIndex >= dieClasses.length - 1 || costs.reinforce > this.gold,
      },
      {
        short: "Imbue Weapon",
        value: "imbue",
        name: `${'Imbue'.padEnd(12)} | Improve your weapon's die number (from ${originalAttackDie} to ${dieNumber + 1}d${dieSides}${modifier ? ` + ${modifierNumber}` : ''}) (Cost: ${costs.imbue} gp)`,
        disabled: dieNumber >= 5 || costs.imbue > this.gold,
      },
      {
        short: "Done",
        value: "done",
        name: "Finish shopping",
        disabled: false,
      },
    ]);

    if (improvementRequested === "done") {
      this.leaving = true;
      return events;
    }

    // modify weapon
    const cost = costs[improvementRequested as keyof typeof costs];
    events.push({
      type: "purchase",
      itemName: `${improvementRequested} enhancement`,
      cost,
      subject: improver,
      day: this.day,
    })
    switch (improvementRequested) {
      case "sharpen": {
        const newModifier = modifierNumber + 1;
        const newAttackDie = `${baseDie} + ${newModifier}`;
        events.push({
          type: "enhanceWeapon",
          weaponKey: currentWeaponInstance.key,
          weaponName: currentWeaponInstance.name,
          weaponId: currentWeaponInstance.id,
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
          weaponKey: currentWeaponInstance.key,
          weaponName: currentWeaponInstance.name,
          weaponId: currentWeaponInstance.id,
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
          weaponKey: currentWeaponInstance.key,
          weaponName: currentWeaponInstance.name,
          weaponId: currentWeaponInstance.id,
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
}