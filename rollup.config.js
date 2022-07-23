// @ts-check
import rollup, { defineConfig } from "rollup"
import json from "@rollup/plugin-json"
import ts, { TypescriptPluginOptions } from "rollup-plugin-ts"
import replace from "@rollup/plugin-replace"
import { builtinModules } from "module"
import { dependencies } from "./package.json"

/**
 * @param {object} options
 * @param {string} options.dist
 * @param {rollup.ModuleFormat} options.format
 * @param {string} options.input
 * @param {Partial<TypescriptPluginOptions>=} options.options
 * @param {rollup.Plugin[]=} options.plugins
 */
const build = ({ dist, format, input, options, plugins = [] }) =>
  defineConfig({
    input,
    output: {
      file: `dist/${dist}`,
      format,
      banner: "/* eslint-disable */",
      exports: "named",
    },
    external: builtinModules
      .concat(Object.keys(dependencies))
      .concat("graphql", "babel-plugin-macros", "class-validator"),
    plugins: [
      ts({
        transpileOnly: true,
        ...options,
      }),
      json(),
      ...plugins,
    ],
    treeshake: {
      moduleSideEffects: (id, external) => !builtinModules.concat("semver").includes(id),
    },
  })

export default [
  build({
    input: "packages/macro/src/index.ts",
    dist: "index.js",
    format: "cjs",
    plugins: [
      replace({
        preventAssignment: true,
        PACKAGE_JSON: "require('./package.json')",
        "process.env.TEST": false,
      }),
    ],
  }),
  build({
    input: "packages/type-graphql/index.ts",
    dist: "type-graphql.js",
    format: "cjs",
    options: {
      tsconfig: {
        declaration: true,
      },
    },
  }),
]
