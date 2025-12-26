import readline from 'node:readline';

export default class Spinner {
  static spinnerThemes = {
    simple: ['|', '/', '-', '\\'],
    circles: ['◐', '◓', '◑', '◒'],
    luna:    ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
    chrono: ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'],
    card: ['🂠', '🂡', '🂢', '🂣', '🂤', '🂥', '🂦', '🂧', '🂨', '🂩', '🂪', '🂫', '🂬'],
    // people: ['🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🙇', '🤷'],

    // palace: ['🏰', '🏯', '🗼', '🗽', '⛩️', '🕌', '🕍', '⛪'],
    // weather: ['☀️', '⛅', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '🌪️'],
    // animal: [
    //   '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    //   '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
    // ],

    // dots: ['⣾', '⣷', '⣯', '⣟', '⣻', '⣽', '⣾'],
    // arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
    // box: ['▖', '▘', '▝', '▗'],
    // count: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
  }
  static spinnerChars = this.spinnerThemes.luna

  static async run(activity: string, duration: number, onCompleteMessage: string) {
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(`\r${activity}... ${this.spinnerChars[i++ % this.spinnerChars.length]}`);
    }, 200);
    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);
    process.stdout.write(`\r${onCompleteMessage}\n`);
  }

  static async waitForInputAndRun(waitMessage = 'Press enter to roll...', activity = "Rolling") {
    return new Promise<void>((resolve) => {
      process.stdout.write(`${waitMessage}`);
      process.stdin.resume();
      process.stdin.once('data', () => {
        // clear previous line (user likely pressed enter so we need to move up to clear the prompt)
        readline.moveCursor(process.stdout, 0, -1);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        // const spinner = ['|', '/', '-', '\\'];
        let i = 0;
        const interval = setInterval(() => {
          process.stdout.write(`\r${activity}... ${this.spinnerChars[i++ % this.spinnerChars.length]}`);
        }, 100);
        const wait = 500 + Math.random() * 1420;
        setTimeout(() => {
          clearInterval(interval);
          process.stdout.write('\r');
          resolve();
        }, wait);
      });
    });
  }
}