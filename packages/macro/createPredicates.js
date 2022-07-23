#!/usr/bin/env node
// @ts-check
const fs = require("fs")
const { resolve } = require("path")
const { format } = require("prettier")

const names = require("./src/predicates/classes.json")

/** @param {string} name */
const lowerCase = name =>
  name.startsWith("TS") ? "ts" + name.slice(2) : name[0].toLowerCase() + name.slice(1)

const prefix = `
  import type * as t from "@babel/types";

  declare module "@babel/types" {
`

const result = names
  .map(
    name => `
      export class ${name} {
        constructor(...args: Parameters<typeof t.${lowerCase(name)}>)
      }`
  )
  .map(text => text.trim())
  .join("\n\n")

fs.writeFileSync(
  resolve(__dirname, "./src/predicates/types.generated.d.ts"),
  format(prefix + result + "}", { parser: "babel-ts" })
)

fs.writeFileSync(
  resolve(__dirname, "./src/predicates/global.generated.d.ts"),
  format(
    names
      .concat(["Expression", "TSType", "TSEntityName", "Statement"])
      .sort()
      .map(name => `declare type ${name} = import("@babel/types").${name};`)
      .join("\n"),
    { parser: "babel-ts" }
  )
)
