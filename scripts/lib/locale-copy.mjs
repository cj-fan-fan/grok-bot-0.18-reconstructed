import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const localeTablePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../source/shared/locale/zh-CN.json",
);

export const DEFAULT_UI_LOCALE = "zh-CN";
export const ZH_CN_COPY = Object.freeze(JSON.parse(readFileSync(localeTablePath, "utf8")));

export function localeTableEntries(table = ZH_CN_COPY) {
  return Object.entries(table)
    .filter(([english, chinese]) => typeof english === "string" && typeof chinese === "string" && english.length > 0 && chinese.length > 0 && english !== chinese)
    .sort((left, right) => right[0].length - left[0].length || left[0].localeCompare(right[0]));
}

function quotedForms(value) {
  const forms = [JSON.stringify(value)];
  if (!/['\\\n\r]/.test(value)) forms.push(`'${value}'`);
  return forms;
}

export function applyLocaleMap(source, table = ZH_CN_COPY) {
  if (typeof source !== "string") throw new TypeError("applyLocaleMap requires a string source");
  let next = source;
  const hits = [];
  for (const [english, chinese] of localeTableEntries(table)) {
    let count = 0;
    const replacements = quotedForms(english).map((before, index) => ({
      before,
      after: index === 0 ? JSON.stringify(chinese) : `'${chinese.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`,
    }));
    for (const { before, after } of replacements) {
      if (before === after || !next.includes(before)) continue;
      const pieces = next.split(before);
      const occurrences = pieces.length - 1;
      if (occurrences === 0) continue;
      next = pieces.join(after);
      count += occurrences;
    }
    if (count > 0) hits.push({ english, chinese, count });
  }
  return {
    source: next,
    changed: next !== source,
    replacements: hits.reduce((sum, hit) => sum + hit.count, 0),
    hits,
  };
}

export function uiCopy(english, table = ZH_CN_COPY) {
  return table[english] ?? english;
}
