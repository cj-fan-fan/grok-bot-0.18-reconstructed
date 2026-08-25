import { join } from "node:path";

import {
  resolveSandDataRootOverride,
  resolveSandUserDataDir,
  SAND_DATA_ROOT_ENV,
  SAND_USER_DATA_DIR_ENV,
} from "../../host/host-paths.js";
import {
  RECONSTRUCTED_PRODUCT_NAME,
  RECONSTRUCTED_USER_DATA_DIR_NAME,
} from "../../shared/reconstructed-identity.js";
import { applyStartupDataRootMigration, resolveExistingSandProductionRootDir, type DataRootSettlement } from "./startup-data-root-migration.js";

export const STRANDED_USER_DATA_REASONS = new Set([
  "canonical-marked",
  "canonical-unsafe",
  "conflict-preserved",
  "legacy-unsafe",
  "migration-failed",
]);

export const STRANDED_DATA_ROOT_REASONS = new Set([
  "canonical-conflict",
  "canonical-marked",
  "legacy-unsafe",
  "live-legacy-host",
  "migration-failed",
  "unknown-legacy-writer",
]);

export interface DesktopBootstrapApp {
  readonly isPackaged: boolean;
  setName?(name: string): void;
  setPath(name: "userData" | "sessionData", path: string): void;
  getPath(name: "appData" | "userData"): string;
}

export interface DesktopUserDataBootstrapOptions {
  readonly isLabBuild: boolean;
  readonly app: DesktopBootstrapApp;
  readonly argv?: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly cwd?: string;
  reportFailureClass?(surface: "startup", operation: "user-data-settlement", reason: string): void;
}

export function applyReconstructedDesktopIdentity(
  app: Pick<DesktopBootstrapApp, "setName" | "setPath" | "getPath">,
  userDataDir: string,
): string {
  app.setName?.(RECONSTRUCTED_PRODUCT_NAME);
  app.setPath("userData", userDataDir);
  app.setPath("sessionData", userDataDir);
  return userDataDir;
}

export function reconstructedDesktopUserDataDir(appDataDir: string): string {
  return join(appDataDir, RECONSTRUCTED_USER_DATA_DIR_NAME);
}

export function bootstrapDesktopUserData(options: DesktopUserDataBootstrapOptions): string | null {
  const argv = options.argv ?? process.argv;
  const env = options.env ?? process.env;
  const isolatedUserDataDir = resolveSandUserDataDir(argv, env, options.cwd ?? process.cwd())
    ?? reconstructedDesktopUserDataDir(options.app.getPath("appData"));
  env[SAND_USER_DATA_DIR_ENV] = isolatedUserDataDir;
  applyReconstructedDesktopIdentity(options.app, isolatedUserDataDir);
  console.log(`[sand] using isolated user-data dir: ${isolatedUserDataDir}`);
  return isolatedUserDataDir;
}

export interface DesktopDataRootBootstrapOptions {
  readonly isPrimaryInstance: boolean;
  readonly isLabBuild: boolean;
  readonly hasIsolatedUserData: boolean;
  readonly app: Pick<DesktopBootstrapApp, "isPackaged">;
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
  reportFailureClass?(surface: "startup", operation: "data-root-settlement", reason: string): void;
}

export function bootstrapDesktopDataRoot(options: DesktopDataRootBootstrapOptions): DataRootSettlement | null {
  if (!options.isPrimaryInstance) return null;
  const env = options.env ?? process.env;
  if (!options.app.isPackaged && env.SAND_ATTACH_PROD_BOX === "1"
    && !options.hasIsolatedUserData && resolveSandDataRootOverride(env) == null) {
    env[SAND_DATA_ROOT_ENV] = resolveExistingSandProductionRootDir(options.homeDir);
    return null;
  }
  const settlement = applyStartupDataRootMigration({
    isPackaged: options.app.isPackaged,
    isLabBuild: options.isLabBuild,
    hasIsolatedUserData: options.hasIsolatedUserData,
    env,
    ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
  });
  if (STRANDED_DATA_ROOT_REASONS.has(settlement.reason)) {
    options.reportFailureClass?.("startup", "data-root-settlement", settlement.reason);
  }
  return settlement;
}
