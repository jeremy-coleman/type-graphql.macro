import { addNamed } from "@babel/helper-module-imports"
import type { NodePath, types as t } from "@babel/core"
import { memoize } from "lodash"
import { container, tokens } from "./di"

enum Dependency {
  TypeGraphQL = "type-graphql",
  TSLib = "tslib",
  GraphQLTypeJSON = "graphql-type-json",
}

export function getImportManager({
  anyRef,
  importee,
}: {
  anyRef: NodePath<t.Identifier>
  importee: string
}) {
  const { ImportSpecifier, Identifier, cloneNode } = container.get(tokens.types)

  function cloneable<T extends (...args: any[]) => t.Node>(fn: T): T {
    const memoized = memoize(fn, (...args) => JSON.stringify(args))
    return ((...args: any[]) => cloneNode(memoized(...args))) as any
  }

  /** `ImportDeclaration` for this macro */
  const importDec = anyRef.scope.getBinding(anyRef.node.name)!.path
    .parentPath as NodePath<t.ImportDeclaration>
  importDec.node.source.value = importee

  /** Import an item from `type-graphql.macro` */
  const getNamedImportFromLib = cloneable((importee: string) => {
    const identifier = importDec.scope.generateUidIdentifier(importee)
    importDec.node.specifiers.push(
      new ImportSpecifier(identifier, new Identifier(importee))
    )
    return identifier
  })

  /** Create a function that imports an item from a specific module */
  const getNamedImportInternal = cloneable(
    (specifier: string, module: string): t.Identifier =>
      addNamed(importDec, specifier, module)
  )

  const getNamedImport = (specifier: string, module: Dependency) =>
    module === Dependency.TypeGraphQL
      ? getNamedImportFromLib(specifier)
      : getNamedImportInternal(specifier, module)

  const getModule = (module: Dependency) => ({
    import: (specifier: string) => getNamedImport(specifier, module),
  })

  return {
    importDec,
    modules: {
      typeGraphQL: getModule(Dependency.TypeGraphQL),
      tslib: getModule(Dependency.TSLib),
      graphQLTypeJSON: getModule(Dependency.GraphQLTypeJSON),
    },
  }
}
