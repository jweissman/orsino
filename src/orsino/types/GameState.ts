import { AcquireItemEvent, GameEvent, WieldEvent } from "../Events";
import { Inventory } from "../Inventory";
import { Combatant } from "./Combatant";
import { ItemInstance, materializeItem } from "./ItemInstance";

export interface GameState {
  day: number;
  party: Combatant[];
  sharedGold: number;
  inventory: Array<ItemInstance>;
  completedDungeons: number[];
  discoveredDungeons: number[];
}

const newGameState = ({ party, sharedGold, inventory }: {
  party: Combatant[];
  sharedGold: number;
  inventory: ItemInstance[];
}): GameState => ({
  day: 1,
  party,
  sharedGold,
  inventory,
  completedDungeons: [],
  discoveredDungeons: [],
});


const processEvents = (state: GameState, events: GameEvent[]): GameState => {
  let s = { ...state };
  for (const event of events) {
    s = processEvent(s, event);
  }
  return s;
};


const processEvent = (state: GameState, event: GameEvent): GameState => {
  const newState = { ...state };
  switch (event.type) {
    case "shopEntered":
      // no state change
      break;
    case "purchase":
      newState.sharedGold = newState.sharedGold - event.cost;
      break;
    case "sale":
      newState.sharedGold = newState.sharedGold + event.revenue;
      break;
    case "acquire":
      return processAcquireEvent(newState, event);
    case 'equip':
      Inventory.assertItemRef(event.itemKey, `processEvent equip for ${event.wearerId} on day ${event.day}`);
      newState.party = (newState.party ?? []).map((pc: Combatant) => {
        if (pc.id === event.wearerId) {
          console.warn(`!!! Equipping ${event.itemKey} to ${pc.name} in slot ${event.slot} on day ${event.day} [pcId=${pc.id}, wearerId=${event.wearerId}]`);
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
      break;
    case "wield":
      return processWieldEvent(newState, event);
    case "enhanceWeapon":
      let weaponId = event.weaponId;
      const wielder = newState.party.find(pc => pc.id === event.wielderId);
      if (!wielder?.equipment?.weapon?.includes(":")) {
        console.warn(`!!! Reifying weapon ${event.weaponName} for wielderId ${event.wielderId} on day ${event.day} -- currently uninstantiated weapon key ${wielder?.equipment?.weapon}`);
        const weaponInstance = Inventory.reifyFromKey(event.weaponKey);
          //materializeItem(event.weaponKey, newState.inventory);
        if (!weaponInstance.id) {
          throw new Error(`Could not reify weapon ${event.weaponName} for wielderId ${event.wielderId} on day ${event.day} -- no id`);
        }
        weaponId = weaponInstance.id;
        Inventory.assertItemRef(weaponId, `processEvent enhanceWeapon for ${event.wielderId} on day ${event.day}`);
        newState.inventory.push({ ...weaponInstance, ownerId: event.wielderId, ownerSlot: 'weapon' });
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
          console.warn(`!!! Enhancing weapon ${it.name} for ${it.ownerId} with ${event.enhancement} on day ${event.day}`);
          return {
            ...it,
            damage: event.newDamage,
          };
        } else {
          return it;
        }
      });
      break;


    default:
      console.warn(`Unhandled event type in processEvents: ${event.type}`);
      // return never(event);
  }

  return newState;
}

const processAcquireEvent = (state: GameState, event: AcquireItemEvent): GameState => {
  const it = {
    ...Inventory.genLoot(event.itemKey),
    ownerId: event.acquirer.id,
    ownerSlot: 'backpack',
  };
  it.shared = it.itemClass === 'consumable';
  console.warn(`Acquired ${event.quantity} x ${it.name} for ${event.acquirer.name} (shared: ${it.shared})`);
  const items = Array(event.quantity).fill(it) as ItemInstance[];
  state.inventory = [
    ...(state.inventory ?? []),
    ...items.map(i => ({ ...i, id: Inventory.genId("item") })),
  ];
  return state;
}

const processWieldEvent = (state: GameState, event: WieldEvent): GameState => {
  Inventory.assertItemRef(event.weaponKey, `processWieldEvent for ${event.wielderId} on day ${event.day}`);
  const weapon = Inventory.reifyFromKey(event.weaponKey);
  console.warn(`Wielding weapon ${weapon.name} for ${event.wielderName} on day ${event.day}`);
    //materializeItem(event.weaponName, state.inventory);
  state.inventory.push({ ...weapon, ownerId: event.wielderId, ownerSlot: 'weapon' });
  state.party = state.party.map((pc: Combatant) => {
    if (pc.id === event.wielderId) {
      return {
        ...pc,
        equipment: {
          ...(pc.equipment || {}),
          weapon: weapon.id || weapon.key || event.weaponName,
        }
      };
    } else {
      return pc;
    }
  });
  return state;
}

export { newGameState, processEvents };