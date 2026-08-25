import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertPackagedElectronHelpers,
  ELECTRON_MAC_HELPER_VARIANTS,
  officialHelperBundleIds,
  reconstructedHelperBundleIds,
  retargetPackagedElectronHelpers,
} from "../scripts/lib/electron-mac-helpers.mjs";
import { getPlistString, hasPlistKey, readPlistXml } from "../scripts/lib/plist-xml.mjs";
import {
  officialBundleId,
  officialProductName,
  officialUrlSchemes,
  reconstructedBundleId,
  reconstructedIdentity,
  reconstructedName,
  reconstructedProductName,
  reconstructedUrlScheme,
  reconstructedUserDataDirName,
} from "../scripts/lib/reconstructed-identity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("reconstructed packaged identity is distinct from official Grok Bot", () => {
  assert.equal(reconstructedBundleId, "com.anysphere.sand.reconstructed");
  assert.equal(officialBundleId, "com.anysphere.sand");
  assert.notEqual(reconstructedBundleId, officialBundleId);

  assert.equal(officialProductName, "Grok Bot");
  assert.equal(reconstructedProductName, "Grok Bot 0.18 Reconstructed");
  assert.equal(reconstructedName, reconstructedProductName);
  assert.equal(reconstructedUserDataDirName, reconstructedProductName);
  assert.notEqual(reconstructedProductName, officialProductName);

  assert.deepEqual(officialUrlSchemes, ["sand", "grokbot"]);
  assert.equal(reconstructedUrlScheme, "sand-reconstructed");
  assert.equal(officialUrlSchemes.includes(reconstructedUrlScheme), false);

  const docker = reconstructedIdentity.reconstructed.localDocker;
  assert.equal(docker.containerName, "grok-bot-reconstructed-local-vm");
  assert.notEqual(docker.containerName, "grok-bot-local-vm");
  assert.equal(docker.hostPorts.gateway, 11340);
  assert.notEqual(docker.hostPorts.gateway, 1340);
  for (const [name, hostPort] of Object.entries(docker.hostPorts)) {
    assert.notEqual(hostPort, docker.containerPorts[name], `${name} host port must not collide with the box-internal port`);
    assert.notEqual(hostPort, 1337);
    assert.notEqual(hostPort, 1339);
    assert.notEqual(hostPort, 1340);
    assert.notEqual(hostPort, 6080);
    assert.notEqual(hostPort, 6081);
    assert.notEqual(hostPort, 8787);
    assert.notEqual(hostPort, 8790);
  }

  assert.equal(reconstructedIdentity.reconstructed.productionDataDirname, ".grokbot-reconstructed");
  assert.equal(reconstructedIdentity.reconstructed.mcpOAuthLoopbackPort, 18787);
});

