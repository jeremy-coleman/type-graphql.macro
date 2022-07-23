import semVer from "semver"

import { UnmetGraphQLPeerDependencyError } from "../errors"

export function getInstalledGraphQLVersion(): string {
  const graphqlPackageJson = require("graphql/package.json")
  return graphqlPackageJson.version
}

export function getPeerDependencyGraphQLRequirement(): string {
  const ownPackageJson = PACKAGE_JSON
  return ownPackageJson.peerDependencies.graphql
}

let warned = false

export function ensureInstalledCorrectGraphQLPackage() {
  if (!process.browser) {
    const installedVersion = getInstalledGraphQLVersion()
    const versionRequirement = getPeerDependencyGraphQLRequirement()

    if (!warned && !semVer.satisfies(installedVersion, versionRequirement)) {
      warned = true
      console.warn(new UnmetGraphQLPeerDependencyError().message)
    }
  }
}
