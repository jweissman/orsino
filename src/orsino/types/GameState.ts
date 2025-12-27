import { sha } from "bun";
import Deem from "../../deem";
import { AcquireItemEvent, GameEvent, WieldEvent } from "../Events";
import { Inventory, Weapon } from "../Inventory";
import { Combatant } from "./Combatant";
import { ItemInstance } from "./ItemInstance";

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
  state.inventory = [
    ...(state.inventory ?? []),
    ...(Array(event.quantity).fill(it) as ItemInstance[]),
  ];
  return state;
}

const processWieldEvent = (state: GameState, event: WieldEvent): GameState => {
  const weapon = Deem.evaluate(`lookup(masterWeapon, "${event.weaponName}")`) as unknown as Weapon;
  state.party = state.party.map((pc: Combatant) => {
    if (pc.id === event.wielderId) {
      const abilities: string[] = (pc.abilities || [])
        .filter((abil: string) => abil.match(/melee|ranged/i) === null);
      abilities.unshift(weapon.missile ? 'ranged' : 'melee');
      return {
        ...pc,
        weapon: event.weaponName,
        attackDie: weapon.damage,
        damageKind: weapon.type,
        hasMissileWeapon: weapon.missile || false,
        hasInterceptWeapon: weapon.intercept || false,
        abilities
      };
    } else {
      return pc;
    }
  });
  return state;
}

export { newGameState, processEvents };