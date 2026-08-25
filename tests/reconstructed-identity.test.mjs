import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  assert.doesNotMatch(packager, /<string>sand<\/string>/);
  assert.doesNotMatch(packager, /<string>grokbot<\/string>/);

  const verifier = await readFile(path.join(repoRoot, "scripts", "verify.mjs"), "utf8");
  assert.match(verifier, /CFBundleName/);
  assert.match(verifier, /reconstructedUrlScheme/);
  assert.match(verifier, /official URL scheme/);

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
