type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
export default class Stylist {
  static cleanLength(text: string) {
    // removes ANSI codes and returns the length of the clean string
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    return text.replace(ansiRegex, '').length;
  }
  static format = (text: string, style: 'bold' | 'italic' | 'underline') => {
    const styles: Record<string, string> = {
      bold: '\x1b[1m',
      italic: '\x1b[3m',
      underline: '\x1b[4m',
    };
    const reset = '\x1b[0m';
    return `${styles[style] || ''}${text}${reset}`;
  }

  static bold = (text: string) => Stylist.format(text, 'bold');
  static italic = (text: string) => Stylist.format(text, 'italic');
  static underline = (text: string) => Stylist.format(text, 'underline');

  static colorize = (text: string, color: Color) => {
    const colors: Record<Color, string> = {
      black: '30',
      red: '31',
      green: '32',
      yellow: '33',
      blue: '34',
      magenta: '35',
      cyan: '36',
      white: '37',
      gray: '90',
    };
    const colorCode = colors[color] || colors.white;
    return `\x1b[${colorCode}m${text}\x1b[0m`;
  }

  static prettyValue = (value: number, maxValue: number): string => {
    const counter = [
      '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', 
    ];
    const ratio = value / maxValue;

    return counter[Math.floor(ratio * (counter.length - 1))] || counter[0];
  }
}