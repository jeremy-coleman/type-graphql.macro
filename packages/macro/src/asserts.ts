import type { Node, NodePath } from "@babel/core"
import type { ClassOrPredicate } from "./predicates"
import { isType } from "./predicates"
import { asserts } from "./utils"
import { container, tokens } from "./di"

export const assertNodeType = <T extends Node>(
  node: Node,
  assertion: ClassOrPredicate<T>
): T => {
  asserts(isType(assertion, node), `Expected ${assertion.name}, got ${node.type}`)
  return node as T
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
    const parent = assertNodeType(path.parent, CallExpression)
    if (path.parentPath!.parent instanceof ArrayExpression) {
      throw new Error(
        "Decorator cannot be used inside an ArrayExpression. Is this file already transpiled by another compiler?" +
          " Found: " +
          color.yellow +
          printNode(path.parentPath!.parentPath!.parent) +
          color.reset +
          "\n\n"
      )
    }

    assertNodeType(path.parentPath!.parent, Decorator)
    assertNodeType(path.parentPath!.parentPath!.parent, expectDecoratedNode)
    const targetPath = path.parentPath!.parentPath!.parentPath as NodePath<T>
    return {
      args: parent.arguments,
      callExpression: parent,
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
