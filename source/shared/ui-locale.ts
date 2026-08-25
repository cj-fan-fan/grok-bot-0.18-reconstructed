import zhCN from "./locale/zh-CN.json" with { type: "json" };

export const DEFAULT_UI_LOCALE = "zh-CN";
export const ZH_CN_COPY: Readonly<Record<string, string>> = zhCN;

export function uiCopy(english: string): string {
  return ZH_CN_COPY[english] ?? english;
}