test("packaging scripts assign unique bundle name, URL scheme, userData, and productName", async () => {
  const packager = await readFile(path.join(repoRoot, "scripts", "package-macos.mjs"), "utf8");
  assert.match(packager, /CFBundleName/);
  assert.match(packager, /reconstructedUrlScheme/);
  assert.match(packager, /retargetPackagedElectronHelpers/);
  assert.doesNotMatch(packager, /<string>sand<\/string>/);
  assert.doesNotMatch(packager, /<string>grokbot<\/string>/);

  const verifier = await readFile(path.join(repoRoot, "scripts", "verify.mjs"), "utf8");
  assert.match(verifier, /CFBundleName/);
  assert.match(verifier, /reconstructedUrlScheme/);
  assert.match(verifier, /official URL scheme/);
  assert.match(verifier, /assertPackagedElectronHelpers/);

  const diagnostic = await readFile(path.join(repoRoot, "scripts", "package-fidelity-diagnostic.mjs"), "utf8");
  assert.match(diagnostic, /retargetPackagedElectronHelpers/);

  const asarBuild = await readFile(path.join(repoRoot, "scripts", "lib", "build-asar.mjs"), "utf8");
  assert.match(asarBuild, /stagedPackage\.productName = reconstructedProductName/);

  const packagedPackage = JSON.parse(await readFile(path.join(repoRoot, "src", "app", "package.json"), "utf8"));
  assert.equal(packagedPackage.productName, reconstructedProductName);
  assert.notEqual(packagedPackage.productName, officialProductName);

  const bootstrap = await readFile(path.join(repoRoot, "source", "electron-main", "startup", "desktop-user-data-bootstrap.ts"), "utf8");
  assert.match(bootstrap, /RECONSTRUCTED_PRODUCT_NAME/);
  assert.match(bootstrap, /RECONSTRUCTED_USER_DATA_DIR_NAME/);
  assert.match(bootstrap, /setName\?\.\(RECONSTRUCTED_PRODUCT_NAME\)/);
  assert.match(bootstrap, /setPath\("userData"/);
  assert.match(bootstrap, /setPath\("sessionData"/);

  const deepLink = await readFile(path.join(repoRoot, "source", "shared", "deep-link.ts"), "utf8");
  assert.match(deepLink, /SAND_DEEP_LINK_SCHEME = RECONSTRUCTED_URL_SCHEME/);
  assert.doesNotMatch(deepLink, /SAND_DEEP_LINK_SCHEME = "sand"/);

  const hostPaths = await readFile(path.join(repoRoot, "source", "host", "host-paths.ts"), "utf8");
  assert.match(hostPaths, /SAND_PRODUCTION_DATA_DIRNAME = RECONSTRUCTED_PRODUCTION_DATA_DIRNAME/);

  const docker = await readFile(path.join(repoRoot, "source", "electron-main", "box", "local-docker-host-connector.ts"), "utf8");
  assert.match(docker, /LOCAL_DOCKER_HOST_PORTS\.gateway/);
  assert.doesNotMatch(docker, /grok-bot-local-vm"/);
  assert.doesNotMatch(docker, /127\.0\.0\.1:1340:1340/);

  const userDataDir = path.posix.join("/Users/test/Library/Application Support", reconstructedUserDataDirName);
  assert.equal(userDataDir, "/Users/test/Library/Application Support/Grok Bot 0.18 Reconstructed");
  assert.notEqual(userDataDir, "/Users/test/Library/Application Support/Grok Bot");
});

test("Electron 42 helper IDs are derived from the reconstructed parent bundle id", () => {
  assert.deepEqual(reconstructedHelperBundleIds, {
    helper: "com.anysphere.sand.reconstructed.helper",
    gpu: "com.anysphere.sand.reconstructed.helper.GPU",
    plugin: "com.anysphere.sand.reconstructed.helper.Plugin",
    renderer: "com.anysphere.sand.reconstructed.helper.Renderer",
  });
  assert.deepEqual(officialHelperBundleIds, {
    helper: "com.anysphere.sand.helper",
    gpu: "com.anysphere.sand.helper.GPU",
    plugin: "com.anysphere.sand.helper.Plugin",
    renderer: "com.anysphere.sand.helper.Renderer",
  });
  for (const kind of Object.keys(reconstructedHelperBundleIds)) {
    assert.notEqual(reconstructedHelperBundleIds[kind], officialHelperBundleIds[kind]);
    assert.equal(reconstructedHelperBundleIds[kind].startsWith(`${reconstructedBundleId}.helper`), true);
    assert.equal(officialHelperBundleIds[kind].startsWith(`${officialBundleId}.helper`), true);
  }
});

function infoPlistXml(values) {
  const rows = Object.entries(values).flatMap(([key, value]) => [`    <key>${key}</key>`, `    <string>${value}</string>`]);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${rows.join("\n")}
</dict>
</plist>
`;
}

async function writeFakeHelperApp(frameworks, applicationName, variant, { bundleId, teamId = "ABCD123456" } = {}) {
  const productName = `${applicationName}${variant.nameSuffix}`;
  const helperRoot = path.join(frameworks, `${productName}.app`);
  await mkdir(path.join(helperRoot, "Contents", "MacOS"), { recursive: true });
  await writeFile(path.join(helperRoot, "Contents", "MacOS", productName), "helper-stub\n");
  await writeFile(path.join(helperRoot, "Contents", "Info.plist"), infoPlistXml({
    CFBundleDisplayName: productName,
    CFBundleExecutable: productName,
    CFBundleIdentifier: bundleId,
    CFBundleName: productName,
    ElectronTeamID: teamId,
  }));
  return helperRoot;
}

async function writeFakeElectronApp(root, {
  appName,
  parentBundleId,
  applicationName,
  helperApplicationName = officialProductName,
  helperParentBundleId = officialBundleId,
}) {
  const appPath = path.join(root, appName);
  const frameworks = path.join(appPath, "Contents", "Frameworks");
  await mkdir(path.join(appPath, "Contents", "MacOS"), { recursive: true });
  await mkdir(frameworks, { recursive: true });
  await writeFile(path.join(appPath, "Contents", "MacOS", "Grok Bot"), "main-stub\n");
  await writeFile(path.join(appPath, "Contents", "Info.plist"), infoPlistXml({
    CFBundleDisplayName: applicationName,
    CFBundleExecutable: "Grok Bot",
    CFBundleIdentifier: parentBundleId,
    CFBundleName: applicationName,
    ElectronTeamID: "ABCD123456",
  }));
  for (const variant of ELECTRON_MAC_HELPER_VARIANTS) {
    await writeFakeHelperApp(frameworks, helperApplicationName, variant, {
      bundleId: `${helperParentBundleId}${variant.idSuffix}`,
    });
  }
  return appPath;
}

test("packaging retargets helper bundle ids and CFBundleName-derived helper paths", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "grok-bot-helpers-"));
  try {
    const appPath = await writeFakeElectronApp(root, {
      appName: "Grok Bot 0.18 Reconstructed.app",
      parentBundleId: reconstructedBundleId,
      applicationName: reconstructedName,
    });

    const inspected = await retargetPackagedElectronHelpers(appPath);
    assert.equal(inspected.parentBundleId, reconstructedBundleId);
    assert.equal(inspected.applicationName, reconstructedName);
    assert.equal(inspected.hasElectronTeamID, false);

    const frameworks = path.join(appPath, "Contents", "Frameworks");
    for (const variant of ELECTRON_MAC_HELPER_VARIANTS) {
      const expectedName = `${reconstructedName}${variant.nameSuffix}`;
      const helperApp = path.join(frameworks, `${expectedName}.app`);
      const helperXml = await readPlistXml(path.join(helperApp, "Contents", "Info.plist"));
      assert.equal(getPlistString(helperXml, "CFBundleIdentifier"), `${reconstructedBundleId}${variant.idSuffix}`);
      assert.equal(getPlistString(helperXml, "CFBundleName"), expectedName);
      assert.equal(getPlistString(helperXml, "CFBundleExecutable"), expectedName);
      assert.equal(hasPlistKey(helperXml, "ElectronTeamID"), false);
      await readFile(path.join(helperApp, "Contents", "MacOS", expectedName), "utf8");
      await assert.rejects(() => readFile(path.join(frameworks, `${officialProductName}${variant.nameSuffix}.app`, "Contents", "Info.plist")));
    }

    const again = await retargetPackagedElectronHelpers(appPath);
    assert.deepEqual(
      again.helpers.map((helper) => helper.bundleId),
      ELECTRON_MAC_HELPER_VARIANTS.map((variant) => `${reconstructedBundleId}${variant.idSuffix}`),
    );
    await assertPackagedElectronHelpers(appPath, { expectedParentBundleId: reconstructedBundleId });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("helper rewrite keeps Grok Bot helper folder names when CFBundleName is unchanged", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "grok-bot-helpers-fidelity-"));
  try {
    const diagnosticId = "com.anysphere.sand.reconstructed.fidelity.diagnostic.buildabc123";
    const appPath = await writeFakeElectronApp(root, {
      appName: "Grok Bot 0.18 Fidelity Diagnostic.app",
      parentBundleId: diagnosticId,
      applicationName: officialProductName,
    });
    const inspected = await retargetPackagedElectronHelpers(appPath);
    assert.equal(inspected.applicationName, officialProductName);
    assert.equal(inspected.helpers[0].appName, "Grok Bot Helper.app");
    assert.equal(inspected.helpers[0].bundleId, `${diagnosticId}.helper`);
    assert.notEqual(inspected.helpers[0].bundleId, officialHelperBundleIds.helper);
    await assertPackagedElectronHelpers(appPath, { expectedParentBundleId: diagnosticId });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("packaged helper verification rejects leftover official helper identities", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "grok-bot-helpers-reject-"));
  try {
    const appPath = await writeFakeElectronApp(root, {
      appName: "Grok Bot 0.18 Reconstructed.app",
      parentBundleId: reconstructedBundleId,
      applicationName: reconstructedName,
    });
    await assert.rejects(
      () => assertPackagedElectronHelpers(appPath, { expectedParentBundleId: reconstructedBundleId }),
      /Missing Electron helper bundle/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
