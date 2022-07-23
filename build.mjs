#!/usr/bin/env zx
import fs from "fs/promises"
import javascript from "dedent"

await fs.rm("dist", { recursive: true, force: true })
await fs.mkdir("dist")
await $`npx rollup -c`
await fs.copyFile("LICENSE", "dist/LICENSE")
await fs.copyFile("README.md", "dist/README.md")

await fs.rename("dist/type-graphql.d.ts", "dist/index.d.ts")

// prettier-ignore
await fs.appendFile("dist/index.d.ts", javascript`
  declare function Arg(): ParameterDecorator;

  /** Same as \`ObjectType\` but all fields will be automatically declared a \`@Field()\` */
  declare function AutoObjectType(): ClassDecorator;

  /** Same as \`InputType\` but all fields will be automatically declared a \`@Field()\` */
  declare function AutoInputType(): ClassDecorator;

  /** Causes the field to be omitted from \`Auto.*Type\` */
  declare function Ignore(): PropertyDecorator;

  declare function registerEnumType<TEnum extends string>(enumObj: TEnum[]): TEnum[]
  declare function registerEnumType<TEnum extends object>(enumObj: TEnum): TEnum

  /**
   * Macro that will be replaced with a function that returns the type of a class property.
   * @example
   * \`\`\`ts
   * @Inject(classPropertyType)
   * prop: Class;
   * \`\`\`
   */
  declare const classPropertyType: () => unknown;
` // `
);

{
  const base = require("./package.json")
  const pkg = {
    name: "type-graphql.macro",
    description: "Babel macro for type-graphql",
    version: base.version,
    main: "index.js",
    dependencies: base.dependencies,
    peerDependencies: base.peerDependencies,
  }

  await fs.writeFile("./dist/package.json", JSON.stringify(pkg, null, 2))
}

await $`npx prettier --write ./dist/*.{js,d.ts,json}`
