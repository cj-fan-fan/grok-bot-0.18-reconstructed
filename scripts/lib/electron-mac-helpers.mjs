import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import {
  officialBundleId,
  officialProductName,
  reconstructedBundleId,
} from "./reconstructed-identity.mjs";
import { getPlistString, hasPlistKey, readPlistXml, removePlistKey, setPlistString, writePlistXml } from "./plist-xml.mjs";

// Electron 42.1.0 `OverrideChildProcessPath` looks up
// `{ELECTRON_PRODUCT_NAME} Helper*.app`, then `{GetApplicationName()} Helper*.app`
// where GetApplicationName() is the parent CFBundleName. The shipped 0.18 shell
// keeps `Electron Framework.framework`, so ELECTRON_PRODUCT_NAME is "Electron"
// and the CFBundleName fallback is what actually finds the helpers.
// Chromium then expects helper CFBundleIdentifiers of `{parentId}.helper{,.GPU,.Plugin,.Renderer}`.
export const ELECTRON_MAC_HELPER_VARIANTS = Object.freeze([
  Object.freeze({ kind: "helper", idSuffix: ".helper", nameSuffix: " Helper" }),
  Object.freeze({ kind: "gpu", idSuffix: ".helper.GPU", nameSuffix: " Helper (GPU)" }),
  Object.freeze({ kind: "plugin", idSuffix: ".helper.Plugin", nameSuffix: " Helper (Plugin)" }),
  Object.freeze({ kind: "renderer", idSuffix: ".helper.Renderer", nameSuffix: " Helper (Renderer)" }),
]);

export function electronHelperBundleId(parentBundleId, variant) {
  if (typeof parentBundleId !== "string" || parentBundleId.length === 0) {
    throw new TypeError("A parent CFBundleIdentifier is required");
  }
  return `${parentBundleId}${variant.idSuffix}`;
}

export function electronHelperProductName(applicationName, variant) {
  if (typeof applicationName !== "string" || applicationName.length === 0) {
    throw new TypeError("An application CFBundleName is required");
  }
  return `${applicationName}${variant.nameSuffix}`;
}

export function reconstructedHelperBundleId(kind) {
  const variant = ELECTRON_MAC_HELPER_VARIANTS.find((entry) => entry.kind === kind);
  if (variant == null) throw new TypeError(`Unknown Electron helper kind: ${kind}`);
  return electronHelperBundleId(reconstructedBundleId, variant);
}

export const reconstructedHelperBundleIds = Object.freeze({
  helper: reconstructedHelperBundleId("helper"),
  gpu: reconstructedHelperBundleId("gpu"),
  plugin: reconstructedHelperBundleId("plugin"),
  renderer: reconstructedHelperBundleId("renderer"),
});

export const officialHelperBundleIds = Object.freeze({
  helper: electronHelperBundleId(officialBundleId, ELECTRON_MAC_HELPER_VARIANTS[0]),
  gpu: electronHelperBundleId(officialBundleId, ELECTRON_MAC_HELPER_VARIANTS[1]),
  plugin: electronHelperBundleId(officialBundleId, ELECTRON_MAC_HELPER_VARIANTS[2]),
  renderer: electronHelperBundleId(officialBundleId, ELECTRON_MAC_HELPER_VARIANTS[3]),
});

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function helperBundleName(applicationName, variant) {
  return `${electronHelperProductName(applicationName, variant)}.app`;
}

function helperExecutableName(applicationName, variant) {
  return electronHelperProductName(applicationName, variant);
}

function helperExecutablePath(appPath, applicationName, variant) {
  return path.join(
    appPath,
    "Contents",
    "Frameworks",
    helperBundleName(applicationName, variant),
    "Contents",
    "MacOS",
    helperExecutableName(applicationName, variant),
  );
}

async function locateHelperRoot(frameworks, applicationName, sourceApplicationName, variant) {
  const destination = path.join(frameworks, helperBundleName(applicationName, variant));
  const source = path.join(frameworks, helperBundleName(sourceApplicationName, variant));
  if (await pathExists(source)) return source;
  if (await pathExists(destination)) return destination;
  throw new Error(`Missing Electron helper bundle ${helperBundleName(sourceApplicationName, variant)}`);
}

async function rewriteHelperPlist(infoPlist, { bundleId, productName }) {
  let xml = await readPlistXml(infoPlist);
  xml = setPlistString(xml, "CFBundleIdentifier", bundleId);
  xml = setPlistString(xml, "CFBundleName", productName);
  xml = setPlistString(xml, "CFBundleExecutable", productName);
  if (hasPlistKey(xml, "CFBundleDisplayName")) {
    xml = setPlistString(xml, "CFBundleDisplayName", productName);
  }
  xml = removePlistKey(xml, "ElectronTeamID");
  await writePlistXml(infoPlist, xml);
}

async function renameHelperExecutable(helperRoot, productName) {
  const macOS = path.join(helperRoot, "Contents", "MacOS");
  const entries = await readdir(macOS, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() || entry.isSymbolicLink()).map((entry) => entry.name);
  if (files.length !== 1) {
    throw new Error(`Electron helper ${path.basename(helperRoot)} must contain exactly one executable, found ${files.join(", ") || "(none)"}`);
  }
  const current = path.join(macOS, files[0]);
  const next = path.join(macOS, productName);
  if (current !== next) await rename(current, next);
}

