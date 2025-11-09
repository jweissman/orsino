import Deem from "../deem";
import { GenerationTemplateType } from "./types/GenerationTemplateType";

export class Template {
  constructor(
    public type: GenerationTemplateType,
    public props: Record<string, any> = {}
  ) { }

  assembleProperties(
    options: Record<string, any> = {}
  ): Record<string, any> {
    let assembled: Record<string, any> = {};

    Object.entries(this.props).forEach(([key, value]) => {
      const context: Record<string, any> = {
        ...options,
        ...assembled
      };
      assembled[key] =
        options[key] !== undefined ? options[key] :
          this.evaluatePropertyExpression(key, value, context);
    });

    // omit internal properties starting with '_'
    Object.keys(assembled).forEach(key => {
      if (key.startsWith('_')) {
        delete assembled[key];
      }
    });

    return assembled;
  }

  private evaluatePropertyExpression(key: string, expr: any, context: Record<string, any>): any {
    if (!expr || typeof expr !== 'string') {
      return expr;
    }

    if (expr.startsWith("=")) {
      try {
        return Deem.evaluate(expr.slice(1), context);
      } catch (e) {
        console.error(`Error evaluating expression for ${key}: ${expr}`, e);
        return null;
      }
    }

    return expr;
  }
}
