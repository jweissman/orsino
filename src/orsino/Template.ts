import Deem from "../deem";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import deepCopy from "./util/deepCopy";

export class Template {
  constructor(
    public type: GenerationTemplateType,
    public props: Record<string, any> = {}
  ) { }

  async assembleProperties(
    options: Record<string, any> = {},
    orsino: any
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
      Deem.stdlib.lookup = (tableName: GenerationTemplateType, groupName: string) => orsino.lookupInTable(tableName, groupName);
      Deem.stdlib.gen = async (type: GenerationTemplateType) => {
        return await orsino.gen(type, { ...context })
      };
      Deem.stdlib.genList = async (type: GenerationTemplateType, count: number = 1, condition?: string) => {
        return await orsino.genList(type, { ...context }, count, condition);
      }
      Deem.stdlib.eval = async (expr: string) => await Deem.evaluate(expr, context);

      let resolved = localContext[key] !== undefined ? localContext[key] :
          (await Template.evaluatePropertyExpression(value, context));
      assembled[key] = deepCopy(resolved);

      localContext[key] = assembled[key];

      if (key.startsWith("*")) {
        // we have evaluated the value (confirm we have gotten an object) 
        // then 'overlay' (add) each property onto the context
        Object.entries(assembled[key] || {}).forEach(([k, v]) => {
          // if it's an array, we want to concatenate it
          if (Array.isArray(v)) {
            assembled[k] = (assembled[k] || []).concat(v);
          } else {
            // console.log(`Adding ${k}=${v} to context (was ${localContext[k]})`);
            assembled[k] = v + (assembled[k] || 0);
            // localContext[k] = assembled[k];
          }
          localContext[k] = assembled[k];
        });
      }
    }

    // omit internal properties starting with '_'
    Object.keys(assembled).forEach(key => {
      if (key.startsWith('_') || key.startsWith('*')) {
        delete assembled[key];
      }
    });

    // let assembledWithoutNested = { ...assembled };
    // Object.entries(assembled).forEach(([key, value]) => {
    //   if (typeof value === 'object' && value !== null) {
    //     delete assembledWithoutNested[key];
    //   }
    // });
    // console.log(`Generated ${this.type}:`);
    // console.table(assembledWithoutNested);

    return assembled;
  }

  static async evaluatePropertyExpression(expr: any, context: Record<string, any>): Promise<any> {
    if (!expr || typeof expr !== 'string') {
      return expr;
    }

    if (expr.startsWith("=")) {
      try {
        return await Deem.evaluate(expr.slice(1), context);
      } catch (e) {
        console.error(`Error evaluating expression ${expr}`, e);
        // return null;
        throw e;
      }
    }

    return expr;
  }
}
