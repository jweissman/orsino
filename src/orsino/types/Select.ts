import { Answers } from "inquirer";
import Choice from "inquirer/lib/objects/choice";

export type Select<T extends Answers> =
  (
    prompt: string,
    options: Choice<T>[]
  ) => Promise<T | string>;

