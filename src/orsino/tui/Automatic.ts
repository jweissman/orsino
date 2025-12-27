import { Answers } from "inquirer";
// import Choice from "inquirer/lib/objects/choice";
import { Select } from "../types/Select";
import { Separator } from "@inquirer/select";

export default class Automatic {
  static randomSelect: Select<Answers> = ( _prompt, choices) => {
    if (choices.length === 0) {
      throw new Error("No choices provided to Automatic.randomSelect");
    }

    const allStrings = choices.every(c => typeof c === 'string');
    if (allStrings) {
      const stringChoices = choices as unknown as string[];
      const chosen = stringChoices[Math.floor(Math.random() * stringChoices.length)];
      return Promise.resolve(chosen);
    }

    const options = choices;
    const enabledOptions = options.filter((option) => !(option instanceof Separator) && !option.disabled)

    if (enabledOptions.length === 0) {
      throw new Error("No enabled choices provided to Automatic.randomSelect");
    }

    const chosen = enabledOptions[Math.floor(Math.random() * enabledOptions.length)] as { value: string | Answers; };

    return Promise.resolve(chosen.value);
  }
}