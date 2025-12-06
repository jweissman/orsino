import { Combatant } from "./Combatant";

export interface Team {
  name: string;
  combatants: Combatant[];

  // healingPotions: number;
  inventory: { [itemName: string]: number };
}
