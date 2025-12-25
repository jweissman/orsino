import Choice from "inquirer/lib/objects/choice";

export default class Automatic {
  static async randomSelect(_prompt: string, choices: (
    readonly (string)[] | Choice<any>[]
  )): Promise<string | Choice<any>> {
    let chosen = choices[Math.floor(Math.random() * choices.length)];
    if (typeof chosen === 'string') {
      return chosen;
    } else {
      return chosen.value;
    }
  }
}