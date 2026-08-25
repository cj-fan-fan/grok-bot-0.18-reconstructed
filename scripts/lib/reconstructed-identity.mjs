import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const identityPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../source/shared/reconstructed-identity.json",
);

export const reconstructedIdentity = Object.freeze(JSON.parse(readFileSync(identityPath, "utf8")));
export const officialBundleId = reconstructedIdentity.official.bundleId;
export const officialProductName = reconstructedIdentity.official.productName;
export const officialUrlSchemes = reconstructedIdentity.official.urlSchemes;
export const reconstructedBundleId = reconstructedIdentity.reconstructed.bundleId;
export const reconstructedName = reconstructedIdentity.reconstructed.displayName;
export const reconstructedProductName = reconstructedIdentity.reconstructed.productName;
export const reconstructedUrlScheme = reconstructedIdentity.reconstructed.urlScheme;
export const reconstructedUserDataDirName = reconstructedIdentity.reconstructed.userDataDirName;
