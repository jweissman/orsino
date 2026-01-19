import { GameEvent, AcquireItemEvent, EquipmentEvent, WieldEvent, EnhanceWeaponEvent, BlessServiceEvent, ItemRechargedEvent, RestEvent } from "../Events";
import { Inventory } from "../Inventory";
import { Combatant } from "../types/Combatant";
import { GameState } from "../types/GameState";
import { ItemInstance } from "../types/ItemInstance";

export class GameStateReducer {
  static processEvent = (state: GameState, event: GameEvent): GameState => {
    const newState = { ...state };
    switch (event.type) {
      case "newDay":
        newState.day = event.day;
        break;

      // case "townEntered":
      case "shopEntered":
      case "templeEntered":
        // no state change
        break;
      case "rumorHeard":
        if (!newState.campaignModule.discoveredDungeons.includes(event.dungeonIndex)) {
          newState.campaignModule.discoveredDungeons = newState.campaignModule.discoveredDungeons.concat([event.dungeonIndex]);
        }
        break;
      case "hirelingHired":
        newState.party = newState.party.concat([event.hireling]);
        newState.sharedGold = newState.sharedGold - event.cost;
        newState.inventory = newState.inventory.concat(...this.gatherStartingGear(event.hireling));
        newState.campaignModule.town.tavern.hirelings =
          newState.campaignModule.town.tavern.hirelings.filter(h => h.id !== event.hireling.id);
        break;
      case "purchase":
        newState.sharedGold = newState.sharedGold - event.cost;
        break;
      case "sale":
        newState.sharedGold = newState.sharedGold + event.revenue;
        break;
      case "donation":
        newState.sharedGold = newState.sharedGold - event.amount;
        break;
      case "acquire":
        return this.handleAcquisition(newState, event);
      case 'equip':
        return this.handleEquip(newState, event);
      case "wield":
        return this.handleWield(newState, event);
      case "enhanceWeapon":
        return this.handleEnhance(newState, event);
      case "blessingGranted":
        return this.handleBlessing(newState, event);
      case "itemRecharged":
        return this.handleRecharge(newState, event);
      case "resurrectionService":
        return this.handleRevival(newState, event);
      case "rest":
        return this.handleRest(newState, event);

      case "dungeonCompleted":
        if (!newState.campaignModule.completedDungeons.includes(event.dungeonIndex)) {
          newState.campaignModule.completedDungeons = newState.campaignModule.completedDungeons.concat([event.dungeonIndex]);
        }
        break;

      default:
      // console.warn(`Unhandled event type in processEvents: ${event.type}`);
      // return never(event);
    }

    return newState;
  };

  private static handleRest = (state: GameState, event: RestEvent): GameState => {
    state.party = state.party.map(pc => {
      if (event.stabilizedCombatantIds.includes(pc.id)) {
        return {
          ...pc,
          dead: false,
          activeEffects: [],
          hp: 1,
        };
      }
      if (event.healedCombatantIds?.includes(pc.id)) {
        return {
          ...pc,
          hp: pc.maximumHitPoints,
          spellSlotsUsed: 0,
          activeEffects: pc.activeEffects?.filter(effect => effect.type !== "condition") || [],
        };
      }
      if (event.diedCombatantIds?.includes(pc.id)) {
        return {
          ...pc,
          dead: true,
          hp: -10,
        };
      }
      return pc;
    });
    return state;
  }

  private static handleRevival = (state: GameState, event: GameEvent): GameState => {
    state.party = state.party.map(pc => {
      if (pc.id === event.subject?.id) {
        // console.warn(`Resurrecting ${pc.name} on day ${event.day}`);
        return {
          ...pc,
          dead: false,
          hp: pc.maximumHitPoints
        };
      }
      return pc;
    });
    return state;
  }

  private static handleAcquisition = (state: GameState, event: AcquireItemEvent): GameState => {
    const it = {
      ...Inventory.genLoot(event.itemKey),
      ownerId: event.subject?.id,
      ownerSlot: 'backpack',
    };
    it.shared = it.itemClass === 'consumable';
    // console.warn(`Acquired ${event.quantity} x ${it.name} for ${event.subject?.name} (shared: ${it.shared})`);
    const items = Array.from({ length: event.quantity }, () => ({
      ...it,
      id: Inventory.genId(it.itemClass ?? "item"),
    }));
    state.inventory = [
      ...(state.inventory ?? []),
      ...items,
    ];
    return state;
  };

