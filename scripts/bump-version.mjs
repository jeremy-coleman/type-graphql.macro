#!/usr/bin/env node
import childProcess from "child_process"
import fs from "fs"
import pkg from "../package.json" assert { type: "json" }

const latest = childProcess.execSync(`npm show ${pkg.name} version`).toString().trim()
const nextVer = latest
  .split(".")
  .map(v => parseInt(v, 10))
  .map((v, i) => (i === 2 ? v + 1 : v))
  .join(".")

fs.writeFileSync("package.json", JSON.stringify({ ...pkg, version: nextVer }, null, 2))
