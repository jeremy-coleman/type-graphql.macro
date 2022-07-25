import type { Node, NodePath } from "@babel/core"
import type { ClassOrPredicate } from "./predicates"
import { isType } from "./predicates"
import { asserts, ensureArray } from "./utils"
import { container, tokens } from "./di"

export const assertNodeType: {
  <T extends Node, T1 extends Node>(
    node: NodePath<Node> | null,
    assertions: readonly [ClassOrPredicate<T>, ClassOrPredicate<T1>]
  ): NodePath<T | T1>
  <T extends Node>(
    node: NodePath<Node> | null,
    assertion: ClassOrPredicate<T>
  ): NodePath<T>
  <T extends Node, T1 extends Node>(
    node: Node,
    assertions: [ClassOrPredicate<T>, ClassOrPredicate<T1>]
  ): T | T1
  <T extends Node>(node: Node, assertion: ClassOrPredicate<T>): T
} = (node: any, assertions: ClassOrPredicate<any> | readonly ClassOrPredicate<any>[]) => {
  assertions = ensureArray(assertions)
  asserts(
    assertions.some(assertion => isType(assertion, node)),
    `Expected ${assertions.map(r => r.name).join(" or ")}, got ${node.type}`
  )
  return node
}

export function getAsserts() {
  const { transformFromAstSync } = container.import(tokens.babel)
  const {
    ArrayExpression,
    CallExpression,
    Decorator,
    Program,
    ExpressionStatement,
    isExpression,
  } = container.import(tokens.types)

  function printNode(node: Node) {
    const statement = isExpression(node)
      ? new ExpressionStatement(node)
      : (node as Statement)
    const program = new Program([statement])
    return transformFromAstSync(program, "")!.code
  }

  const color =
    process.env.NO_COLOR != null
      ? { yellow: "", reset: "" }
      : { yellow: "\u001b[33m", reset: "\u001b[0m" }

  /**
   * Asserts node is called as a decorator.
   * @param expectDecoratedNode Asserts the node being decorated satisfies the predicate
   * @returns Relevant nodes from the decorator calls.
   */
  function _assertCalledAsDecorator<T extends Node>(
    path: NodePath,
    expectDecoratedNode: (node: any) => node is T
  ) {
    const parentPath = assertNodeType(path.parentPath, CallExpression)
    if (parentPath.parent instanceof ArrayExpression) {
      throw new Error(
        "Decorator cannot be used inside an ArrayExpression. Is this file already transpiled by another compiler?" +
          " Found: " +
          color.yellow +
          printNode(parentPath.parentPath!.parent) +
          color.reset +
          "\n\n"
      )
    }

    const decoratorPath = assertNodeType(parentPath.parentPath, Decorator)
    const targetPath = assertNodeType(decoratorPath.parentPath, expectDecoratedNode)
    return {
      args: parentPath.node.arguments,
      callExpression: parentPath.node,
      callExpressionPath: path.parentPath as NodePath<CallExpression>,
      /** Alias for `targetPath.node` */
      target: targetPath.node,
      targetPath,
    }
  }

  function assertCalledAsDecorator<T extends Node, T2 extends Node>(
    path: NodePath,
    Classes: readonly [ClassOrPredicate<T>, ClassOrPredicate<T2>]
  ): ReturnType<typeof _assertCalledAsDecorator<T | T2>>

  function assertCalledAsDecorator<T extends Node>(
    path: NodePath,
    Class: readonly [ClassOrPredicate<T>]
  ): ReturnType<typeof _assertCalledAsDecorator<T>>

  function assertCalledAsDecorator(
    path: NodePath,
    candidates: readonly ClassOrPredicate<Node>[]
  ) {
    return _assertCalledAsDecorator(path, (node): node is Node =>
      candidates.some(Class => isType(Class, node))
    )
  }

  return {
    assertCalledAsDecorator,
  }
}
