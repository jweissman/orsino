import Deem from "../deem";
import deepCopy from "./deepCopy";
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
        // console.log("Sub-genning", type, "with parent options:", options);
        return orsino.gen(type, { ...context })
      };
      Deem.stdlib.genList = (type: GenerationTemplateType, count: number = 1, condition?: string) => {
        // console.log("Sub-genning list of", type, "with parent options:", options);
        return orsino.genList(type, { ...context }, count, condition);
      }

      assembled[key] =
        localContext[key] !== undefined ? localContext[key] :
          Template.evaluatePropertyExpression(value, context);


      localContext[key] = assembled[key];
    });

    // omit internal properties starting with '_'
    Object.keys(assembled).forEach(key => {
      if (key.startsWith('_')) {
        delete assembled[key];
      }
    });

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
