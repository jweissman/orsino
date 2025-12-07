import * as ohm from 'ohm-js';
import source from './deem.ohm.txt';
import { count } from 'console';
import { Fighting } from './orsino/rules/Fighting';

export default class Deem {
  static magicVars: Record<string, any> = {};
  // static colors = { black: '30', red: '31', green: '32', yellow: '33', blue: '34', magenta: '35', cyan: '36', white: '37', };
  static colorize = (str: string, color: string) => `\x1b[${color}m${str}\x1b[0m`;
  static stdlib: { [key: string]: (...args: any[]) => any } = {
    count: (arr: any[]) => arr.length,
    rand: () => Math.random(),
    if: (cond: any, trueVal: any, falseVal: any) => (cond ? trueVal : falseVal),
    oneOf: (...args: any[]) => args[Math.floor(Math.random() * args.length)],
    pick: (arr: any[], index = -1) => {
      if (!Array.isArray(arr)) {
        throw new Error(`pick() expects an array, got: ${typeof arr}`);
        // console.warn("pick() expects an array, got:", arr);
        // return arr;
      }
      // console.log("PICKING FROM ARRAY:", arr);
      if (index === -1) {
        return arr[Math.floor(Math.random() * arr.length)]
      } else {
        return arr[index % arr.length];
      }
    },
    sample: (arr: any[], count: number) => {
      const sampled: any[] = [];
      const arrCopy = [...arr];
      for (let i = 0; i < count && arrCopy.length > 0; i++) {
        const index = Math.floor(Math.random() * arrCopy.length);
        sampled.push(arrCopy.splice(index, 1)[0]);
      }
      return sampled;
    },
    round: (num: number) => Math.round(num),
    floor: (num: number) => Math.floor(num),
    ceil: (num: number) => Math.ceil(num),
    capitalize: (str: string) => str && str.charAt(0).toUpperCase() + str.slice(1),
    len: (obj: any) => {
      if (Array.isArray(obj) || typeof obj === 'string') {
        return obj.length;
      } else if (obj && typeof obj === 'object') {
        return Object.keys(obj).length;
      }
      return 0;
    },
    sum: (arr: any[], prop?: string) => {
      if (prop) {
        return arr.reduce((acc, item) => acc + (item[prop] || 0), 0);
      }
      return arr.reduce((acc, val) => acc + val, 0);
    },
    min: (...args: number[]) => Math.min(...args),
    max: (...args: number[]) => Math.max(...args),
    concat: (...args: any[]) => args.flat().filter((x) => x !== null && x !== undefined),
    roll: (count: number, sides: number) => {
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0);
      return sum;
    },
    rollWithDrop: (count: number, sides: number) => {
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
      rolls.sort((a, b) => a - b);
      rolls.shift(); // drop the lowest
      return rolls.reduce((a, b) => a + b, 0);
    },
    statMod: (stat: number) => {
      return Fighting.statMod(stat);
    },
    dig: (obj: any, ...path: string[]) => {
      return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : null, obj);
    },
    uniq: (arr: any[]) => Array.from(new Set(arr)),
    distribute: (total: number, parts: number) => {
      const base = Math.floor(total / parts);
      const remainder = total % parts;
      const distribution = Array(parts).fill(base);
      for (let i = 0; i < remainder; i++) {
        distribution[i]++;
      }
      return distribution.filter(x => x > 0);
    },
  };
  static grammar = ohm.grammar(source);
  static semantics = Deem.grammar.createSemantics().addOperation('eval(context)', {
    async Exp(exp) { return await exp.eval(this.args.context); },
    async LogExp_and(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) && (await right.eval(ctx)); },
    async LogExp_or(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) || (await right.eval(ctx)); },
    async LogExp_not(_not, exp) { let ctx = this.args.context;  return !(await exp.eval(ctx)); },
    async TernaryExp(cond, _q, trueExp, _c, falseExp) { let ctx = this.args.context;  return (await cond.eval(ctx)) ? (await trueExp.eval(ctx)) : (await falseExp.eval(ctx)); },
    async CompExp_lt(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) < (await right.eval(ctx)); },
    async CompExp_gt(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) > (await right.eval(ctx)); },
    async CompExp_eq(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) == (await right.eval(ctx)); },
    async CompExp_neq(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) != (await right.eval(ctx)); },
    async CompExp_lte(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) <= (await right.eval(ctx)); },
    async CompExp_gte(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) >= (await right.eval(ctx)); },
    async AddExp_plus(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) + (await right.eval(ctx)); },
    async AddExp_minus(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) - (await right.eval(ctx)); },
    async MulExp_times(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) * (await right.eval(ctx)); },
    async MulExp_divide(left, _, right) { let ctx = this.args.context;  return (await left.eval(ctx)) / (await right.eval(ctx)); },
    async ExpExp_power(left, _, right) { let ctx = this.args.context;  return Math.pow(await left.eval(ctx), await right.eval(ctx)); },
    async PriExp_paren(_open, exp, _close) { let ctx = this.args.context;  return await exp.eval(ctx); },
    async PriExp_pos(_plus, exp) { let ctx = this.args.context;  return await exp.eval(ctx); },
    async PriExp_neg(_minus, exp) { let ctx = this.args.context;  return -(await exp.eval(ctx)); },
    async FunctionCall(ident, _open, argList, _close) {
      let ctx = this.args.context || {};
      const funcName = await ident.eval(ctx);
      const args = [];
      for (const arg of argList.children) {
        const argValue = await arg.eval(ctx);
        args.push(argValue);
      }
      const func = Deem.stdlib[funcName];
      if (!func) {
        throw new Error(`Unknown function: ${funcName}`);
      }

      let isFuncAsync = func.constructor.name === 'AsyncFunction';
      let ret = null;
      if (isFuncAsync) {
        ret = await func(...args.flat());
      } else {
        ret = func(...args.flat());
      }
      return ret;
    },
    async ArgList(first, _comma, rest) {
      let ctx = this.args.context;
      const firstValue = await first.eval(ctx);
      const restValues = [];
      for (const arg of rest.children) {
        const argValue = await arg.eval(ctx);
        restValues.push(argValue);
      }
      const args = [firstValue, ...restValues];
      return args;
    },
    async bool(_val) { return this.sourceString === 'true'; },
    async number(_num) { return parseFloat(this.sourceString); },
    async nihil(_val) { return null; },
    async ident(_initial, _rest) {
      let name = this.sourceString;
      if (name.startsWith('#')) {
        const key = name.slice(1);
        const value = this.args.context?.[key] ?? Deem.magicVars[key];
        if (value === undefined) {
          if (Object.keys(this.args.context).includes(key)) {
            return null;
          }
          throw new Error(`Undefined variable: ${key} (available: ${Object.keys(this.args.context || {}).join(', ')}); (magic: ${Object.keys(Deem.magicVars).join(', ')})`);
        }
        return value;
      }
      return this.sourceString;
    },
    async strlit_single_quote(_open, chars, _close) {
      return chars.sourceString;
    },
    async strlit_double_quote(_open, chars, _close) {
      // return chars.sourceString;
      let raw = chars.sourceString;
      let ctx = this.args.context;
      // interpolate #{expressions}
      let result = '';
      let cursor = 0;
      const regex = /#\{(.*?)\}/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        const before = raw.slice(cursor, match.index);
        result += before;
        const expr = match[1];
        const exprValue = await Deem.evaluate(expr, ctx);
        result += exprValue;
        cursor = match.index + match[0].length;
      }
      result += raw.slice(cursor);
      // interpolate #variables
      result = result.replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, varName) => {
        const value = ctx?.[varName] ?? Deem.magicVars[varName];
        if (value === undefined) {
          throw new Error(`Undefined variable in string interpolation: ${varName}`);
        }
        return value;
      });
      return result;
    },
    async dice_multi(count, _d, sides) {
      // if (isNaN(parseInt(count.sourceString)) || isNaN(parseInt(sides.sourceString))) {
      //   throw new Error(`Invalid dice expression: ${count.sourceString}d${sides.sourceString}`);
      // }
      let ctx = this.args.context;
      if (ctx.roll !== undefined) {
        let sum = 0;
        for (let i = 0; i < parseInt(count.sourceString); i++) {
          const result = await ctx.roll(
            ctx.subject,
            ctx.description,
            parseInt(sides.sourceString)
          );
          sum += result.amount;
        }
        return sum;
      }

      const rolls = Array.from({ length: parseInt(count.sourceString) }, () => Math.floor(Math.random() * parseInt(sides.sourceString)) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0);
      return sum;
    },
    async dice_single(_d, sides) {
      if (this.args.context.roll) {
        const rollFunc = this.args.context.roll;
        const result = await rollFunc(
          this.args.context.subject,
          this.args.context.description,
          parseInt(sides.sourceString)
        );
        return result.amount;
      }
      return Math.floor(Math.random() * parseInt(sides.sourceString)) + 1;
    }
  }).addAttribute('pretty', {
    Exp(exp) { return exp.pretty; },
    LogExp_and(left, _, right) { return `${left.pretty} && ${right.pretty}`; },
    LogExp_or(left, _, right) { return `${left.pretty} || ${right.pretty}`; },
    LogExp_not(_not, exp) { return `!${exp.pretty}`; },
    TernaryExp(cond, _q, trueExp, _c, falseExp) { return `${cond.pretty} ? ${trueExp.pretty} : ${falseExp.pretty}`; },
    CompExp_lt(left, _, right) { return `${left.pretty} < ${right.pretty}`; },
    CompExp_gt(left, _, right) { return `${left.pretty} > ${right.pretty}`; },
    CompExp_lte(left, _, right) { return `${left.pretty} <= ${right.pretty}`; },
    CompExp_gte(left, _, right) { return `${left.pretty} >= ${right.pretty}`; },
    CompExp_eq(left, _, right) { return `${left.pretty} == ${right.pretty}`; },
    CompExp_neq(left, _, right) { return `${left.pretty} != ${right.pretty}`; },
    AddExp_plus(left, _, right) { return `${left.pretty} + ${right.pretty}`; },
    AddExp_minus(left, _, right) { return `${left.pretty} - ${right.pretty}`; },
    MulExp_times(left, _, right) { return `${left.pretty} * ${right.pretty}`; },
    MulExp_divide(left, _, right) { return `${left.pretty} / ${right.pretty}`; },
    ExpExp_power(left, _, right) { return `${left.pretty} ^ ${right.pretty}`; },
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
    strlit_double_quote(_open, chars, _close) {
      return `"${chars.sourceString}"`;
    },
    strlit_single_quote(_open, chars, _close) {
      return `'${chars.sourceString}'`;
    },
    dice_multi(count, _d, sides) { return `${count.sourceString}d${sides.sourceString}`; },
    dice_single(_d, sides) { return `d${sides.sourceString}`; }
  });

  static async evaluate(
    expression: string,
    context: Record<string, any> = {}
  ): Promise<any> {

    // if we have a leading =, then we can remove it
    if (expression.startsWith('=')) {
      expression = expression.slice(1);
    }

    const match = this.grammar.match(expression);
    if (match.succeeded()) {
      const sem = this.semantics(match);
      // const prettyExpr = sem.pretty;
      // You _wish_ this worked => sem.context = context;
      const ret = await sem.eval(context);
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