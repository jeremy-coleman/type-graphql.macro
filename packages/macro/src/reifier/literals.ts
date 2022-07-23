import { container, tokens } from "../di"

export function getLiteralTypeConverter() {
  const { Identifier, UnaryExpression } = container.import(tokens.types)

  const literalTypeMap = {
    BooleanLiteral: "Boolean",
    StringLiteral: "String",
    NumericLiteral: "Number",
    BigIntLiteral: "BigInt",
  }

  /** Returns a reified type reference from a JavaScript value expression */
  function getTypeFromValue(value?: Expression | null): Identifier | undefined {
    const mapValue = (literalTypeMap as Record<string, string>)[value?.type as any]
    if (mapValue) {
      return new Identifier(mapValue)
    }
    if (value instanceof UnaryExpression) {
      // Should be either NumericLiteral or BigIntLiteral
      return getTypeFromValue(value.argument)
    }
  }

  return getTypeFromValue
}
