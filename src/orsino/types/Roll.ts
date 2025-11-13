import { RollResult } from "../Combat";
import { Combatant } from "./Combatant";

export type Roll = (
  subject: Combatant,
  description: string,
  sides: number,
  dice: number
) => Promise<RollResult>;
