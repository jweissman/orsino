import Deem from "../deem";
import { GenerationTemplateType } from "./types/GenerationTemplateType";

export class Template {
  constructor(
    public type: GenerationTemplateType,
    public props: Record<string, any> = {}
  ) { }

  assembleProperties(
    options: Record<string, any> = {},
    orsino: any
  ): Record<string, any> {
    const localContext = { ...options };
    let assembled: Record<string, any> = {};

    Object.entries(this.props).forEach(([key, value]) => {
      const context: Record<string, any> = {
        ...localContext,
        ...assembled
      };
      Deem.stdlib.lookup = (tableName: GenerationTemplateType, groupName: string) => orsino.lookupInTable(tableName, groupName);
      Deem.stdlib.gen = (type: GenerationTemplateType) => {
        return orsino.gen(type, { ...context })
      };
      Deem.stdlib.genList = (type: GenerationTemplateType, count: number = 1, condition?: string) => {
        return orsino.genList(type, { ...context }, count, condition);
      }

      assembled[key] =
        localContext[key] !== undefined ? localContext[key] :
          Template.evaluatePropertyExpression(value, context);

      localContext[key] = assembled[key];

      if (key.startsWith("*")) {
        // we have evaluated the value (confirm we have gotten an object) 
        // if (typeof assembled[key] === 'object' && assembled[key] !== null) {
        //   console.log(`Overlay properties from ${key} into context (${Object.keys(assembled[key]).join(', ')})`);
        // }
        // then 'overlay' (add) each property onto the context
        Object.entries(assembled[key] || {}).forEach(([k, v]) => {
          // console.log(`Adding ${k}=${v} to context (was ${localContext[k]})`);
          assembled[k] = v + (assembled[k] || 0);
          localContext[k] = assembled[k];
        });
      }
    });

    // omit internal properties starting with '_'
    Object.keys(assembled).forEach(key => {
      if (key.startsWith('_')) {
        delete assembled[key];
      }
    });

    let assembledWithoutNested = { ...assembled };
    Object.entries(assembled).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // assembledWithoutNested[key] = undefined;
        delete assembledWithoutNested[key];
      }
    });
    // console.log(`Generated ${this.type}:`);
    // console.table(assembledWithoutNested);

    return assembled;
  }

  static evaluatePropertyExpression(expr: any, context: Record<string, any>): any {
    if (!expr || typeof expr !== 'string') {
      return expr;
    }

    if (expr.startsWith("=")) {
      try {
        return Deem.evaluate(expr.slice(1), context);
      } catch (e) {
        console.error(`Error evaluating expression ${expr}`, e);
        return null;
      }
    }

    return expr;
  }
}
