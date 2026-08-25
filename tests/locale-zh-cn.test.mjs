import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { applyLocaleMap, DEFAULT_UI_LOCALE, ZH_CN_COPY, uiCopy } from "../scripts/lib/locale-copy.mjs";
import {
  COMPONENT_SOURCE,
  REGISTRY_AFTER,
  REGISTRY_BEFORE,
  applyOriginalRendererRouterPatch,
  patchOriginalSettingsPanel,
  patchOriginalSettingsRegistry,
} from "../scripts/lib/router-renderer-patch.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PANEL_FIXTURE = 'function Sa(s){Q=x==="general"?a.jsx(Te,{children:a.jsx(Sa,{auth:t})}):null;Z=x==="usage"?a.jsx(Te,{children:a.jsx(Na,{})}):null;';

test("zh-CN locale table is a non-empty English-to-Chinese map", () => {
  const entries = Object.entries(ZH_CN_COPY);
  assert.equal(DEFAULT_UI_LOCALE, "zh-CN");
  assert.ok(entries.length > 80);
  for (const [english, chinese] of entries) {
    assert.equal(typeof english, "string");
    assert.equal(typeof chinese, "string");
    assert.ok(english.length > 0, "locale keys must be non-empty");
    assert.ok(chinese.length > 0, `empty translation for ${JSON.stringify(english)}`);
    assert.notEqual(english, chinese);
    assert.match(chinese, /[\u4e00-\u9fff]/, `translation for ${JSON.stringify(english)} must include Han characters`);
  }
});

test("quoted locale replacements rewrite UI copy and leave identifiers alone", () => {
  const source = 'const wDn=[{id:"general",label:"General"}];const keep=general;const action="Save";';
  const { source: localized, replacements } = applyLocaleMap(source);
  assert.ok(replacements >= 2);
  assert.match(localized, /id:"general"/);
  assert.match(localized, /label:"通用"/);
  assert.match(localized, /const keep=general;/);
  assert.match(localized, /"保存"/);
  assert.doesNotMatch(localized, /label:"General"/);
  assert.doesNotMatch(localized, /"Save"/);
});

test("Router settings patch localizes registry and injected panel copy", () => {
  const registry = applyLocaleMap(patchOriginalSettingsRegistry(REGISTRY_BEFORE)).source;
  assert.match(registry, /id:"general",label:"通用"/);
  assert.match(registry, /id:"router",label:"路由"/);
  assert.match(registry, /id:"usage",label:"用量与账单"/);
  assert.match(registry, /id:"beta",label:"更新"/);
  assert.doesNotMatch(registry, /label:"General"/);
  assert.doesNotMatch(registry, /label:"Router"/);
  assert.doesNotMatch(registry, /label:"Usage & Billing"/);
  assert.equal(REGISTRY_AFTER.includes('label:"Router"'), true);

  const injected = applyLocaleMap(COMPONENT_SOURCE).source;
  assert.match(injected, /使用本地 Docker 虚拟机/);
  assert.match(injected, /label:"服务商"/);
  assert.match(injected, /title:"路由"/);
  assert.match(injected, /title:"电脑"/);
  assert.match(injected, /"用量 · "/);
  assert.match(injected, /"已记录活动"/);
  assert.match(injected, /"请求次数"/);
  assert.match(injected, /"输入 token"/);
  assert.match(injected, /"上次使用"/);
  assert.doesNotMatch(injected, /Use local Docker VM/);
  assert.doesNotMatch(injected, /"Usage for "/);
  assert.doesNotMatch(injected, /"Tracked activity"/);

  const panel = applyLocaleMap(patchOriginalSettingsPanel(PANEL_FIXTURE)).source;
  assert.match(panel, /x==="router"\?a\.jsx\(RRouterPanel,\{\}\)/);
  assert.match(panel, /使用本地 Docker 虚拟机/);
});

test("renderer transform records zh-CN locale provenance for patched UI strings", async () => {
  const stageRoot = await mkdtemp(path.join(tmpdir(), "grok-bot-locale-"));
  try {
    const assetsRoot = path.join(stageRoot, "dist", "renderer", "assets");
    await mkdir(assetsRoot, { recursive: true });
    await writeFile(path.join(assetsRoot, "registry.js"), REGISTRY_BEFORE);
    await writeFile(path.join(assetsRoot, "panel.js"), PANEL_FIXTURE);
    await writeFile(path.join(assetsRoot, "chrome.js"), 'const labels={search:"Search",settings:"Settings",plugins:"Plugins"};');
    const record = await applyOriginalRendererRouterPatch({ stageRoot });
    assert.equal(record.locale, "zh-CN");
    assert.deepEqual(record.transformations, ["settings-registry", "router-panel", "usage-panel", "locale-zh-CN"]);
    assert.ok(record.features.includes("locale-zh-CN"));
    assert.ok(record.chunks.some((chunk) => chunk.role === "registry"));
    assert.ok(record.chunks.some((chunk) => chunk.role === "panel"));
    assert.ok(record.chunks.some((chunk) => chunk.role === "locale" && chunk.path.endsWith("chrome.js")));
    const registry = await readFile(path.join(assetsRoot, "registry.js"), "utf8");
    const panel = await readFile(path.join(assetsRoot, "panel.js"), "utf8");
    const chrome = await readFile(path.join(assetsRoot, "chrome.js"), "utf8");
    assert.match(registry, /label:"路由"/);
    assert.match(panel, /使用本地 Docker 虚拟机/);
    assert.match(chrome, /search:"搜索"/);
    assert.match(chrome, /settings:"设置"/);
    assert.match(chrome, /plugins:"插件"/);
    const provenance = JSON.parse(await readFile(path.join(stageRoot, "dist", "renderer-router-extension.json"), "utf8"));
    assert.equal(provenance.locale, "zh-CN");
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
});

test("native chrome copy helper returns Simplified Chinese", async () => {
  assert.equal(uiCopy("File"), "文件");
  assert.equal(uiCopy("Reload"), "重新加载");
  assert.equal(uiCopy("Help Center"), "帮助中心");
  assert.equal(uiCopy("Send Feedback"), "发送反馈");
  assert.equal(uiCopy("Use local Docker VM"), "使用本地 Docker 虚拟机");
  assert.equal(uiCopy("not a translated identifier"), "not a translated identifier");

  const menu = await readFile(path.join(repoRoot, "source/electron-main/application-menu.ts"), "utf8");
  assert.match(menu, /uiCopy\("File"\)/);
  assert.match(menu, /uiCopy\("Reload"\)/);
  assert.match(menu, /uiCopy\("Toggle Developer Tools"\)/);
  assert.match(menu, /uiCopy\("Help Center"\)/);
  assert.match(menu, /uiCopy\("Send Feedback"\)/);
});
