import type { NodePath, types as t } from "@babel/core"
import { isEqual } from "lodash"
import { getLiteralTypeConverter } from "./literals"
import { getTypeOverrides } from "./overrides"
import { getQualifiedTypeConverter } from "./qualified"
import { ensureArray } from "../utils"
import { container, tokens } from "../di"

export type DeductedType = {
  type: Expression | undefined
  nullable: boolean
}

export const DeductedType = (type?: Expression, nullable = false) => ({
  type,
  nullable,
})

export function getReifier() {
  const {
    ArrayExpression,
    BinaryExpression,
    BlockStatement,
    ClassDeclaration,
    cloneNode,
    ConditionalExpression,
    ExportDefaultDeclaration,
    ExportNamedDeclaration,
    Identifier,
    Program,
    StringLiteral,
    TSQualifiedName,
    UnaryExpression,
    VariableDeclarator,
  } = container.import(tokens.types)
  const { modules } = container.import(tokens.importManager)

  const getTypeOverride = getTypeOverrides()
  const getTypeFromLiteral = getLiteralTypeConverter()
  const getTypeFromQualifiedName = getQualifiedTypeConverter()

  /**
   * Returns true if a given identifier name belongs to a reified class or
   * variable declarations that can be safely referenced.
   */
  function isSafeReferences(path: NodePath<any>, name: string): boolean {
    const binding = path.scope.getBinding(name)
    const isSafeDec = (node?: null | t.Node) =>
      node instanceof ClassDeclaration || node instanceof VariableDeclarator

    return ensureArray(binding?.path.container as t.Node[]).some(
      n =>
        isSafeDec(n) ||
        (n instanceof ExportNamedDeclaration && isSafeDec(n.declaration)) ||
        (n instanceof ExportDefaultDeclaration && isSafeDec(n.declaration))
    )
  }

  /**
   * Returns a reified type reference from a TypeScript type annotation node
   * and an optional associated JavaScript value expression, which is usually
   * a class property initializer.
   */
  function getType(
    context: NodePath<any>,
    type: TSType,
    value?: Expression | null
  ): DeductedType {
    if (!type && value != null) {
      return DeductedType(getTypeFromLiteral(value))
    } else if (!type) {
      return DeductedType(new Identifier("Object"))
    }

    let nullable = false
    function getType(type: TSType): Expression {
      const overrideResult = getTypeOverride(type)
      if (overrideResult) {
        return overrideResult
      }

      switch (type.type) {
        case "TSUnionType": {
          let result: Expression | undefined

          for (const subtype of type.types) {
            switch (subtype.type) {
              case "TSNullKeyword":
              case "TSUndefinedKeyword":
                nullable = true
                break
              default:
                const deducted = getType(subtype)
                if (result === undefined) {
                  result = deducted
                } else if (!isEqual(result, deducted)) {
                  return new Identifier("Object")
                }
                break
            }
          }
          return result ?? new Identifier("Object")
        }

        case "TSLiteralType":
          return getTypeFromLiteral(type.literal) ?? new Identifier("Object")
        case "TSStringKeyword":
          return new Identifier("String")
        case "TSNumberKeyword":
          return new Identifier("Number")
        case "TSBooleanKeyword":
          return new Identifier("Boolean")
        case "TSArrayType":
          return new ArrayExpression([getType(type.elementType)])
        case "TSTypeReference": {
          const { typeName, typeParameters } = type
          if (typeName instanceof TSQualifiedName) {
            return getTypeFromQualifiedName(
              /* context */ context.findParent(
                node => node instanceof BlockStatement || node instanceof Program
              )!,
              typeName
            )
          }

          if (!(typeName instanceof Identifier)) {
            return new Identifier("Object")
          }

          if (["Int", "Float", "int"].includes(typeName.name)) {
            return modules.typeGraphQL.import(typeName.name)
          }
          if (["Date"].includes(typeName.name)) {
            return new Identifier("Date")
          }
          if (typeName.name === "Record" && typeParameters?.params.length === 2) {
            return modules.graphQLTypeJSON.import("GraphQLJSONObject")
          }

          if (isSafeReferences(context, typeName.name)) {
            return cloneNode(typeName)
          }

          return new ConditionalExpression(
            new BinaryExpression(
              "===",
              new UnaryExpression("typeof", typeName),
              new StringLiteral("undefined")
            ),
            new Identifier("Object"),
            cloneNode(typeName)
          )
        }

        default:
          return new Identifier("Object")
      }
    }
    return DeductedType(getType(type), nullable)
  }

  return {
    getType,
    getTypeFromLiteral,
  }
}
