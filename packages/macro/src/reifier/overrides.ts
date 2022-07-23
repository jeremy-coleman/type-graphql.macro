import { forEach, isMatch, map } from "lodash"
import type { TypeGraphQLMacroConfig } from "../index"
import { assertNodeType } from "../asserts"
import { container, tokens } from "../di"

export function getTypeOverrides(): (type: TSType) => Expression | undefined {
  const { ExpressionStatement } = container.import(tokens.types)
  const { parseSync, template } = container.import(tokens.babel)
  const config = container.import(tokens.config)

  const { typeMap: typeMapRaw } = config as TypeGraphQLMacroConfig

  const parseTypeExpression = (source: string): TSType => {
    const { program }: { program: Program } = parseSync(`var _: ${source}`, {
      parserOpts: { plugins: ["typescript"] },
    })! as any

    const varDec = program.body[0] as VariableDeclaration
    const id = varDec.declarations[0].id as Identifier
    return (id.typeAnnotation as TSTypeAnnotation).typeAnnotation
  }

  const cleanNode = <T extends object>(node: T) => {
    const res: any = Object.create(Object.getPrototypeOf(node))
    const blacklist = new Set(["start", "end", "loc"])
    forEach(node, (value, key) => {
      if (blacklist.has(key) || value === undefined) return
      if (typeof value === "object" && value != null) {
        res[key] = cleanNode(value as any)
      } else {
        res[key] = value
      }
    })
    return res as T
  }

  if (typeMapRaw) {
    const typeMap: [TSType, Expression][] = map(typeMapRaw, (value, key) => [
      cleanNode(parseTypeExpression(key)),
      assertNodeType(template.ast(value) as any, ExpressionStatement).expression,
    ])
    return (type: TSType): Expression | undefined => {
      for (const [key, value] of typeMap) {
        if (isMatch(type, key)) {
          return value
        }
      }
      return undefined!
    }
  }

  return () => undefined!
}
