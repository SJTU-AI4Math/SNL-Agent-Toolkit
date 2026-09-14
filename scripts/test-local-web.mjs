#!/usr/bin/env node
// Real built CLI + public initialization + production browser. No simulated API payloads.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
const root = resolve(import.meta.dirname, '..');
const cli = process.env.SNL_TEST_CLI || join(root, 'dist/cli/snl.mjs');
const require = createRequire(import.meta.url);
assert(process.env.SNL_PLAYWRIGHT_PATH && process.env.SNL_CHROMIUM_PATH, 'Set SNL_PLAYWRIGHT_PATH and SNL_CHROMIUM_PATH for browser acceptance.');
const { chromium } = require(process.env.SNL_PLAYWRIGHT_PATH);
const out = process.env.SNL_WEB_EVIDENCE || mkdtempSync(join(tmpdir(), 'snl-local-web-'));
mkdirSync(out, { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), 'snl-web-workspace-'));
const command = (args) => {
  const p = spawnSync(process.execPath, [cli, ...args, '--root', workspace, '--json'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(p.status, 0, p.stderr || p.stdout); const r = JSON.parse(p.stdout); assert.equal(r.ok, true); return r.data;
};
const entry = (id, markdown) => ({ id, package: '_unpackaged', kind: 'entry', title: id, content: { markdown }, contribution_info: null, pointer: null });
const library = (slug, ids) => ({ slug, meta: { title: slug + ' library' }, graph: { nodes: ids.map((id,i) => ({ id: 'occurrence-' + i, label: 'Entry', props: { entryId: id } })), relationships: [] }, counters: { counters: [] } });
const followParagraphs = '\n\n' + Array.from({ length: 45 }, (_, i) => `Follow paragraph ${i}.`).join('\n\n');
const preset = { schema: 'snl.init-preset', version: 1, id: 'web-smoke', entries: [entry('Alpha', 'Alpha original body.\n\n![Probe](assets/probe.svg)' + followParagraphs), entry('Beta', 'Beta independent body.'), entry('Outside', 'Outside library but searchable.')], libraries: [library('Main', ['Alpha', 'Beta']), library('Other', ['Beta'])], relationships: [{ id: 'alpha-beta', from: 'Alpha', to: 'Beta', label: 'depends', metadata: { generator: 'macro-source-scan', isAtomic: true } }] };
const input = join(out, 'preset.json'); writeFileSync(input, JSON.stringify(preset)); command(['init', '--input', input]);
mkdirSync(join(workspace, '.SNL_Doc/assets')); writeFileSync(join(workspace, '.SNL_Doc/assets/probe.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="teal"/></svg>');
writeFileSync(join(workspace, '.env'), 'DO_NOT_SERVE_THIS_FILE');
const port = process.env.SNL_WEB_PORT || '4911';
// Deliberately use cwd, not --root: the defining bare-command behavior.
const args = port === '4911' ? [] : ['--port', port];
let child;
let stdout = '', stderr = '';
function startCli() {
  const running = spawn(process.env.SNL_TEST_BIN || process.execPath, process.env.SNL_TEST_BIN ? args : [cli, ...args], { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && !!process.env.SNL_TEST_BIN });
  child = running;
  let startup = '';
  running.stderr.on('data', x => stderr += x);
  return new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('Web CLI readiness timed out: ' + stdout + stderr)), 15000);
    running.stdout.on('data', x => { startup += x; stdout += x; if (startup.includes('Press Ctrl+C')) { clearTimeout(timeout); resolveReady(); } });
    running.once('error', error => { clearTimeout(timeout); reject(error); });
    running.once('exit', code => { clearTimeout(timeout); reject(new Error('Web CLI exited ' + code + ': ' + stdout + stderr)); });
  });
}
const readiness = startCli();
let browser;
const url = `http://127.0.0.1:${port}`;
const errors = [], requests = [], headers = [];
let expectedDisconnect = false;
async function checkHeader(page, route, singleRow = true) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const header = page.locator('.snl-panel-header:visible');
  assert.equal(await header.count(), 1, `${route}: require one visible shared PanelHeader`);
  const geometry = await header.evaluate(node => {
    const box = node.getBoundingClientRect();
    const groups = [...node.children].filter(n => n.getBoundingClientRect().width > 0).map(n => {
      const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, cy: r.y + r.height / 2 };
    });
    return { top: box.top, height: box.height, groups, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert(geometry.top <= 32 && geometry.top >= 0, `${route}: extra shell rows above PanelHeader: ${geometry.top}`);
  if (singleRow) assert(Math.max(...geometry.groups.map(g => g.cy)) - Math.min(...geometry.groups.map(g => g.cy)) <= 3, `${route}: header groups wrapped`);
  assert(geometry.scrollWidth <= geometry.width + 1, `${route}: document overflows horizontally`);
  headers.push({ route, ...geometry });
}

try {
  await readiness;
  const info = await (await fetch(url + '/__snl/api/workspace')).json();
  assert.equal(info.root, workspace); assert.equal(info.libraries.length, 2);
  assert.equal((await fetch(url + '/.env')).status, 404);
  browser = await chromium.launch({ executablePath: process.env.SNL_CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--renderer-process-limit=1'] });
  const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', message => { if (message.type() === 'error' && !(expectedDisconnect && /ERR_CONNECTION|Failed to load resource/.test(message.text()))) errors.push(message.text()); });
  page.on('requestfailed', r => { if (r.failure()?.errorText !== 'net::ERR_ABORTED' && !(expectedDisconnect && r.url().endsWith('/__snl/api/events'))) errors.push(`${r.url()}: ${r.failure()?.errorText}`); });
  page.on('request', r => requests.push(r.url()));
  await page.goto(url);
  await page.getByText(workspace, { exact: true }).waitFor();
  await checkHeader(page, 'workspace');
  assert.equal(await page.getByRole('table').count(), 1, 'Workspace must reuse the Dashboard Library table, not a plain link list');
  const libraryRow = title => page.getByRole('table').getByRole('row').filter({ has: page.getByText(title, { exact: true }) });
  assert.deepEqual(await page.getByRole('columnheader').allTextContents(), ['Title', 'Slug', 'Entries', 'Relationships']);
  for (const item of info.libraries) {
    assert.equal(typeof item.entryCount, 'number'); assert.equal(typeof item.relationshipCount, 'number');
    assert.deepEqual(await libraryRow(item.title).getByRole('cell').allTextContents(), [item.title, item.slug, String(item.entryCount), String(item.relationshipCount)]);
  }
  assert.equal(requests.filter(u => u.includes('/api/snapshot')).length, 0, 'Listing Libraries must not fetch all Library snapshots');
  assert.equal(await page.getByRole('button', { name: /create|delete|edit library/i }).count(), 0);
  await page.screenshot({ path: join(out, 'workspace-desktop.png') });
  // Real pointer and keyboard activation use the same shared Dashboard row primitive.
  await libraryRow('Other library').getByRole('cell').nth(1).click();
  await page.getByText('Beta independent body.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await libraryRow('Other library').getByRole('button').focus();
  await page.keyboard.press('Enter');
  await page.getByText('Beta independent body.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  const longTitle = 'A Library with a very long title — ' + 'UnbrokenTitle'.repeat(12);
  const other = command(['library', 'get', 'Other']).entity;
  other.value.meta.title = longTitle;
  const listUpdate = join(out, 'list-update.json'); writeFileSync(listUpdate, JSON.stringify(other.value));
  command(['library', 'update', 'Other', '--if-match', other.revision, '--input', listUpdate]);
  const beforeRefreshSnapshots = requests.filter(u => u.includes('/api/snapshot')).length;
  // Saving authoring files must update the open catalog without Refresh or navigation.
  await page.getByText(longTitle, { exact: true }).waitFor({ timeout: 8000 });
  assert.equal(requests.filter(u => u.includes('/api/snapshot')).length, beforeRefreshSnapshots);
  const addedLibrary = join(out, 'live-library.json'); writeFileSync(addedLibrary, JSON.stringify(library('Live', ['Beta'])));
  command(['library', 'create', '--input', addedLibrary]);
  await libraryRow('Live library').waitFor({ timeout: 8000 });
  const added = command(['library', 'get', 'Live']).entity;
  command(['library', 'delete', 'Live', '--if-match', added.revision]);
  await libraryRow('Live library').waitFor({ state: 'detached', timeout: 8000 });
  assert.equal(requests.filter(u => u.includes('/api/snapshot')).length, beforeRefreshSnapshots);
  await page.setViewportSize({ width: 360, height: 800 });
  await checkHeader(page, 'workspace-long-title-360');
  await page.screenshot({ path: join(out, 'workspace-mobile.png'), fullPage: true });
  const tableScroll = page.locator('.snl-libraries-table-scroll');
  const scrollGeometry = await tableScroll.evaluate(node => {
    node.scrollLeft = node.scrollWidth;
    return { left: node.scrollLeft, overflow: getComputedStyle(node).overflowX, width: node.clientWidth, content: node.scrollWidth };
  });
  assert(scrollGeometry.left > 0 && scrollGeometry.overflow === 'auto', 'Narrow table has an operable local horizontal scroll region');
  const regionBox = await tableScroll.boundingBox();
  const countBox = await page.getByRole('columnheader', { name: 'Relationships', exact: true }).boundingBox();
  assert(countBox.x >= regionBox.x - 1 && countBox.x + countBox.width <= regionBox.x + regionBox.width + 1, 'Scrolling reveals the last statistics column');
  await page.screenshot({ path: join(out, 'workspace-mobile-statistics.png'), fullPage: true });
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.getByRole('button', { name: /^Interface language:/ }).click();
  await page.getByRole('menuitemradio').filter({ hasText: '简体中文' }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  await checkHeader(page, 'workspace-dark-zh');
  assert.equal(await page.getByRole('columnheader', { name: '标题', exact: true }).count(), 1);
  await page.screenshot({ path: join(out, 'workspace-dark-zh.png') });
  await page.getByRole('button', { name: /^界面语言:/ }).click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await libraryRow('Main library').getByRole('button').focus();
  await page.keyboard.press('Space');
  await page.getByText('Alpha original body.', { exact: true }).waitFor();
  assert(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('library') === 'Main');
  await checkHeader(page, 'library');
  await page.screenshot({ path: join(out, 'reader-desktop.png') });
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.waitForFunction(() => document.documentElement.dataset.snlColorScheme === 'dark');
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await checkHeader(page, 'library-dark');
  await page.screenshot({ path: join(out, 'reader-dark.png') });
  await page.getByRole('button', { name: /^Interface language:/ }).click();
  await page.getByRole('menuitemradio').filter({ hasText: '简体中文' }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  await checkHeader(page, 'library-zh-dark');
  await page.getByRole('button', { name: /^界面语言:/ }).click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  const image = page.getByRole('img', { name: 'Probe' });
  await image.waitFor(); assert(await image.evaluate(n => n.complete && n.naturalWidth > 0));
  await page.getByRole('button', { name: 'SNoogL', exact: true }).click();
  const searchInput = page.getByPlaceholder(/Search entries/);
  await searchInput.waitFor();
  await checkHeader(page, 'search');
  const contrast = await searchInput.evaluate(node => {
    const style = getComputedStyle(node);
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const fg = luminance(style.color), bg = luminance(style.backgroundColor);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  const filtersContrast = await page.getByText('Filters', { exact: true }).evaluate(node => {
    const foreground = getComputedStyle(node).color;
    let parent = node, background = 'rgb(255, 255, 255)';
    while (parent) {
      const candidate = getComputedStyle(parent).backgroundColor;
      if (candidate !== 'transparent' && candidate !== 'rgba(0, 0, 0, 0)') { background = candidate; break; }
      parent = parent.parentElement;
    }
    const luminance = color => {
      const c = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    };
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert(filtersContrast >= 4.5, `Filter text contrast is unreadable: ${filtersContrast}`);
  assert(contrast >= 4.5, `Search text contrast is unreadable: ${contrast}`);
  await page.screenshot({ path: join(out, 'search.png'), fullPage: true });
  await searchInput.fill('Outside'); await searchInput.press('Enter');
  await page.getByRole('option').filter({ hasText: 'Outside' }).first().click();
  await page.getByText('Outside library but searchable.', { exact: true }).waitFor();
  await checkHeader(page, 'entry');
  await page.goBack(); await page.getByRole('combobox').first().waitFor();
  await page.getByRole('button', { name: /^(Relationship graph|View Graph)$/ }).click();
  await page.locator('svg g[role="button"]').first().waitFor();
  await checkHeader(page, 'graph');
  await page.screenshot({ path: join(out, 'graph.png'), fullPage: true });
  const snapshot = await (await fetch(url + '/__snl/api/snapshot?library=Main')).json();
  const macroName = Object.keys(snapshot.macros)[0]; assert(macroName, 'Public initialized fixture must contain an active Macro');
  await page.goto(url + '/#/macro/' + encodeURIComponent(macroName) + '?library=Main');
  await page.getByText('Source Entries', { exact: true }).waitFor();
  await checkHeader(page, 'macro');
  // Same occurrence id in a different Library must resolve to that Library's Entry.
  await page.goto(url + '/#/node/occurrence-0?library=Other');
  await page.getByText('Beta independent body.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Alpha original body.', { exact: true }).count(), 0);
  await page.goto(url + '/#/library?library=Main');
  await page.getByText('Alpha original body.', { exact: true }).waitFor();
  const readingUrl = page.url();
  const sibling = await page.context().newPage();
  sibling.on('pageerror', e => errors.push(String(e)));
  await sibling.goto(url + '/#/entry/Alpha?library=Main');
  await sibling.getByRole('main').getByText('Alpha original body.', { exact: true }).waitFor();
  const siblingUrl = sibling.url();
  writeFileSync(join(workspace, '.SNL_Doc/assets/probe.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40"><rect width="180" height="40" fill="purple"/></svg>');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('img[alt="Probe"]')).some(img => img.getClientRects().length && img.naturalWidth === 180), null, { timeout: 8000 });
  await sibling.waitForFunction(() => Array.from(document.querySelectorAll('img[alt="Probe"]')).some(img => img.getClientRects().length && img.naturalWidth === 180), null, { timeout: 8000 });
  const data = command(['entry', 'get', 'Alpha']).entity;
  data.value.content.markdown = 'Alpha refreshed body.\n\n![Probe](assets/probe.svg)' + followParagraphs;
  const scrollBeforeFollow = await page.evaluate(() => { window.scrollTo(0, 700); return window.scrollY; });
  assert(scrollBeforeFollow > 600, 'Reading-position control must actually be scrolled');
  const update = join(out, 'update.json'); writeFileSync(update, JSON.stringify(data.value));
  command(['entry', 'update', 'Alpha', '--if-match', data.revision, '--input', update]);
  await page.getByText('Alpha refreshed body.', { exact: true }).waitFor({ timeout: 8000 });
  await sibling.getByRole('main').getByText('Alpha refreshed body.', { exact: true }).waitFor({ timeout: 8000 });
  assert.equal(page.url(), readingUrl); assert.equal(sibling.url(), siblingUrl);
  await page.waitForFunction(expected => Math.abs(window.scrollY - expected) < 5, scrollBeforeFollow, { timeout: 8000 });
  await sibling.close();
  // Kill/restart the real owned server; recover an edit missed while disconnected.
  expectedDisconnect = true;
  const stopped = once(child, 'exit'); child.kill('SIGTERM'); await stopped;
  await page.getByRole('status').filter({ hasText: /auto.*(disconnect|unavailable|retry|reconnect)/i }).waitFor({ timeout: 8000 });
  await page.getByText('Alpha refreshed body.', { exact: true }).waitFor();
  const disconnected = command(['entry', 'get', 'Alpha']).entity;
  disconnected.value.title = 'Alpha after reconnect';
  const reconnectUpdate = join(out, 'reconnect-update.json'); writeFileSync(reconnectUpdate, JSON.stringify(disconnected.value));
  command(['entry', 'update', 'Alpha', '--if-match', disconnected.revision, '--input', reconnectUpdate]);
  await startCli();
  await page.getByText('Alpha after reconnect', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByRole('status').filter({ hasText: /auto.*(disconnect|unavailable|retry|reconnect)/i }).waitFor({ state: 'detached', timeout: 8000 });
  assert.equal(page.url(), readingUrl);
  expectedDisconnect = false;
  await page.screenshot({ path: join(out, 'auto-reconnected.png') });
  await page.setViewportSize({ width: 620, height: 800 });
  await checkHeader(page, 'library-620');
  await page.screenshot({ path: join(out, 'reader-narrow.png'), fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await checkHeader(page, 'library-360');
  await page.screenshot({ path: join(out, 'reader-mobile.png'), fullPage: true });
  const overflow = page.getByRole('button', { name: 'Panel actions', exact: true });
  await overflow.click();
  await page.getByRole('button', { name: 'SNoogL', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
  await page.waitForFunction(() => document.documentElement.dataset.snlColorScheme === 'dark');
  await page.getByRole('button', { name: 'Reading preferences', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await overflow.getAttribute('aria-expanded'), 'false');
  assert(await overflow.evaluate(node => node === document.activeElement), 'Escape restores overflow trigger focus');
  await overflow.click();
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/__snl/api/snapshot') && response.ok()),
    page.getByRole('button', { name: /Refresh this panel/ }).click()
  ]);
  await page.getByText('Alpha refreshed body.', { exact: true }).waitFor();
  await checkHeader(page, 'library-360-refreshed');
  assert.equal(await page.getByRole('button', { name: /^(Edit|Save)$/ }).count(), 0);
  assert.deepEqual(errors, []);
  assert(requests.every(u => u.startsWith(url) || u.startsWith('data:')), 'Startup/render requested external resources');
  writeFileSync(join(out, 'receipt.json'), JSON.stringify({ url, workspace, cli, cliSha256: createHash('sha256').update(readFileSync(cli)).digest('hex'), errors, requests, headers, stdout, automaticFollowing: { catalogSave: true, libraryCreateDelete: true, assetTabs: 2, contentTabs: 2, reconnectCatchup: true, readingUrl, siblingUrl, scrollBefore: scrollBeforeFollow }, ok: true }, null, 2));
  console.log('PASS local Web browser acceptance:', join(out, 'receipt.json'));
} catch (e) {
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  writeFileSync(join(out, 'failure.json'), JSON.stringify({ error: String(e), stdout, stderr, errors, requests }, null, 2)); throw e;
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
}
