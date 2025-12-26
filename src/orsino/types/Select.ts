import { Separator } from "@inquirer/select";
import { Answers } from "inquirer";
import Choice from "inquirer/lib/objects/choice";

export type Select<T extends Answers> =
  (
    prompt: string,
    options: readonly (Separator | Choice<T>)[] | readonly string[]
  ) => Promise<T | string>;
// export type Select = (
//       prompt: string,
//       choices: (
//         readonly (string)[] | Choice<any>[]
//       )
//     ) => Promise<string | Choice<any>>;

