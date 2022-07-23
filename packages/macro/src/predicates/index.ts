import type { Node } from "@babel/core"
import type { types } from "@babel/core"
import classes from "./classes.json"

export const predicateMap = new WeakMap<Function, (node: Node) => boolean>([])

export type Class<T> = new (...args: any[]) => T
export type Predicate<T extends Node> = (node: Node) => node is T
export type ClassOrPredicate<T extends Node> = Class<T> | Predicate<T>

export function attachConstructors(t: typeof types): typeof types {
  const copy: any = { ...t }

  for (const className of classes) {
    const lowerCase = className.startsWith("TS")
      ? `ts${className.slice(2)}`
      : className[0].toLowerCase() + className.slice(1)

    const constructor = (t as any)[lowerCase]
    const predicate = (t as any)[`is${className}`]

    function NodeClass(...args: any[]) {
      return constructor(...args)
    }

    Object.defineProperties(NodeClass, {
      name: { value: className },
      [Symbol.hasInstance]: { value: predicate },
    })

    predicateMap.set(NodeClass, predicate)

    copy[className] = NodeClass
  }

  return copy
}

export function isType<T extends Node>(
  predicate: ClassOrPredicate<T>,
  node: Node
): node is T {
  return (predicateMap.get(predicate) ?? (predicate as Predicate<T>))(node)
}

/** Returns `node` is type matches and `undefined` otherwise */
export function filter<T>(Class: Class<T>, node?: Node | null): T | undefined {
  if (node != null && node instanceof Class) {
    return node
  }
}
