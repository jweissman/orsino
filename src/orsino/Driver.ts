import User from "./tui/User";

type Choice<T> = {
  name: string;
  short?: string;
  value: T;
  disabled?: boolean;
};

export interface Driver {
  description: string;

  write(text: string): void;
  writeLn(text: string): void;
  clear(): void;
  select<T>(message: string, choices: (readonly string[] | readonly Choice<T>[])): Promise<T>;
  confirm(message: string): Promise<boolean>;
  input(message: string): Promise<string>;
  pause(message: string): Promise<void>;
  readKey(): Promise<string>;

  // roll(actor: Combatant, description: string, sides: number): RollResult;
}

export class ConsoleDriver implements Driver {
  get description(): string { return "ConsoleDriver with stdin/stdout"; }

  // roll(_actor: unknown, _description: string, sides: number) {
  //   // return { amount: Math.floor(Math.random() * sides) + 1, description: `Rolled a d${sides}` };
  //   return Commands.roll(_actor as Combatant, _description, sides);
  // }

  write(text: string): void { process.stdout.write(text); }
  writeLn(text: string): void { process.stdout.write(text + "\n"); }
  clear(): void {
    // console.clear();
    process.stdout.write('\x1Bc');
  }

  async select<T>(message: string, choices: (readonly string[] | readonly Choice<T>[])): Promise<T> {
    while (true) {
      this.write(message + "\n");
      choices.forEach((choice, index) => {
        if (typeof choice === "string") {
          this.write(`  ${index + 1}) ${choice}\n`);
          return;
        }

        if (choice.disabled) {
          this.write(`  ${index + 1}) ${choice.name} (disabled)\n`);
          return;
        }
        this.write(`  ${index + 1}) ${choice.name}\n`);
      });
      const input = await this.input("Select an option:");
      const index = parseInt(input, 10) - 1;
      if (isNaN(index) || index < 0 || index >= choices.length) {
        // throw new Error("Invalid selection");
        this.write("Invalid selection. Please try again.\n");
        continue;
      }
      if (typeof choices[index] === "string") {
        return choices[index] as unknown as T;
      }
      if ((choices[index]).disabled) {
        this.write("That option is disabled. Please choose another.\n");
        continue;
      }
      return choices[index].value;
    }
  }

  async confirm(message: string): Promise<boolean> {
    const input = await this.input(message + " (y/n):");
    return input.toLowerCase().startsWith("y");
  }

  private _readLock: Promise<void> = Promise.resolve();

  async input(message: string): Promise<string> {
    // serialize all reads
    let release!: () => void;
    const next = new Promise<void>(r => (release = r));
    const prev = this._readLock;
    this._readLock = prev.then(() => next);

    await prev;
    try {
      this.write(message + " ");
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      return await new Promise((resolve) => {
        process.stdin.once("data", (data) => resolve(String(data).trim()));
      });
    } finally {
      release();
      process.stdin.pause();
    }
  }

  async pause(message = "Press Enter to continue..."): Promise<void> {
    await this.input(message);
  }

  async readKey(): Promise<string> {
    this.write("Press any key to continue...");
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const wasRaw = (stdin).isRaw;

      const cleanup = () => {
        try { if (stdin.isTTY) { stdin.setRawMode(!!wasRaw); } } catch {
          // ignore
        }
        stdin.pause();
      };

      try { if (stdin.isTTY) { stdin.setRawMode(true); } } catch {
        // ignore
      }
      stdin.resume();

      stdin.once("data", (data: Buffer) => {
        cleanup();
        resolve(data.toString());
      });
    });
  }
}

export class InquirerDriver extends ConsoleDriver implements Driver {
  get description(): string { return "InquirerDriver using inquirer for prompts"; }
  async select<T>(message: string, choices: (readonly string[] | readonly Choice<T>[])): Promise<T> {
    return User.selection(message, choices as unknown as readonly string[]) as Promise<T>;
  }

  async confirm(message: string): Promise<boolean> {
    const input = await User.selection(message + " (y/n):", ["yes", "no"]);
    return String(input as string).toLowerCase().startsWith("y");
  }
}

export class NullDriver implements Driver {
  get description(): string { return "NullDriver that performs no I/O"; }
  write(_text: string): void { }
  writeLn(_text: string): void { }
  clear(): void { }
  // roll(_actor: unknown, _description: string, sides: number) {
  //   return { amount: Math.floor(Math.random() * sides) + 1, description: `Rolled a d${sides}` };
  // }

  async select<T>(_message: string, choices: (readonly string[] | readonly Choice<T>[])): Promise<T> {
    if (choices.length === 0) {
      throw new Error("No choices provided to NullDriver.select");
    }
    const enabled = choices.filter(c => typeof c === "string" || !c.disabled);
    if (enabled.length === 0) {
      throw new Error("No enabled choices provided to NullDriver.select");
    }
    // return (typeof enabled === "string" ? enabled : enabled.value) as T;
    const chosen = enabled[Math.floor(Math.random() * enabled.length)];
    return Promise.resolve((typeof chosen === "string" ? chosen : chosen.value) as T);
  }

  confirm(_message: string): Promise<boolean> { return Promise.resolve(true); }
  input(_message: string): Promise<string> { return Promise.resolve(""); }
  async pause(_message: string): Promise<void> { }
  readKey(): Promise<string> { return Promise.resolve("\n"); }
}

export class AutomaticPlayDriver extends NullDriver implements Driver {
  get description(): string { return "Automatic play driver that logs actions for testing"; }

  write(text: string): void { process.stdout.write(text); }
  writeLn(text: string): void { process.stdout.write(text + "\n"); }
  clear(): void {
    // process.stdout.write('\x1Bc');
    console.clear();
  }
}