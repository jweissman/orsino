import Deem from "../../deem";
import { AcquireItemEvent, GameEvent, WieldEvent } from "../Events";
import { Inventory, Weapon } from "../Inventory";
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

const newGameState = ({ party, sharedGold }: {
  party: Combatant[];
  sharedGold: number;
}): GameState => ({
  day: 1,
  party,
  sharedGold,
  inventory: [],
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
      newState.party = (newState.party ?? []).map((pc: Combatant) => {
        if (pc.id === event.wearerId) {
          console.warn(`!!! Equipping ${event.itemName} to ${pc.name} in slot ${event.slot} on day ${event.day} [pcId=${pc.id}, wearerId=${event.wearerId}]`);
          return {
            ...pc,
            equipment: {
              ...(pc.equipment || {}),
              [event.slot]: event.itemName,
            }
          };
        } else {
          return pc;
        }
      });
      break;
    case "wield":
      return processWieldEvent(newState, event);

    default:
      console.warn(`Unhandled event type in processEvents: ${event.type}`);
      // return never(event);
  }

  return newState;
}

const processAcquireEvent = (state: GameState, event: AcquireItemEvent): GameState => {
  const it = {
    ...Inventory.item(event.itemName),
    ownerId: event.acquirer.id,
    ownerSlot: 'backpack',
  };
  it.shared = it.itemClass === 'consumable';
  console.warn(`Acquired item ${it.name} for ${event.acquirer.name} (shared: ${it.shared})`);
  state.inventory = [
    ...(state.inventory ?? []),
    ...(Array(event.quantity).fill(it) as ItemInstance[]),
  ];
  return state;
}

const processWieldEvent = (state: GameState, event: WieldEvent): GameState => {
  const weapon = materializeItem(event.weaponName, state.inventory);
  state.inventory.push(weapon);
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