import * as ohm from 'ohm-js';
import source from './deem.ohm.txt';
import StandardLibrary, { DeemFunc, DeemValue } from './deem/stdlib';
import { Roll } from './orsino/types/Roll';
import { Combatant } from './orsino/types/Combatant';

type EvalContext = {
  // roll: (
  //   subject: DeemValue,
  //   description: DeemValue,
  //   sides: number
  // ) => Promise<DeemValue>;

  [key: string]: DeemValue; // | ((subject: DeemValue, description: DeemValue, sides: number) => Promise<DeemValue>);
}
type EvalArgs = { context?: EvalContext };
type EvalSemantics = { eval: (context: EvalContext) => Promise<DeemValue> };
type EvalNode = ohm.Node & EvalSemantics;

export default class Deem {
  static magicVars: Record<string, DeemValue> = {};
  static colorize = (str: string, color: string) => `\x1b[${color}m${str}\x1b[0m`;
  static stdlib: { [key: string]: DeemFunc } = StandardLibrary.functions;
  static grammar = ohm.grammar(source);

  static semantics = Deem.grammar.createSemantics().addOperation<Promise<DeemValue>>('eval(context)', {
    async Exp(exp) {
      const ctx = (this.args as EvalArgs).context || {};
      return await (exp as EvalNode).eval(ctx);
    },
    async LogExp_and(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      return (await (left as EvalNode).eval(ctx)) && (await (right as EvalNode).eval(ctx));
    },
    async LogExp_or(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      return (await (left as EvalNode).eval(ctx)) || (await (right as EvalNode).eval(ctx));
    },
    async LogExp_not(_not, exp) {
      const ctx = (this.args as EvalArgs).context || {};
      return !(await (exp as EvalNode).eval(ctx));
    },
    async TernaryExp(cond, _q, trueExp, _c, falseExp) {
      const ctx = (this.args as EvalArgs).context || {};
      const condition = await (cond as EvalNode).eval(ctx);
      // return condition ? (await (trueExp as EvalNode).eval(ctx)) : (await (falseExp as EvalNode).eval(ctx));
      if (condition) {
        return await (trueExp as EvalNode).eval(ctx);
      } else {
        return await (falseExp as EvalNode).eval(ctx);
      }
    },
    async CompExp_lt(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs < rhs;
    },
    async CompExp_gt(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs > rhs;
    },
    async CompExp_eq(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx));
      const rhs = (await (right as EvalNode).eval(ctx));
      return lhs === rhs;
    },
    async CompExp_neq(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = await (left as EvalNode).eval(ctx);
      const rhs = await (right as EvalNode).eval(ctx);
      return lhs !== rhs;
    },
    async CompExp_lte(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs <= rhs;
    },
    async CompExp_gte(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs >= rhs;
    },
    async AddExp_plus(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs + rhs;
    },
    async AddExp_minus(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs - rhs;
    },
    async MulExp_times(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs * rhs;
    },
    async MulExp_divide(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const lhs = (await (left as EvalNode).eval(ctx)) as number;
      const rhs = (await (right as EvalNode).eval(ctx)) as number;
      return lhs / rhs;
    },
    async ExpExp_power(left, _, right) {
      const ctx = (this.args as EvalArgs).context || {};
      const base = await (left as EvalNode).eval(ctx) as number;
      const power = await (right as EvalNode).eval(ctx) as number;
      return Math.pow(base, power);
    },
    async PriExp_paren(_open, exp, _close) {
      const ctx = (this.args as EvalArgs).context || {};
      return await (exp as EvalNode).eval(ctx)
    },
    async PriExp_pos(_plus, exp) {
      const ctx = (this.args as EvalArgs).context || {}; return await (exp as EvalNode).eval(ctx);
    },
    async PriExp_neg(_minus, exp) {
      const ctx = (this.args as EvalArgs).context || {};
      const val = (await (exp as EvalNode).eval(ctx)) as number;
      return -val;
    },
    async FunctionCall(ident, _open, argList, _close) {
      const ctx = (this.args as EvalArgs).context || {};
      const funcName = await (ident as EvalNode).eval(ctx) as string;
      const args = [];
      for (const arg of argList.children) {
        const argValue = await (arg as EvalNode).eval(ctx);
        args.push(argValue);
      }
      const func = Deem.stdlib[funcName];
      if (!func) {
        throw new Error(`Unknown function: ${funcName}`);
      }

      const isFuncAsync = func.constructor.name === 'AsyncFunction';
      let ret = null;
      if (isFuncAsync) {
        ret = await func(...args.flat());
      } else {
        ret = func(...args.flat());
      }
      return ret;
    },
    async ArgList(first, _comma, rest) {
      const ctx = (this.args as EvalArgs).context || {};
      const firstValue = await (first as EvalNode).eval(ctx);
      const restValues = [];
      for (const arg of rest.children) {
        const argValue = await (arg as EvalNode).eval(ctx);
        restValues.push(argValue);
      }
      const args = [firstValue, ...restValues];
      return args;
    },
    async bool(_val) { return Promise.resolve(this.sourceString === 'true'); },
    async number(_num) { return Promise.resolve(parseFloat(this.sourceString)); },
    async nihil(_val) { return Promise.resolve(null); },
    async ident(_initial, _rest) {
      const name = this.sourceString;
      const ctx = (this.args as EvalArgs).context || {}
      if (name.startsWith('#')) {
        const key = name.slice(1);
        const value = (this.args as EvalArgs).context?.[key] ?? Deem.magicVars[key];
        if (value === undefined) {
          if (Object.keys(ctx).includes(key)) {
            return null;
          }
          throw new Error(`Undefined variable: ${key} (available: ${Object.keys(ctx).join(', ')}); (magic: ${Object.keys(Deem.magicVars).join(', ')})`);
        }
        return value;
      }
      return Promise.resolve(this.sourceString);
    },
    async strlit_single_quote(_open, chars, _close) {
      return Promise.resolve(chars.sourceString);
    },
    async strlit_double_quote(_open, chars, _close) {
      // return chars.sourceString;
      const raw = chars.sourceString;
      const ctx = (this.args as EvalArgs).context || {};
      // interpolate #{expressions}
      let result = '';
      let cursor = 0;
      const regex = /#\{(.*?)\}/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        const before = raw.slice(cursor, match.index);
        result += before;
        const expr = match[1];
        const exprValue = await Deem.evaluate(expr, ctx) as string;
        result += exprValue;
        cursor = match.index + match[0].length;
      }
      result += raw.slice(cursor);
      // interpolate #variables
      result = result.replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, varName) => {
        const variable = String(varName);
        const value = ctx[variable] ?? Deem.magicVars[variable];
        if (value === undefined) {
          throw new Error(`Undefined variable in string interpolation: ${varName} (available: ${Object.keys((this.args as EvalArgs).context || {}).join(', ')}); (magic: ${Object.keys(Deem.magicVars).join(', ')})`);
        }
        return value as string;
      });
      return result;
    },
    async dice_multi(count, _d, sides) {
      const ctx = (this.args as EvalArgs).context || {};
      const rollFunc = ctx.roll as unknown as Roll;
      if (ctx.roll !== undefined && ctx.roll !== null && typeof ctx.roll === 'function') {
        let sum = 0;
        for (let i = 0; i < parseInt(count.sourceString); i++) {
          const result = await rollFunc(
            ctx.subject as unknown as Combatant,
            ctx.description as string,
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
      const ctx = (this.args as EvalArgs).context || {};
      if (ctx.roll) {
        const rollFunc = ctx.roll as unknown as Roll;
        const result = await rollFunc(
          ctx.subject as unknown as Combatant,
          ctx.description as string,
          parseInt(sides.sourceString)
        );
        return result.amount;
      }
      return Math.floor(Math.random() * parseInt(sides.sourceString)) + 1;
    }
  }).addAttribute<string>('pretty', {
    Exp(exp) { return exp.pretty as string; },
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
      const funcName = ident.pretty as string;
      const args = argList.children.map(arg => arg.pretty as string).flat();
      return `${funcName}(${args.join(', ')})`;
    },
    ArgList(first, _comma, rest) {
      return [first.pretty as string, ...rest.children.map(arg => arg.pretty as string)].join(', ');
    },
    bool(_val) { return this.sourceString; },
    number(_num) { return this.sourceString; },
    nihil(_val) { return 'nihil'; },
    ident(_initial, _rest) {
      const name = this.sourceString;

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
    context: Record<string, DeemValue> = {}
  ): Promise<DeemValue> {

    // if we have a leading =, then we can remove it
    if (expression.startsWith('=')) {
      expression = expression.slice(1);
    }

    const match = this.grammar.match(expression);
    if (match.succeeded()) {
      const sem = this.semantics(match) as {
        eval: (context: Record<string, DeemValue>) => Promise<DeemValue>
      };
      // const prettyExpr: string = sem.pretty as string;
      const ret: DeemValue = await sem.eval(context);
      return ret;
    } else {
      throw new Error('Failed to parse expression: ' + expression + '\n' + match.message);
    }
  }
}