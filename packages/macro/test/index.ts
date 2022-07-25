import * as fs from "fs"
import { resolve } from "path"
import assert from "assert/strict"
import test from "node:test"
import { transform } from "@babel/core"
import { format } from "prettier"
import type { TypeGraphQLMacroConfig } from "../src/index"

const canonize = (code: string) =>
  format(code, { parser: "babel-ts" }).trim().split("\n").filter(Boolean).join("\n")

const read = (path: string) => [path, fs.readFileSync(path, "utf-8")] as const

const equal = (name: string, config?: TypeGraphQLMacroConfig) => {
  const folder = resolve(__dirname, "snapshots", name)
  const [, actual] = read(resolve(folder, "input.txt"))
  const [expectedPath, expected] = read(resolve(folder, "output.txt"))
  const babelrc: babel.TransformOptions = fs.existsSync(resolve(folder, ".babelrc"))
    ? JSON.parse(read(resolve(folder, ".babelrc"))[1])
    : {}

  const transformed = transform(actual, {
    parserOpts: {
      ...babelrc.parserOpts,
      plugins: ["decorators-legacy", "typescript", "topLevelAwait"],
    },
    generatorOpts: {
      decoratorsBeforeExport: true,
    },
    babelrc: false,
    configFile: false,
    presets: babelrc.presets,
    plugins: [
      ...(babelrc.plugins ?? []),
      [
        "babel-plugin-macros",
        {
          isMacrosName: (name: string) => /\.macro$/.test(name),
          resolvePath: () => resolve(__dirname, "../src/index"),
          typeGraphQL: {
            emitParameterDecorator: false,
            typeMap: { "Types.ObjectId": "String" },
            ...config,
          },
        },
      ],
    ],
  })!.code!

  if (process.env.OVERWRITE) {
    fs.writeFileSync(expectedPath, transformed)
  } else {
    assert.deepEqual(canonize(transformed), canonize(expected))
  }
}

test("works with basic", () => {
  equal("basic")
})

test("works with special types", () => {
  equal("specialTypes")
})

test("automatically adds descriptions with `registerEnumType`", () => {
  equal("registerEnum")
})

test("adds decorators automatically with @Auto* decorators", () => {
  equal("autofields")
})

test("skips typeof check when referenced value is safe", () => {
  equal("references")
})

test("works with nullable types", () => {
  equal("nullable")
})

test("works with JSDoc comments", () => {
  equal("descriptions")
})

test("works with addClassNames", () => {
  equal("addClassNames", { addClassName: true })
  equal("legacyAddClassNames", { addClassName: "downlevel" })
})

test("works with default params", () => {
  equal("defaultParams")
})

test("skips @Ignore() fields", () => {
  equal("ignore")
})

test("redirects imports to the correct path", () => {
  equal("importRedirect")
})

test("works with classPropertyType", () => {
  equal("classPropertyType")
})

test("emulates TypeScript behavior with typescriptMetadata", () => {
  equal("typescriptMetadata")
})
