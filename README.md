# type-graphql.macro

Upstream: https://github.com/MichalLytek/type-graphql.git

## Next.js usage

```ts
export default {
  // ...
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: RegExp(),
      use: {
        loader: "babel-loader",
        options: {
          babelrc: false,
          configFile: false,
          parserOpts: { plugins: ["typescript", "decorators-legacy"] },
          plugins: ["babel-plugin-macros"],
        },
      },
    })

    return config
  },
}
```
