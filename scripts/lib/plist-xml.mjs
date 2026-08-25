import { readFile, writeFile } from "node:fs/promises";

import { capture } from "./process.mjs";
import { SYSTEM_TOOLS } from "./system-tools.mjs";

const BINARY_PLIST_MAGIC = "bplist00";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function unescapeXml(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function stringKeyPattern(key) {
  return new RegExp(`(<key>${escapeXml(key)}</key>\\s*<string>)([^<]*)(</string>)`);
}

export function isBinaryPlist(bytes) {
  return Buffer.isBuffer(bytes) && bytes.subarray(0, BINARY_PLIST_MAGIC.length).toString("utf8") === BINARY_PLIST_MAGIC;
}

export async function readPlistXml(filePath) {
  const bytes = await readFile(filePath);
  if (!isBinaryPlist(bytes)) return bytes.toString("utf8");
  return await capture(SYSTEM_TOOLS.plutil, ["-convert", "xml1", "-o", "-", filePath]);
}

export async function writePlistXml(filePath, xml) {
  await writeFile(filePath, xml);
}

export function getPlistString(xml, key) {
  const match = stringKeyPattern(key).exec(xml);
  return match == null ? null : unescapeXml(match[2]);
}

export function hasPlistKey(xml, key) {
  return new RegExp(`<key>${escapeXml(key)}</key>`).test(xml);
}

export function setPlistString(xml, key, value) {
  const pattern = stringKeyPattern(key);
  if (!pattern.test(xml)) {
    throw new Error(`Info.plist is missing ${key}`);
  }
  return xml.replace(pattern, `$1${escapeXml(value)}$3`);
}

export function removePlistKey(xml, key) {
  return xml.replace(
    new RegExp(`\\s*<key>${escapeXml(key)}</key>\\s*(?:<string>[^<]*</string>|<true\\s*/>|<false\\s*/>|<integer>-?\\d+</integer>)`, "g"),
    "",
  );
}