  private static handleEquip = (state: GameState, event: EquipmentEvent): GameState => {
    Inventory.assertItemRef(event.itemKey, `processEvent equip for ${event.wearerId} on day ${event.day}`);
    state.party = (state.party ?? []).map((pc: Combatant) => {
      if (pc.id === event.wearerId) {
        // console.warn(`!!! Equipping ${event.itemKey} to ${pc.name} in slot ${event.slot} on day ${event.day} [pcId=${pc.id}, wearerId=${event.wearerId}]`);
        return {
          ...pc,
          equipment: {
            ...(pc.equipment || {}),
            [event.slot]: event.itemKey,
          }
        };
      } else {
        return pc;
      }
    });
    return state;
  };

  private static handleWield = (state: GameState, event: WieldEvent): GameState => {
    Inventory.assertItemRef(event.weaponKey, `processWieldEvent for ${event.wielderId} on day ${event.day}`);
    const weapon = Inventory.reifyFromKey(event.weaponKey);
    const weaponId = weapon.id || Inventory.genId(weapon.itemClass ?? "weapon");
    state.inventory = [
      ...state.inventory,
      { ...weapon, id: weaponId, ownerId: event.wielderId, ownerSlot: 'weapon' }
    ];
    state.party = state.party.map((pc: Combatant) => {
      if (pc.id === event.wielderId) {
        return {
          ...pc,
          equipment: {
            ...(pc.equipment || {}),
            weapon: weaponId,
          }
        };
      } else {
        return pc;
      }
    });
    return state;
  };

  private static handleEnhance = (newState: GameState, event: EnhanceWeaponEvent): GameState => {
    let weaponId = event.weaponId;
    const wielder = newState.party.find(pc => pc.id === event.wielderId);
    if (!wielder?.equipment?.weapon?.includes(":")) {
      // console.warn(`!!! Reifying weapon ${event.weaponName} for wielderId ${event.wielderId} on day ${event.day} -- currently uninstantiated weapon key ${wielder?.equipment?.weapon}`);
      const weaponInstance = Inventory.reifyFromKey(event.weaponKey);
      if (!weaponInstance.id) {
        throw new Error(`Could not reify weapon ${event.weaponName} for wielderId ${event.wielderId} on day ${event.day} -- no id`);
      }
      weaponId = weaponInstance.id;
      Inventory.assertItemRef(weaponId, `processEvent enhanceWeapon for ${event.wielderId} on day ${event.day}`);
      newState.inventory = [
        ...newState.inventory,
        { ...weaponInstance, id: weaponId, ownerId: event.wielderId, ownerSlot: 'weapon' }
      ];
      newState.party = newState.party.map((pc: Combatant) => {
        if (pc.id === event.wielderId) {
          return {
            ...pc,
            equipment: {
              ...(pc.equipment || {}),
              weapon: weaponId,
            }
          };
        } else {
          return pc;
        }
      });
    }
    // alter weapon in inventory
    newState.inventory = newState.inventory.map((it) => {
      if (it.ownerId === event.wielderId && it.id === weaponId) {
        // console.warn(`!!! Enhancing weapon ${it.name} for ${it.ownerId} with ${event.enhancement} on day ${event.day}`);
        return {
          ...it,
          damage: event.newDamage,
        };
      } else {
        return it;
      }
    });

    return newState;
  };

  private static handleBlessing = (state: GameState, event: BlessServiceEvent): GameState => {
    const subject = event.subject as Combatant;
    if (subject === undefined || subject === null) {
      throw new Error(`No subject for blessingGranted event`);
    }
    state.party = state.party.map(pc => {
      if (pc.id === subject.id) {
        const hasBlessing = (pc.activeEffects || []).some(effect => effect.name === event.blessing.name);
        if (hasBlessing) {
          return pc;
        }
        // console.warn(`Applying blessing ${event.blessing.name} to ${pc.name} on day ${event.day}`);
        return {
          ...pc,
          activeEffects: [
            ...(pc.activeEffects || []),
            event.blessing,
          ],
        };
      }
      return pc;
    });
    return state;
  };

  private static handleRecharge = (state: GameState, event: ItemRechargedEvent): GameState => {
    state.inventory = state.inventory.map((it) => {
      if (it.id === event.itemId) {
        // console.warn(`Updating charges for item ${it.name} from ${event.chargesBefore} to ${event.chargesAfter} on day ${event.day}`);
        return {
          ...it,
          charges: event.chargesAfter,
        };
      } else {
        return it;
      }
    });
    return state;
  };

  private static gatherStartingGear(pc: Combatant): ItemInstance[] {
    const itemNames: string[] = pc.startingGear || [];
    const items: ItemInstance[] = [];
    for (const itemName of itemNames) {
      const item = { ...Inventory.genLoot(itemName), ownerId: pc.id, ownerSlot: 'backpack' };
      item.shared = item.itemClass === 'consumable';
      items.push(item);
    }
    return items;
  }
}
