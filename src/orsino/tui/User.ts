import { select } from "@inquirer/prompts";
import { Separator } from "@inquirer/select";
import inquirer from "inquirer";
import Choice from "inquirer/lib/objects/choice";
import Combat from "../Combat";
import { RollResult } from "../types/RollResult";
import { Combatant } from "../types/Combatant";
import Spinner from "./Spinner";
import { Commands } from "../rules/Commands";

export default class User {
  // print the message and return the user's input
  static async prompt(message: string): Promise<any> {
    process.stdout.write(message + " ");
    return new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  static async multiSelect(
    message: string,
    choices: string[], //(readonly (string | Separator)[] | Choice<any>[]),
    count: number = 3
  ): Promise<any[]> {
    if (choices.length === 0) {
      throw new Error("No choices provided for selection");
    }

    // return await inquirer.prompt(message, { choices, type: 'checkbox'});
    let selections: string[] = [];
    while (selections.length < count) {
      const answer = await select<string>({
        message: `${message} (${selections.length + 1}/${count})`,
        choices: choices.filter(c => !selections.includes(c))
      });
      if (!selections.includes(answer)) {
        selections.push(answer);
      }
    }
    console.log(`You selected: ${selections.join(", ")}`);
    return selections;
  }

  static async selection(
    message: string,
    choices: (
      readonly (string | Separator)[] | Choice<any>[]
    ),
    subject?: Combatant,
  ): Promise<any> {
    if (choices.length === 0) {
      throw new Error("No choices provided for selection");
    }

    if (subject && !subject.playerControlled) {
      return Combat.samplingSelect(message, choices as any);
    }

    // console.log(`Selecting for ${subject?.name}: ${message}`);
    return await select({ message, choices: choices as any })
  }

  static async roll(subject: Combatant, description: string, sides: number): Promise<RollResult> {
    if (!subject.playerControlled) {
      const result = await Commands.roll(subject, description, sides);
      // await Spinner.run(`${subject.name} is rolling ${description}`, 20 + Math.random() * 140, result.description);
      console.log(result.description);
      return result;
    }

    // await new Promise(resolve => setTimeout(resolve, 100));
    // await Spinner.waitForInputAndRun(
    //   `>>> ${subject.name} to roll d${sides} ${description}... <<<`,
    //   `${subject.name} rolling d${sides} ${description}`
    // );
    // // Then do the actual roll
    let result = await Commands.roll(subject, description, sides);
    console.log(result.description);
    return result;
  }
}