import { Combatant } from "./Combatant";
import { ItemInstance } from "./ItemInstance";

export interface Team {
  name: string;
  combatants: Combatant[];

  // healingPotions: number;
  // inventory: { [itemName: string]: number };
  inventory: Array<ItemInstance>;
}
