import { select } from "@inquirer/prompts";
import { Separator } from "@inquirer/select";
import Choice from "inquirer/lib/objects/choice";
import Combat, { RollResult } from "../Combat";
import { Combatant } from "../types/Combatant";
import Spinner from "./Spinner";

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
      const result = Combat.rollDie(subject, description, sides);
      await Spinner.run(`${subject.name} is rolling ${description}`, 120 + Math.random() * 240, result.description);
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    await Spinner.waitForInputAndRun(
      `>>> ${subject.name} to roll d${sides} ${description}... <<<`,
      `${subject.name} rolling d${sides} ${description}`
    );
    // Then do the actual roll
    let result = Combat.rollDie(subject, description, sides);
    console.log("\r" + result.description);
    return result;
  }
}