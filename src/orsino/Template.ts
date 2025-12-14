// src/orsino/Template.ts
import Deem from "../deem";
import Generator from "./Generator";
import { Table } from "./Table";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import deepCopy from "./util/deepCopy";

export class Template {
  constructor(
    public type: GenerationTemplateType,
    public props: Record<string, any> = {}
  ) { }

  static async bootstrapDeem(context: Record<string, any> = {}) {
    Deem.stdlib = Deem.stdlib || {};
    Deem.stdlib.eval = async (expr: string) => await Deem.evaluate(expr, context);
    Deem.stdlib.lookup = (tableName: GenerationTemplateType, groupName: string) => Generator.lookupInTable(tableName, groupName);
    Deem.stdlib.lookupUnique = (tableName: GenerationTemplateType, groupName: string) => Generator.lookupInTable(tableName, groupName, true);
    Deem.stdlib.hasEntry = (tableName: GenerationTemplateType, groupName: string) => {
      // console.log(`Checking hasEntry for table '${tableName}' and group '${groupName}'`);
      const table = Generator.generationSource(tableName);
      if (!table || !(table instanceof Table)) {
        throw new Error(`Table not found: ${tableName}`);
        return false;
      }
      return table.hasGroup(groupName);
    };
    Deem.stdlib.gather = async (
      tableName: GenerationTemplateType, count: number = -1, condition?: string
    ) => await Generator.gatherKeysFromTable(tableName, count, condition);
    Deem.stdlib.gen = async (type: GenerationTemplateType) => {
      return await Generator.gen(type, { ...context })
    };
    Deem.stdlib.genList = async (type: GenerationTemplateType, count: number = 1, condition?: string) => {
      return await Generator.genList(type, { ...context }, count, condition);
    }

    Deem.stdlib.mapGenList = async (type: GenerationTemplateType, items: any[], property: string) => {
      // console.log(`mapGenList for type '${type}' over items:`, items);
      let results = [];
      // for (let item of items) {
      //   let index = items.indexOf(item);
      for (let i = 0; i < items.length; i++) {
        let item = items[i];
        let index = i;
        let genOptions = { ...context, [property]: item, _index: index };
        let genResult = await Generator.gen(type, genOptions);
        results.push(genResult);
      }
      // process.stdout.write(`.`);
      return results;
    }
  }

  async assembleProperties(
    options: Record<string, any> = {},
    // _generator: any
  ): Promise<Record<string, any>> {
    const localContext = { ...options };
    let assembled: Record<string, any> = {};

    // Object.entries(this.props).forEach(([key, value]) => {
    for (const [key, value] of Object.entries(this.props)) {
      // console.log(`Assembling property: ${key} with value:`, value);
      const context: Record<string, any> = {
        ...localContext,
        ...assembled
      };
      await Template.bootstrapDeem(context);
      let resolved = localContext[key] !== undefined ? localContext[key] :
        (await Template.evaluatePropertyExpression(value, context));

      // it felt like we needed deep copy here to prevent any mutations from affecting the original template
      assembled[key] = deepCopy(resolved);

      localContext[key] = assembled[key];

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
                  el = await Template.evaluatePropertyExpression(el, context);
                }
                v[i] = el;
              }
              // console.log("Evaluated overlaid array for property", k, ":", v);
            }

            assembled[k] = (assembled[k] || []).concat(v);
          } else if (v instanceof Number || typeof v === 'number') {
            assembled[k] = (assembled[k] || 0) + v;
          } else if (typeof v === 'string') {
            if (key.startsWith("^")) {
              // console.log(`Evaluating overlaid property ${k} with expression: ${v}`);
              // deem evaluate the string before overlaying
              v = await Template.evaluatePropertyExpression(v, { ...context, ...assembled });
            }
            // console.log(`Adding ${k}=${v} to context (was ${localContext[k]})`);
            // just replace!
            assembled[k] = v; // + (assembled[k] || '');
            // localContext[k] = assembled[k];
          } else if (typeof v === 'boolean') {
            assembled[k] = v || assembled[k];
          } else if (typeof v === 'object' && v !== null) {
            // assume obj?
            assembled[k] = { ...v, ...(assembled[k] || {}) };
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
      if (key.startsWith('_') || key.startsWith('*') || key.startsWith('^')) {
        delete assembled[key];
      }
    });

    return assembled;
  }

  static async evaluatePropertyExpression(expr: any, context: Record<string, any>): Promise<any> {
    if (!expr || typeof expr !== 'string') {
      return expr;
    }

    if (expr.startsWith("=")) {
      try {
        return await Deem.evaluate(expr, context);
      } catch (e) {
        console.error(`Error evaluating expression ${expr}`, e);

        // return null;
        throw e;
      }
    }

    return expr;
  }
}
