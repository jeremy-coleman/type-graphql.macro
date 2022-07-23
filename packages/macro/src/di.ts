import type * as babelCore from "@babel/core"
import type * as t from "@babel/types"
import type { TypeGraphQLMacroConfig } from "./index"
import type { getImportManager } from "./importManager"
import type { getReifier } from "./reifier/index"
import type { getTypeHelpers } from "./typeHelper"
import type { getAsserts } from "./asserts"

class Token<T> {}

export let container: Container

export class Container {
  cache = new WeakMap<Token<any>, any>()
  resolvers = new WeakMap<Token<any>, (container: Container) => any>()

  static instantiate() {
    container = new Container()
    return container
  }

  get<T>(token: Token<T>): T {
    return this.cache.get(token)
  }

  import<T>(token: Token<T>): T {
    const { cache, resolvers } = this

    if (!cache.has(token)) {
      if (resolvers.has(token)) {
        const value = resolvers.get(token)!(this)
        cache.set(token, value)
      } else {
        throw new Error(`Unable to resolve dependency`)
      }
    }

    return cache.get(token)
  }

  set<T>(token: Token<T>, value: T) {
    this.cache.set(token, value)
    return this
  }

  setLazy<T>(token: Token<T>, fn: (container: Container) => T) {
    this.resolvers.set(token, fn)
    return this
  }
}

export namespace tokens {
  export const babel = new Token<typeof babelCore>()
  export const types = new Token<typeof t>()
  export const config = new Token<TypeGraphQLMacroConfig>()
  export const importManager = new Token<ReturnType<typeof getImportManager>>()
  export const reifier = new Token<ReturnType<typeof getReifier>>()
  export const typeHelpers = new Token<ReturnType<typeof getTypeHelpers>>()
  export const asserts = new Token<ReturnType<typeof getAsserts>>()
}

export type { babelCore }
