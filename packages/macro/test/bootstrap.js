#!/usr/bin/env node
globalThis.PACKAGE_JSON = {
  name: "type-graphql.macro",
}

require("@babel/register")({
  extensions: [".js", ".jsx", ".ts", ".tsx"],
  presets: ["@babel/preset-typescript"],
  plugins: [
    "@babel/plugin-transform-modules-commonjs",
    ["@babel/plugin-proposal-decorators", { version: "legacy" }],
  ],
})

require("./index.ts")
