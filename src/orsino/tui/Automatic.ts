import { Answers } from "inquirer";
import Choice from "inquirer/lib/objects/choice";

export default class Automatic {
  static randomSelect<T extends Answers>(_prompt: string, choices: (
    readonly (string)[] | Choice<T>[]
  )): Promise<string | Choice<T>> {
    const chosen = choices[Math.floor(Math.random() * choices.length)];
    if (typeof chosen === 'string') {
      return Promise.resolve(chosen);
    } else {
      return Promise.resolve(chosen.value);
    }
  }
}