// import { Separator } from "@inquirer/select";
import { Answers } from "inquirer";
import Choice from "inquirer/lib/objects/choice";
import { Combatant } from "./Combatant";

export type Select<T extends Answers> =
  (
    prompt: string,
    options: readonly Choice<T>[] | readonly string[],
    subject?: Combatant
  ) => Promise<T | string>;
