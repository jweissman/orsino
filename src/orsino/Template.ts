// src/orsino/Template.ts
import Deem from "../deem";
import { DeemFunc, DeemValue } from "../deem/stdlib";
import Generator, { GeneratorOptions } from "./Generator";
import { StatusModifications } from "./Status";
import { Table } from "./Table";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import deepCopy from "./util/deepCopy";

export type TemplateProps = Record<string, string | number | boolean | object>;
export class Template {
  constructor(
    public type: GenerationTemplateType,
    public props: TemplateProps = {}
  ) { }

  static bootstrapDeem(context: Record<string, DeemValue> = {}) {
    Deem.stdlib = Deem.stdlib || {};
    Deem.stdlib.eval = (expr: DeemValue) => Deem.evaluate(expr as string, context);
    Deem.stdlib.defined = (varName: DeemValue) => {
      if (typeof varName !== 'string') {
        throw new Error(`defined() expects a string, got: ${typeof varName}`);
      }
      return context[varName] !== undefined;
    }
    Deem.stdlib.lookup = ((tableName: GenerationTemplateType, groupName: string) => {
      return Generator.lookupInTable(tableName, groupName);
    }) as DeemFunc;
    Deem.stdlib.lookupUnique = ((tableName: GenerationTemplateType, groupName: string) => Generator.lookupInTable(tableName, groupName, true)) as DeemFunc;

    Deem.stdlib.gatherEntries = ((tableName: GenerationTemplateType, groupName: string, count: number = -1) => {
      // console.log(`Gathering entries for table '${tableName}' and group '${groupName}'`);
      const table = Generator.generationSource(tableName);
      if (!table || !(table instanceof Table)) {
        throw new Error(`Table not found: ${tableName}`);
        return [];
      }
      return table.gatherEntries(groupName, count);
    }) as DeemFunc;

    Deem.stdlib.hasEntry = ((tableName: GenerationTemplateType, groupName: string) => {
      // console.log(`Checking hasEntry for table '${tableName}' and group '${groupName}'`);
      const table = Generator.generationSource(tableName);
      if (!table || !(table instanceof Table)) {
        throw new Error(`Table not found: ${tableName}`);
        return false;
      }
      return table.hasGroup(groupName);
    }) as DeemFunc;
    Deem.stdlib.hasValue = ((tableName: GenerationTemplateType, value: DeemValue) => {
      // console.log(`Checking hasValue for table '${tableName}' and group '${groupName}' for value:`, value);
      const table = Generator.generationSource(tableName);
      if (!table || !(table instanceof Table)) {
        throw new Error(`Table not found: ${tableName}`);
        return false;
      }
      return table.containsValue(value);
    }) as DeemFunc;
    Deem.stdlib.findGroup = ((tableName: GenerationTemplateType, value: DeemValue) => {
      // console.log(`Finding group for value in table '${tableName}':`, value);
      const table = Generator.generationSource(tableName);
      if (!table || !(table instanceof Table)) {
        throw new Error(`Table not found: ${tableName}`);
        return null;
      }
      return table.findGroupForValue(value);
    }) as DeemFunc;

    Deem.stdlib.gather = ((
      tableName: GenerationTemplateType, count: number = -1, condition?: string
    ) => Generator.gatherKeysFromTable(tableName, count, condition)) as DeemFunc;

    Deem.stdlib.gen = ((type: GenerationTemplateType) => {
      return Generator.gen(type, { ...context })
    }) as DeemFunc;
    Deem.stdlib.genList = ((type: GenerationTemplateType, count: number = 1) => {
      return Generator.genList(type, { ...context }, count);
    }) as DeemFunc;
    Deem.stdlib.genListIsolated = ((type: GenerationTemplateType, count: number = 1) => {
      return Generator.genList(type, {}, count);
    }) as DeemFunc;

    Deem.stdlib.mapGenList = ((type: GenerationTemplateType, items: any[], property: string) => {
      // console.log(`mapGenList for type '${type}' over items:`, items);
      const results = [];
      // for (let item of items) {
      //   let index = items.indexOf(item);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const index = i;
        const genOptions: GeneratorOptions = { ...context, [property]: item, _index: index };
        const genResult = Generator.gen(type, genOptions);
        results.push(genResult);
      }
      // process.stdout.write(`.`);
      return results;
    }) as DeemFunc;

