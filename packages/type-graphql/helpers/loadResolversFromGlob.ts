export function loadResolversFromGlob(globString: string) {
  if (!process.browser) {
    const glob: typeof import("glob") = require("glob")
    const filePaths = glob.sync(globString)
    const modules = filePaths.map(fileName => require(fileName))
  } else {
    throw new Error("loadResolversFromGlob is not supported in browser.")
  }
}
