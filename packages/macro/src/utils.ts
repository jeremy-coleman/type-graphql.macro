import type { NodePath } from "@babel/core"

export const cap =
  <T, R extends T>(fn: (value: T) => value is R) =>
  (value: T): value is R =>
    fn(value)

export const cap_ = cap as <T, R extends T>(
  fn: (value: T) => value is R
) => (value: NodePath<any>) => value is NodePath<R>

export const last = <T>(list: readonly T[]) => list[list.length - 1]

export const ensureArray = <T>(value?: null | T[] | T): T[] =>
  Array.isArray(value) ? value : value == null ? [] : [value]

export function asserts(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}
