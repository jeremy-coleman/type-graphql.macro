declare const PACKAGE_JSON: {
  name: string
  peerDependencies: {
    graphql: string
  }
}

declare module "@babel/helper-module-imports"

declare module "node:test" {
  export function describe(title: string, suite: () => void): void
  export function it(title: string, fn: () => void): void
}