export async function inspectMacElectronHelpers(appPath) {
  const infoPlist = path.join(appPath, "Contents", "Info.plist");
  const xml = await readPlistXml(infoPlist);
  const parentBundleId = getPlistString(xml, "CFBundleIdentifier");
  const applicationName = getPlistString(xml, "CFBundleName");
  if (parentBundleId == null || applicationName == null) {
    throw new Error("Packaged app Info.plist is missing CFBundleIdentifier or CFBundleName");
  }
  const frameworks = path.join(appPath, "Contents", "Frameworks");
  const helpers = [];
  for (const variant of ELECTRON_MAC_HELPER_VARIANTS) {
    const helperRoot = path.join(frameworks, helperBundleName(applicationName, variant));
    if (!(await pathExists(helperRoot))) {
      throw new Error(`Missing Electron helper bundle ${helperBundleName(applicationName, variant)}; Electron 42 looks up {CFBundleName} Helper*.app`);
    }
    const helperPlist = path.join(helperRoot, "Contents", "Info.plist");
    const helperXml = await readPlistXml(helperPlist);
    helpers.push({
      kind: variant.kind,
      appName: helperBundleName(applicationName, variant),
      productName: electronHelperProductName(applicationName, variant),
      bundleId: getPlistString(helperXml, "CFBundleIdentifier"),
      executableName: getPlistString(helperXml, "CFBundleExecutable"),
      executablePath: helperExecutablePath(appPath, applicationName, variant),
      hasElectronTeamID: hasPlistKey(helperXml, "ElectronTeamID"),
    });
  }
  return {
    parentBundleId,
    applicationName,
    hasElectronTeamID: hasPlistKey(xml, "ElectronTeamID"),
    helpers,
  };
}

export async function assertPackagedElectronHelpers(appPath, {
  expectedParentBundleId,
  forbiddenParentBundleId = officialBundleId,
} = {}) {
  const inspected = await inspectMacElectronHelpers(appPath);
  if (expectedParentBundleId != null && inspected.parentBundleId !== expectedParentBundleId) {
    throw new Error(`Unexpected parent CFBundleIdentifier: ${inspected.parentBundleId}`);
  }
  if (inspected.hasElectronTeamID) {
    throw new Error("Packaged app still declares ElectronTeamID; Chromium would look up {team}.{bundleId}.helper*");
  }
  const frameworks = path.join(appPath, "Contents", "Frameworks");
  const leftoverOfficial = [];
  for (const variant of ELECTRON_MAC_HELPER_VARIANTS) {
    const officialName = helperBundleName(officialProductName, variant);
    const expectedName = helperBundleName(inspected.applicationName, variant);
    if (officialName !== expectedName && await pathExists(path.join(frameworks, officialName))) {
      leftoverOfficial.push(officialName);
    }
  }
  if (leftoverOfficial.length > 0) {
    throw new Error(`Packaged app still contains official helper bundles: ${leftoverOfficial.join(", ")}`);
  }
  for (const helper of inspected.helpers) {
    const variant = ELECTRON_MAC_HELPER_VARIANTS.find((entry) => entry.kind === helper.kind);
    const expectedId = electronHelperBundleId(inspected.parentBundleId, variant);
    const forbiddenId = electronHelperBundleId(forbiddenParentBundleId, variant);
    if (helper.bundleId !== expectedId) {
      throw new Error(`Helper ${helper.kind} CFBundleIdentifier is ${helper.bundleId}, expected ${expectedId}`);
    }
    if (helper.bundleId === forbiddenId) {
      throw new Error(`Helper ${helper.kind} still uses the official CFBundleIdentifier ${forbiddenId}`);
    }
    if (helper.executableName !== helper.productName) {
      throw new Error(`Helper ${helper.kind} CFBundleExecutable is ${helper.executableName}, expected ${helper.productName}`);
    }
    if (helper.hasElectronTeamID) {
      throw new Error(`Helper ${helper.kind} still declares ElectronTeamID`);
    }
    if (!(await pathExists(helper.executablePath))) {
      throw new Error(`Electron 42 helper executable is missing: ${helper.executablePath}`);
    }
  }
  return inspected;
}

export async function retargetPackagedElectronHelpers(appPath, {
  sourceApplicationName = officialProductName,
} = {}) {
  if (typeof appPath !== "string" || !appPath.endsWith(".app")) {
    throw new TypeError("An application bundle path is required");
  }
  const infoPlist = path.join(appPath, "Contents", "Info.plist");
  let xml = await readPlistXml(infoPlist);
  const parentBundleId = getPlistString(xml, "CFBundleIdentifier");
  const applicationName = getPlistString(xml, "CFBundleName");
  if (parentBundleId == null || applicationName == null) {
    throw new Error("Packaged app Info.plist is missing CFBundleIdentifier or CFBundleName");
  }
  xml = removePlistKey(xml, "ElectronTeamID");
  await writePlistXml(infoPlist, xml);

  const frameworks = path.join(appPath, "Contents", "Frameworks");
  for (const variant of ELECTRON_MAC_HELPER_VARIANTS) {
    const productName = electronHelperProductName(applicationName, variant);
    const bundleId = electronHelperBundleId(parentBundleId, variant);
    const helperRoot = await locateHelperRoot(frameworks, applicationName, sourceApplicationName, variant);
    await rm(path.join(helperRoot, "Contents", "_CodeSignature"), { recursive: true, force: true });
    await rewriteHelperPlist(path.join(helperRoot, "Contents", "Info.plist"), { bundleId, productName });
    await renameHelperExecutable(helperRoot, productName);
    const destination = path.join(frameworks, helperBundleName(applicationName, variant));
    if (helperRoot !== destination) await rename(helperRoot, destination);
  }
  return await assertPackagedElectronHelpers(appPath, { expectedParentBundleId: parentBundleId });
}
