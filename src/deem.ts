import * as ohm from 'ohm-js';
import source from './deem.ohm.txt';

export default class Deem {
  static colors = {
    black: '30',
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    white: '37',
  };
  static colorize = (str: string, color: string) => `\x1b[${color}m${str}\x1b[0m`;
  static stdlib: { [key: string]: (...args: any[]) => any } = {
    rand: () => Math.random(),
    if: (cond: any, trueVal: any, falseVal: any) => (cond ? trueVal : falseVal),
    oneOf: (...args: any[]) => args[Math.floor(Math.random() * args.length)],
  };
  static grammar = ohm.grammar(source);
  static semantics = Deem.grammar.createSemantics().addOperation('eval(context)', {
    Exp(exp) { return exp.eval(this.args.context); },
    CompExp_lt(left, _, right) { return left.eval(this.args.context) < right.eval(this.args.context); },
    CompExp_gt(left, _, right) { return left.eval(this.args.context) > right.eval(this.args.context); },
    AddExp_plus(left, _, right) { return left.eval(this.args.context) + right.eval(this.args.context); },
    MulExp_times(left, _, right) { return left.eval(this.args.context) * right.eval(this.args.context); },
    PriExp_paren(_open, exp, _close) { return exp.eval(this.args.context); },
    PriExp_pos(_plus, exp) { return exp.eval(this.args.context); },
    PriExp_neg(_minus, exp) { return -exp.eval(this.args.context); },
    FunctionCall(ident, _open, argList, _close) {
      const funcName = ident.eval(this.args.context);
      const args = argList.children.map(arg => arg.eval(this.args.context)).flat();
      const func = Deem.stdlib[funcName];
      if (!func) {
        throw new Error(`Unknown function: ${funcName}`);
      }
      const ret = func(...args);
      // console.log(`Called function: ${funcName}(${args.join(', ')}) => ${ret}`);
      return ret;
    },
    ArgList(first, _comma, rest) {
      return [first.eval(this.args.context), ...rest.children.map(arg => arg.eval(this.args.context))];
    },
    bool(_val) { return this.sourceString === 'true'; },
    number(_num) { return parseFloat(this.sourceString); },
    nihil(_val) { return null; },
    ident(_initial, _rest) {
      let name = this.sourceString;
      if (name.startsWith('#')) {
        const key = name.slice(1);
        const value = this.args.context?.[key];
        if (value === undefined) {
          throw new Error(`Undefined variable: ${key}`);
        }
        return value;
      }
      return this.sourceString;
    },
    strlit(_open, chars, _close) {
      return chars.sourceString;
    },
    dice_multi(count, _d, sides) {
      const rolls = Array.from({ length: parseInt(count.sourceString) }, () => Math.floor(Math.random() * parseInt(sides.sourceString)) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0);
      return sum;
    },
    dice_single(_d, sides) {
      return Math.floor(Math.random() * parseInt(sides.sourceString)) + 1;
    }
  }).addAttribute('pretty', {
    Exp(exp) { return exp.pretty; },
    CompExp_lt(left, _, right) { return `${left.pretty} < ${right.pretty}`; },
    CompExp_gt(left, _, right) { return `${left.pretty} > ${right.pretty}`; },
    AddExp_plus(left, _, right) { return `${left.pretty} + ${right.pretty}`; },
    MulExp_times(left, _, right) { return `${left.pretty} * ${right.pretty}`; },
    PriExp_paren(_open, exp, _close) { return `(${exp.pretty})`; },
    PriExp_pos(_plus, exp) { return `+${exp.pretty}`; },
    PriExp_neg(_minus, exp) { return `-${exp.pretty}`; },
    FunctionCall(ident, _open, argList, _close) {
      const funcName = ident.pretty;
      const args = argList.children.map(arg => arg.pretty).flat();
      return `${funcName}(${args.join(', ')})`;
    },
    ArgList(first, _comma, rest) {
      return [first.pretty, ...rest.children.map(arg => arg.pretty)];
    },
    bool(_val) { return this.sourceString; },
    number(num) { return this.sourceString; },
    nihil(_val) { return 'nihil'; },
    ident(_initial, _rest) {
      let name = this.sourceString;

      return name;
    },
    strlit(_open, chars, _close) {
      return `"${chars.sourceString}"`;
    },
    dice_multi(count, _d, sides) { return `${count.sourceString}d${sides.sourceString}`; },
    dice_single(_d, sides) { return `d${sides.sourceString}`; }
  });

  static evaluate(
    expression: string,
    context: Record<string, any> = {}
  ): any {
    const match = this.grammar.match(expression);
    if (match.succeeded()) {
      const sem = this.semantics(match);
      const prettyExpr = sem.pretty;
      // You _wish_ this worked => sem.context = context;
      const ret = sem.eval(context);
      // console.debug(
      //   `${this.colorize(prettyExpr, this.colors.black)} =>`,
      //   this.colorize(ret, this.colors.yellow),
      //   context && Object.keys(context).length > 0 ? this.colorize(`(context: ${JSON.stringify(context)})`, this.colors.cyan) : ''
      // );
      return ret;
    } else {
      throw new Error('Failed to parse expression: ' + expression + '\n' + match.message);
    }
  }
}