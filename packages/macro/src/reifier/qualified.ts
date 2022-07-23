import type { NodePath } from "@babel/core"
import { container, tokens } from "../di"

export function getQualifiedTypeConverter() {
  const { Identifier, OptionalMemberExpression, cloneNode } = container.import(
    tokens.types
  )
  const { template } = container.import(tokens.babel)

  const qualifiedNameType = template.expression(`
  typeof (%%tempId%% = typeof %%leftMost%% !== "undefined" && %%right%%) === "function"
    ? %%tempId%%
    : Object
  `) as (options: {
    tempId: Identifier
    leftMost: Identifier
    right: Identifier | OptionalMemberExpression
  }) => ConditionalExpression

  /** `TSQualifiedName` to reified type value */
  function getQualifiedNameType(context: NodePath<any>, typeName: TSQualifiedName) {
    function convert(entity: TSEntityName): Identifier | OptionalMemberExpression {
      if (entity instanceof Identifier) {
        return entity
      } else {
        return new OptionalMemberExpression(
          convert(entity.left),
          convert(entity.right),
          /* computed */ false,
          /* optional */ true
        )
      }
    }

    function leftMost(entity: TSEntityName): Identifier {
      return entity instanceof Identifier ? entity : leftMost(entity.left)
    }

    const tempId = context.scope.generateDeclaredUidIdentifier()

    return qualifiedNameType({
      tempId,
      leftMost: cloneNode(leftMost(typeName)),
      right: convert(typeName),
    })
  }

  return getQualifiedNameType
}
