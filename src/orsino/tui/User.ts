import { select } from "@inquirer/prompts";
import { RollResult } from "../types/RollResult";
import { Combatant } from "../types/Combatant";
import { Commands } from "../rules/Commands";
import { Fighting } from "../rules/Fighting";
import { Answers } from "inquirer";
import Automatic from "./Automatic";
import { Select } from "../types/Select";

export default class User {
  // print the message and return the user's input
  static async prompt(message: string): Promise<string> {
    process.stdout.write(message + " ");
    return new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.once("data", (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  static selection: Select<Answers> = async (
    message,
    choices,
    subject
  ) => {
    if (choices.length === 0) {
      throw new Error("No choices provided for selection");
    }

    const effectivelyPlayerControlled = subject ? Fighting.effectivelyPlayerControlled(subject) : true;
    if (subject && !effectivelyPlayerControlled) {
      return Automatic.randomSelect(message, choices);
    }

    // console.log(`Selecting for ${subject?.name}: ${message}`);
    // const options = choices as readonly (Separator | Choice<Answers>)[];
    const selection = await select({
      message,
      choices: choices as any
    }) as string | Answers;
    return selection;
  }

  static roll(subject: Combatant, description: string, sides: number): RollResult {
    return Commands.roll(subject, description, sides);
    // if (!subject.playerControlled) {
    //   const result = Commands.roll(subject, description, sides);
    //   // await Spinner.run(`${subject.name} is rolling ${description}`, 20 + Math.random() * 140, result.description);
    //   // console.log(result.description);
    //   return result;
    // }

    // // await new Promise(resolve => setTimeout(resolve, 100));
    // // await Spinner.waitForInputAndRun(
    // //   `>>> ${subject.name} to roll d${sides} ${description}... <<<`,
    // //   `${subject.name} rolling d${sides} ${description}`
    // // );
    // // // Then do the actual roll
    // const result = Commands.roll(subject, description, sides);
    // // console.log(result.description);
    // return result;
  }

  static async waitForEnter(message: string): Promise<void> {
    process.stdout.write(message);
    // ask to press enter
      process.stdin.setRawMode(true);
      process.stdin.resume();
      await new Promise<void>(resolve => {
        process.stdin.once("data", () => {
          process.stdin.setRawMode(false);
          resolve();
        });
      });
  }

  static async confirmation(message: string): Promise<boolean> {
    const input = await User.selection(message + " (y/n):", ["yes", "no"]);
    return String(input).toLowerCase().startsWith("y");
  }
}