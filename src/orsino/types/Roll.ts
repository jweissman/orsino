import { RollResult } from "./RollResult";
import { Combatant } from "./Combatant";

export type Roll = (
  subject: Combatant,
  description: string,
  sides: number,
) => Promise<RollResult>;