    Deem.stdlib.fxHeal = ((amount: number | string) => ({ type: 'heal', amount })) as DeemFunc;
    Deem.stdlib.fxDamage = ((amount: number | string, damageType?: string) => ({ type: 'damage', amount, kind: damageType })) as DeemFunc;
    Deem.stdlib.fxBuff = ((name: string, effect: StatusModifications, duration: number | string = 10) => ({ type: 'buff', status: { effect, name }, duration })) as unknown as DeemFunc;
  }

  assembleProperties(
    options: Record<string, DeemValue> = {},
    // _generator: any
  ): Record<string, any> {
    const localContext = { ...options };
    const assembled: Record<string, DeemValue> = {};

    // Object.entries(this.props).forEach(([key, value]) => {
    for (const [key, value] of Object.entries(this.props)) {
      // console.log(`Assembling property: ${key} with value:`, value);
      const context: Record<string, any> = {
        ...localContext,
        ...assembled
      };
      Template.bootstrapDeem(context);
      const resolved: DeemValue = localContext[key] !== undefined ? localContext[key] :
        (Template.evaluatePropertyExpression(value, context) as unknown as DeemValue);

      // it felt like we needed deep copy here to prevent any mutations from affecting the original template
      assembled[key] = deepCopy(resolved) as DeemValue;

      localContext[key] = assembled[key];

      if (key.startsWith("!")) {
        // handle special commands (just !remove for now)
        if (key === "!remove" && Array.isArray(assembled[key])) {
          for (const propToRemove of assembled[key] as DeemValue[]) {
            delete assembled[propToRemove as string];
            delete localContext[propToRemove as string];
          }
        }
        continue;
      }

      if (key.startsWith("*") || key.startsWith("^")) {
        // we have evaluated the value (confirm we have gotten an object) 
        // then 'overlay' (add) each property onto the context
        // Object.entries(assembled[key] || {}).forEach(([k, v]) => {
        for (let [k, v] of Object.entries(assembled[key] || {})) {

          // if it's an array, we want to concatenate it
          if (Array.isArray(v)) {
            if (v.some((el: any) => typeof el === 'string' && el.startsWith("="))) {
              // throw new Error(`Cannot overlay unevaluated expression in array for property ${k}: ${v}`);
              // v = v.map(async (el: any) => {
              for (let i = 0; i < v.length; i++) {
                let el = v[i];
                if (typeof el === 'string' && el.startsWith("=")) {
                  el = Template.evaluatePropertyExpression(el, context);
                }
                v[i] = el;
              }
              // console.log("Evaluated overlaid array for property", k, ":", v);
            }

            assembled[k] = (assembled[k] as Array<any> || []).concat(v);
          } else if (typeof v === 'number') {
            assembled[k] = (assembled[k] as number || 0) + v;
          } else if (typeof v === 'string') {
            if (key.startsWith("^")) {
              // console.log(`Evaluating overlaid property ${k} with expression: ${v}`);
              // deem evaluate the string before overlaying
              v = Template.evaluatePropertyExpression(v, { ...context, ...assembled });
            }
            // console.log(`Adding ${k}=${v} to context (was ${localContext[k]})`);
            // just replace!
            assembled[k] = v; // + (assembled[k] || '');
            // localContext[k] = assembled[k];
          } else if (typeof v === 'boolean') {
            assembled[k] = v || assembled[k];
          } else if (typeof v === 'object' && v !== null) {
            // assume obj?
            assembled[k] = { ...v, ...(assembled[k] as {} || {}) };
          } else {
            // assembled[k] = v + (assembled[k] || null);
            throw new Error(`Cannot overlay property ${k} with value of type ${typeof v}`);
          }
          localContext[k] = assembled[k];
        }
      }

      // console.log(`Assembled property: ${key} =`, assembled[key]);
    }

    // omit internal/overlay properties starting with '_' or '*'
    Object.keys(assembled).forEach(key => {
      if (key.startsWith('_') || key.startsWith('*') || key.startsWith('^') || key.startsWith('!')) {
        delete assembled[key];
      }
    });

    let provideIdentifier = true;
    if (this.props['__no_id'] === true || options['__no_id'] === true) {
      provideIdentifier = false;
    }

    if (!assembled.id && provideIdentifier) {
      assembled.id = `${this.type}:${Math.random().toString(36).substring(2, 8)}`;
    }

    return {
      // id: `${this.type}:${Math.random().toString(36).substring(2, 8)}`,
      ...assembled
    };
  }

  static evaluatePropertyExpression(expr: any, context: Record<string, any>): DeemValue {
    if (!expr || typeof expr !== 'string') {
      return expr as DeemValue;
    }

    if (expr.startsWith("=")) {
      try {
        return Deem.evaluate(expr, context);
      } catch (e) {
        console.error(`Error evaluating expression ${expr}`, e);

        // return null;
        throw e;
      }
    }

    return expr;
  }
}
