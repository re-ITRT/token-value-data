// 12 小时更新任务：刷新汇率 + 对官方来源页做变化检测 + 记录诊断信息（供后台页展示）
// 用法： node updater.mjs        (手动跑一次)
//        import { runUpdate } from './updater.mjs'   (server 内定时调用)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const SOURCES_FILE = path.join(DATA_DIR, 'sources.json');
const FX_FILE = path.join(DATA_DIR, 'fx.json');
const HASH_FILE = path.join(DATA_DIR, 'hashes.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const BUNDLE_FILE = path.join(DATA_DIR, 'bundle.json');
const PAYMENT_FILE = path.join(DATA_DIR, 'payment.json');

export const UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 小时
const HISTORY_KEEP = 30;

const FX_ENDPOINTS = [
  { name: 'open.er-api.com', url: 'https://open.er-api.com/v6/latest/USD', pick: (j) => j?.rates?.CNY },
  { name: 'frankfurter.dev', url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY', pick: (j) => j?.rates?.CNY },
  { name: 'exchangerate-api', url: 'https://api.exchangerate-api.com/v4/latest/USD', pick: (j) => j?.rates?.CNY },
];

const CHANGE_THRESHOLD = 0.02; // 2% 以上的内容差异才算「变了」
const MIN_SHINGLES = 12;
const SHELL_MIN_CHARS = 300; // 归一化后太短 = JS 空壳

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

async function fetchWithTimeout(url, { timeout = 20000, headers = {} } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...headers,
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 汇率 ---------------- */
export async function updateFx() {
  const previous = await readJson(FX_FILE, null);
  const attempts = [];
  for (const ep of FX_ENDPOINTS) {
    const started = Date.now();
    try {
      const { ok, status, text } = await fetchWithTimeout(ep.url, { timeout: 15000 });
      if (!ok) {
        attempts.push({ endpoint: ep.name, url: ep.url, ok: false, error: `HTTP ${status}`, ms: Date.now() - started });
        continue;
      }
      const rate = Number(ep.pick(JSON.parse(text)));
      if (!Number.isFinite(rate) || rate < 3 || rate > 12) {
        attempts.push({ endpoint: ep.name, url: ep.url, ok: false, error: `异常汇率 ${rate}`, ms: Date.now() - started });
        continue;
      }
      attempts.push({ endpoint: ep.name, url: ep.url, ok: true, rate, ms: Date.now() - started });
      const out = { USDCNY: rate, source: ep.name, fetchedAt: new Date().toISOString(), stale: false, attempts };
      await writeJson(FX_FILE, out);
      return out;
    } catch (err) {
      attempts.push({ endpoint: ep.name, url: ep.url, ok: false, error: formatError(err), ms: Date.now() - started });
    }
  }
  const failed = attempts.map((a) => `${a.endpoint}: ${a.error}`).join('；');
  if (previous) {
    const out = { ...previous, stale: true, attempts, lastError: `全部汇率源失败 → ${failed}` };
    await writeJson(FX_FILE, out);
    return out;
  }
  const fallback = {
    USDCNY: 7.1,
    source: '内置兜底值',
    fetchedAt: new Date().toISOString(),
    stale: true,
    attempts,
    lastError: `全部汇率源失败 → ${failed}`,
  };
  await writeJson(FX_FILE, fallback);
  return fallback;
}

/* ---------------- JS 渲染页兜底：借本地浏览器取渲染后的正文 ---------------- */
// 用 cmd.exe /c 调用，避免 shell:true 的参数拼接告警
function runOpencli(args, timeout, session) {
  return execFileAsync('cmd.exe', ['/c', 'opencli', 'browser', session, ...args], {
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
}

// 浏览器只有一个「当前标签」，多个页面并行 open/extract 会互相覆盖正文。
// 用一把串行锁 + 每个 URL 独立 session，保证拿到的是自己那页的内容。
let browserQueue = Promise.resolve();
function withBrowserLock(fn) {
  const next = browserQueue.then(fn, fn);
  browserQueue = next.then(
    () => {},
    () => {},
  );
  return next;
}

async function fetchViaBrowserOnce(url, session) {
  await runOpencli(['open', url], 60000, session);
  const extract = async () => {
    const { stdout } = await runOpencli(['extract', '--chunk-size', '200000'], 90000, session);
    const s = stdout.indexOf('{');
    const e = stdout.lastIndexOf('}');
    if (s < 0 || e <= s) throw new Error('浏览器返回无法解析');
    const parsed = JSON.parse(stdout.slice(s, e + 1));
    return parsed?.content || '';
  };

  // 这些厂商站多是重 JS 渲染，5 秒常常只拿到空壳；先等 12 秒，空则再等 8 秒重试一次
  await new Promise((r) => setTimeout(r, 12000));
  let content = await extract();
  if (!content.trim()) {
    await new Promise((r) => setTimeout(r, 8000));
    content = await extract();
  }
  try {
    await runOpencli(['close'], 20000, session);
  } catch {}
  if (!content.trim()) throw new Error('等待 20 秒后浏览器仍取不到正文');
  return content;
}

function fetchViaBrowser(url) {
  const session = 'upd' + createHash('sha1').update(url).digest('hex').slice(0, 6);
  return withBrowserLock(() => fetchViaBrowserOnce(url, session));
}

/* CI（GitHub Actions）没有本地浏览器桥，改用 Playwright 渲染；本地默认走 opencli。
   用 TV_BROWSER=opencli|playwright|auto 控制（默认 auto：先 opencli，失败再 playwright）。 */
async function fetchViaPlaywright(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: 'zh-CN' });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    return await page.innerText('body');
  } finally {
    await browser.close();
  }
}

const BROWSER_MODE = process.env.TV_BROWSER || 'auto';
async function fetchViaBrowserAuto(url) {
  const errors = [];
  if (BROWSER_MODE !== 'playwright') {
    try {
      return await fetchViaBrowser(url);
    } catch (err) {
      errors.push(`opencli: ${err.message}`);
      if (BROWSER_MODE === 'opencli') throw err;
    }
  }
  try {
    return await fetchViaPlaywright(url);
  } catch (err) {
    errors.push(`playwright: ${err.message}`);
  }
  throw new Error(errors.join(' | ') || '没有可用的浏览器后端');
}

// 把 Node fetch 的裸错误展开成人能看懂的原因（ENOTFOUND / 证书错误 / 超时…）
function formatError(err) {
  const cause = err?.cause;
  const code = cause?.code || err?.code;
  const detail = cause?.message && cause.message !== err.message ? ` — ${cause.message}` : '';
  return `${err?.message || '未知错误'}${code ? ` (${code})` : ''}${detail}`;
}

/* ---------------- 变化检测 ---------------- */
function collectSourceUrls(sources) {
  const urls = new Set();
  for (const p of sources.plans || []) if (p.source) urls.add(p.source);
  for (const a of sources.apiPrices || []) if (a.source) urls.add(a.source);
  return [...urls];
}

// 去掉 HTML 骨架与「每次请求都会变」的动态串（nonce / uuid / 时间戳 / 长 ID），
// 否则同一页面两次抓取字节数相同、哈希却不同，全是误报。
function normalizeHtml(raw) {
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&[a-z#0-9]{2,8};/gi, ' ');
  // 控制台外壳会带账号态（余额、未读数、待办数、活动倒计时），每轮都不一样，先整行丢掉
  const kept = stripped
    .split('\n')
    .filter((l) => !/(可用余额|积分余额|未读消息|待支付|待续费|待处理工单|账号ID|主账号|退出登录|我的收藏|复制全文|下载 pdf|费用中心|权限与安全|开发者与工具|业务与支持|待办事项)/.test(l))
    .join('\n');
  return kept
    .replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?)?/g, ' <DATE> ')
    .replace(/\d{2}:\d{2}(:\d{2})?/g, ' <TIME> ')
    .replace(/剩余\s*\d+\s*(天|小时|分钟)/g, ' <COUNTDOWN> ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ' <UUID> ')
    .replace(/\b[A-Za-z0-9+/_=-]{24,}\b/g, ' <TOKEN> ')
    .replace(/\b\d{8,}\b/g, ' <NUM> ')
    .replace(/\s+/g, ' ')
    .trim();
}
function shingles(text) {
  const out = new Set();
  const size = 200;
  const stride = 100;
  for (let i = 0; i + size <= text.length && out.size < 4000; i += stride) {
    out.add(createHash('sha1').update(text.slice(i, i + size)).digest('hex').slice(0, 12));
  }
  if (!out.size && text) out.add(createHash('sha1').update(text).digest('hex').slice(0, 12));
  return [...out];
}

function diffRatio(prevShingles, nextShingles) {
  if (!prevShingles?.length) return 1;
  const prev = new Set(prevShingles);
  let added = 0;
  for (const s of nextShingles) if (!prev.has(s)) added += 1;
  return nextShingles.length ? added / nextShingles.length : 0;
}

/* 固定位置分片对「开头插几个字」太敏感：整段错位会让差异率冲到 100%，全是误报。
   价格页真正要盯的是「数字」——所以改成两路信号：
     1) 数字集合（价格、额度、系数…）：任何一处数字变化都算变动，灵敏度最高
     2) 行集合：结构性改动用它兜底，阈值放宽到 4%（插入一行只影响 0.3%）           */
function signals(text) {
  const numbers = [...new Set((text.match(/[$¥￥]?\d[\d,]*(?:\.\d+)?/g) || []).map((x) => x.replace(/[,$¥￥]/g, '')))].sort();
  const lines = new Set();
  for (const raw of text.split(/[。；;\n]+/)) {
    const line = raw.trim();
    if (line.length >= 12) lines.add(createHash('sha1').update(line).digest('hex').slice(0, 12));
  }
  return { numbers, lines: [...lines] };
}

function numbersDiff(prevNumbers, nextNumbers) {
  const prev = new Set(prevNumbers || []);
  const added = nextNumbers.filter((x) => !prev.has(x));
  const removed = (prevNumbers || []).filter((x) => !nextNumbers.includes(x));
  return { added: added.slice(0, 8), removed: removed.slice(0, 8), changed: added.length + removed.length };
}

function linesDiffRatio(prevLines, nextLines) {
  if (!prevLines?.length) return 1;
  const prev = new Set(prevLines);
  let added = 0;
  for (const s of nextLines) if (!prev.has(s)) added += 1;
  return nextLines.length ? added / nextLines.length : 0;
}

export async function checkSources() {
  const sources = await readJson(SOURCES_FILE, { plans: [], apiPrices: [] });
  const hashes = await readJson(HASH_FILE, {});
  const urls = collectSourceUrls(sources);
  const results = [];
  let changed = 0;
  let unreachable = 0;
  let flaky = 0;
  let shell = 0;

  await Promise.all(
    urls.map(async (url) => {
      const prev = hashes[url];
      const started = Date.now();
      try {
        // 已经确认是 JS 空壳的页面，之后每次都走浏览器，保证与基线同源可比
        const preferBrowser = prev?.mode === 'browser';
        let normalized = '';
        let httpStatus = null;
        let viaBrowser = false;

        if (!preferBrowser) {
          const { ok, status, text } = await fetchWithTimeout(url, { timeout: 25000 });
          httpStatus = status;
          if (!ok) {
            unreachable += 1;
            results.push({ url, state: 'unreachable', httpStatus: status, error: `HTTP ${status}`, ms: Date.now() - started });
            return;
          }
          normalized = normalizeHtml(text);
        }

        if (preferBrowser || normalized.length < SHELL_MIN_CHARS) {
          try {
            normalized = normalizeHtml(await fetchViaBrowserAuto(url));
            viaBrowser = normalized.length >= SHELL_MIN_CHARS;
            if (!viaBrowser) throw new Error('浏览器渲染后正文仍然过短');
          } catch (err) {
            shell += 1;
            results.push({
              url,
              state: 'shell',
              httpStatus,
              bytes: normalized.length,
              ms: Date.now() - started,
              error: `原始抓取只有 ${normalized.length} 字符（JS 空壳），浏览器兜底失败：${formatError(err)}`,
              lastGoodAt: prev?.lastGoodAt ?? null,
              checkedAt: new Date().toISOString(),
            });
            return;
          }
        }

        const next = shingles(normalized);
        const sig = signals(normalized);
        const numDiff = prev ? numbersDiff(prev.numbers, sig.numbers) : { changed: 0, added: [], removed: [] };
        const lineRatio = prev ? linesDiffRatio(prev.lines, sig.lines) : 1;
        // 信号 1：数字集合有任何增删 → 直接判为变动（价格页最灵敏的信号）
        // 信号 2：行集合差异超过 4% → 结构性改动
        const ratio = numDiff.changed > 0 ? 1 : lineRatio;
        const prevBytes = prev?.bytes ?? 0;
        const sizeJump =
          prevBytes > 0 && normalized.length > 0
            ? Math.max(prevBytes, normalized.length) / Math.min(prevBytes, normalized.length)
            : 1;

        // 判定顺序：数字变了 → changed（最高优先级）；行差异超阈值 → changed；抓到的渲染形态突变 → flaky
        const LINE_THRESHOLD = 0.04;
        // 只「消失数字」且页面明显缩水 → 多半是这次只渲染出一部分（文档站常见），标为噪声
        const partialRender = numDiff.changed > 0 && numDiff.added.length === 0 && prevBytes > 0 && normalized.length < prevBytes * 0.8;
        let state;
        if (!prev) state = 'baseline';
        else if (partialRender) state = 'flaky';
        else if (numDiff.changed > 0) state = 'changed';
        else if (sizeJump > 4 && lineRatio > LINE_THRESHOLD) state = 'flaky';
        else if (lineRatio > LINE_THRESHOLD) state = 'changed';
        else state = 'unchanged';

        if (state === 'changed') changed += 1;
        if (state === 'flaky') flaky += 1;

        hashes[url] = {
          shingles: next,
          numbers: sig.numbers,
          lines: sig.lines,
          hash: createHash('sha256').update(normalized).digest('hex').slice(0, 16),
          bytes: normalized.length,
          shingleCount: next.length,
          mode: viaBrowser ? 'browser' : 'http',
          checkedAt: new Date().toISOString(),
          lastGoodAt: new Date().toISOString(),
        };
        results.push({
          url,
          state,
          httpStatus,
          bytes: normalized.length,
          previousBytes: prev?.bytes ?? null,
          diffRatio: Number(lineRatio.toFixed(4)),
          numChanged: numDiff.changed,
          numAdded: numDiff.added,
          numRemoved: numDiff.removed,
          viaBrowser,
          ms: Date.now() - started,
          checkedAt: hashes[url].checkedAt,
          lastGoodAt: hashes[url].lastGoodAt,
        });
      } catch (err) {
        unreachable += 1;
        results.push({
          url,
          state: 'unreachable',
          error: formatError(err),
          ms: Date.now() - started,
          checkedAt: new Date().toISOString(),
          lastGoodAt: prev?.lastGoodAt ?? null,
        });
      }
    }),
  );

  results.sort((a, b) => a.url.localeCompare(b.url));
  await writeJson(HASH_FILE, hashes);
  return { total: urls.length, changed, unreachable, flaky, shell, results };
}

/* ---------------- 运行历史 ---------------- */
async function appendHistory(entry) {
  const history = await readJson(HISTORY_FILE, []);
  history.unshift(entry);
  await writeJson(HISTORY_FILE, history.slice(0, HISTORY_KEEP));
}

/* ---------------- 主流程 ---------------- */
export async function runUpdate(trigger = 'manual') {
  const startedAt = new Date();
  const [fx, sourceCheck] = await Promise.all([updateFx(), checkSources()]);

  const problems = sourceCheck.results.filter((r) => !['unchanged', 'baseline'].includes(r.state));
  const state = {
    trigger,
    generatedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    nextRunAt: new Date(startedAt.getTime() + UPDATE_INTERVAL_MS).toISOString(),
    fx,
    sourceCheck: {
      total: sourceCheck.total,
      changed: sourceCheck.changed,
      unreachable: sourceCheck.unreachable,
      flaky: sourceCheck.flaky,
      shell: sourceCheck.shell,
      problems: problems.length,
      details: sourceCheck.results,
    },
  };
  await writeJson(STATE_FILE, state);
  // 前端只读这一个文件：sources + state + fx + history 打包
  const sources = await readJson(SOURCES_FILE, { models: [], apiPrices: [], plans: [] });
  const history = await readJson(HISTORY_FILE, []);
  const payments = await readJson(PAYMENT_FILE, { providers: {} });
  await writeJson(BUNDLE_FILE, {
    generatedAt: state.finishedAt,
    nextRunAt: state.nextRunAt,
    intervalMs: UPDATE_INTERVAL_MS,
    fx,
    state,
    sources,
    history,
    payments: payments.providers || {},
  });
  await appendHistory({
    at: state.finishedAt,
    trigger,
    durationMs: state.durationMs,
    fx: { USDCNY: fx.USDCNY, source: fx.source, stale: !!fx.stale, error: fx.lastError ?? null },
    counts: {
      total: sourceCheck.total,
      changed: sourceCheck.changed,
      flaky: sourceCheck.flaky,
      shell: sourceCheck.shell,
      unreachable: sourceCheck.unreachable,
    },
    problems: problems.map((p) => ({ url: p.url, state: p.state, error: p.error ?? null, httpStatus: p.httpStatus ?? null })),
  });
  return state;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const state = await runUpdate('cli');
  console.log(`[update] 完成于 ${state.finishedAt}（耗时 ${state.durationMs}ms）`);
  console.log(`[update] USD/CNY = ${state.fx.USDCNY} (${state.fx.source}${state.fx.stale ? ', 已过期' : ''})`);
  if (state.fx.lastError) console.log(`[update] 汇率错误: ${state.fx.lastError}`);
  console.log(
    `[update] 来源页 ${state.sourceCheck.total} 个：变化 ${state.sourceCheck.changed}，不可监控 ${state.sourceCheck.shell}，疑似噪声 ${state.sourceCheck.flaky}，不可达 ${state.sourceCheck.unreachable}`,
  );
  for (const p of state.sourceCheck.details.filter((d) => !['unchanged', 'baseline'].includes(d.state))) {
    console.log(`   ! ${p.state.padEnd(11)} ${p.url}${p.error ? ' — ' + p.error : ''}`);
  }
  console.log(`[update] 下次：${state.nextRunAt}`);
}
