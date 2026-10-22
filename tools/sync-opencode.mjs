// 同步 OpenCode：Go / Go Plus 订阅 + Zen 按量价
// 2026-10-22 起官方把文档 md 源移走了（raw mdx 全部 404），改为解析渲染页的 HTML 表格
//   https://opencode.ai/docs/go/   → 两张「Monthly limit」表（Go、Go Plus）
//   https://opencode.ai/docs/zen/  → 单价表（含免费模型）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC_GO = 'https://opencode.ai/docs/go';
const SRC_ZEN = 'https://opencode.ai/docs/zen';
const V = '2026-10-22';

const fetchHtml = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
};
const cellText = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
/** HTML → [{head:[], rows:[[]]}] */
function tablesFromHtml(html) {
  const chunks = html.split(/<table/i).slice(1).map((s) => '<table' + s.split(/<\/table>/i)[0]);
  return chunks.map((t) => {
    const trs = [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
    const rows = trs.map((r) => [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1])));
    return { head: rows[0] || [], rows: rows.slice(1) };
  });
}

/* ---- 文档里的模型名 → 本目录的 id（其余按 slug 规则自动生成） ---- */
const ALIAS = {
  'glm 5.3 flash': 'glm-5.3-flash', 'glm-5.3-flash': 'glm-5.3-flash',
  'glm 5.3': 'glm-5.3', 'glm-5.3': 'glm-5.3',
  'glm 5.2': 'glm-5.2', 'glm-5.2': 'glm-5.2',
  'kimi k3': 'kimi-k3', 'kimi-k3': 'kimi-k3',
  'kimi k2.7 code': 'kimi-k2.7-code', 'kimi-k2.7-code': 'kimi-k2.7-code',
  'kimi k2.6': 'kimi-k2.6', 'kimi-k2.6': 'kimi-k2.6',
  'minimax m3': 'minimax-m3', 'minimax-m3': 'minimax-m3',
  'minimax m2.7': 'minimax-m2.7', 'minimax-m2.7': 'minimax-m2.7',
  'minimax m2.5': 'minimax-m2.5',
  'mimo-v2.5': 'mimo-v2.5', 'mimo v2.5': 'mimo-v2.5',
  'mimo-v2.5-pro': 'mimo-v2.5-pro', 'mimo v2.5 pro': 'mimo-v2.5-pro',
  'mimo-v2.6-flash': 'mimo-v2.6-flash', 'mimo-v2.6-pro': 'mimo-v2.6-pro',
  'longcat-2.0': 'longcat-2.0', 'longcat 2.0': 'longcat-2.0',
  'muse spark 1.3 contributor': 'muse-spark-1.3-contributor',
  'muse spark 1.2 contributor': 'muse-spark-1.2-contributor',
  'qwen3.8 max': 'qwen3.8-max', 'qwen 3.8 max': 'qwen3.8-max',
  'qwen3.8 flash': 'qwen3.8-flash', 'qwen 3.8 flash': 'qwen3.8-flash',
  'qwen3.7 plus': 'qwen-3.7-plus', 'qwen 3.7 plus': 'qwen-3.7-plus',
  'qwen3.6 plus': 'qwen-3.6-plus',
  'deepseek v4.1 flash': 'deepseek-v4-1-flash', 'deepseek-v4.1-flash': 'deepseek-v4-1-flash',
  'deepseek v4 pro': 'deepseek-v4-pro', 'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek v4 flash': 'deepseek-v4-flash', 'deepseek-v4-flash': 'deepseek-v4-flash',
  'deepseek v4 flash vision exp': 'deepseek-v4-flash-vision-exp',
  hy3: 'hunyuan-hy3', 'tencent hy3': 'hunyuan-hy3',
  'hy4 preview': 'hunyuan-hy4-preview', 'tencent hy4 preview': 'hunyuan-hy4-preview',
  'grok 4.6': 'grok-4.6', 'grok-4.6': 'grok-4.6', 'grok 4.7': 'grok-4.7', 'grok-4.7': 'grok-4.7',
  'gpt 5.6 luna': 'gpt-5.6-luna', 'gpt-6-luna': 'gpt-6-luna', 'gpt 6 luna': 'gpt-6-luna',
  'claude haiku 5.5': 'claude-haiku-5-5', 'claude-haiku-5.5': 'claude-haiku-5-5',
  'claude opus 5.5': 'claude-opus-5-5', 'claude sonnet 5.5': 'claude-sonnet-5-5',
};
const slug = (name) =>
  name
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-]/g, '');
const idOf = (name) => ALIAS[name.trim().toLowerCase()] || slug(name);

const money = (s) => {
  if (!s) return null;
  const cleaned = s.replace(/~~[^~]*~~/g, ' ').trim();
  if (/free/i.test(cleaned)) return 0;
  const m = cleaned.match(/\$?\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
};

const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const pay = JSON.parse(await readFile(path.join(DATA, 'payment.json'), 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};
const addModel = (id, name) => {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor: '', note: '' });
};

/* ================= Go / Go Plus ================= */
const goTables = tablesFromHtml(await fetchHtml(SRC_GO)).filter((t) =>
  t.head.join(' ').toLowerCase().includes('monthly limit'),
);
if (!goTables.length) throw new Error('opencode go 页面没找到 Monthly limit 表');
console.log(`Go 页解析到 ${goTables.length} 张额度表（${goTables.map((t) => t.rows.length).join(' / ')} 行）`);

function buildModels(rows) {
  const models = {};
  let sum = 0;
  const seen = new Set();
  for (const r of rows) {
    const rawName = r[0];
    if (!rawName || /^model$/i.test(rawName)) continue;
    const base = rawName.replace(/\s*\((Off-Peak|Peak|≤[^)]*|>[^)]*)\)\s*$/i, '').trim();
    const id = idOf(base);
    const inp = money(r[1]),
      out = money(r[2]),
      cache = money(r[3]),
      limit = money(r[5]);
    if (inp == null || limit == null) continue;
    addModel(id, base);
    if (!models[id]) {
      models[id] = {
        u: { input: inp, cache: cache ?? inp, output: out },
        quotaOverride: limit,
        note: `官方单模型月额度 $${limit}`,
      };
      if (!seen.has(id)) {
        seen.add(id);
        sum += limit;
      }
    }
    if (/peak/i.test(rawName)) {
      models[id].u = { input: inp / 2, cache: (cache ?? inp) / 2, output: out / 2 };
      models[id].bands = [
        { id: 'base', label: '谷时', mult: 1 },
        { id: 'peak', label: '峰时', mult: 2 },
      ];
    }
  }
  return { models, sum };
}

const built = goTables.map((t) => buildModels(t.rows));
upsert(s.plans, {
  id: 'opencode-go',
  provider: 'OpenCode',
  name: 'Go',
  kind: 'points',
  currency: 'USD',
  quota: built[0].sum,
  quotaUnit: 'USD 额度/月（各模型独立）',
  period: '月',
  window: '5h·周·月',
  priceVariants: [{ id: 'list', label: '月付', amount: 10 }],
  tags: ['含 API 端点'],
  note: '额度按模型分别计算：5 小时 = 该模型月额度的 20%、周 = 50%、月 = 100%；用满某模型后它不可用（默认直接拒请求，控制台可开 Extra usage 用余额兜底）。',
  source: SRC_GO,
  verifiedAt: V,
  models: built[0].models,
});
if (built[1]) {
  upsert(s.plans, {
    id: 'opencode-go-plus',
    provider: 'OpenCode',
    name: 'Go Plus',
    kind: 'points',
    currency: 'USD',
    quota: built[1].sum,
    quotaUnit: 'USD 额度/月（各模型独立）',
    period: '月',
    window: '5h·周·月',
    priceVariants: [{ id: 'list', label: '月付', amount: 40 }],
    tags: ['含 API 端点'],
    note: '额度为 Go 档的 3–4 倍；窗口规则同 Go（5h = 月额度 20%、周 50%、月 100%）。一个工作区同时只能有 1 人订阅 Go 或 Go Plus。',
    source: SRC_GO,
    verifiedAt: V,
    models: built[1].models,
  });
}

/* ================= Zen 按量 ================= */
const zenTables = tablesFromHtml(await fetchHtml(SRC_ZEN));
const priceTable = zenTables.find((t) => {
  const h = t.head.join(' ').toLowerCase();
  return h.includes('model') && h.includes('input') && h.includes('output') && h.includes('cached read');
});
if (!priceTable) throw new Error('opencode zen 页面没找到单价表');
s.apiPrices = s.apiPrices.filter((a) => !String(a.id).startsWith('oczen-'));
let paid = 0;
let free = 0;
for (const r of priceTable.rows) {
  const name = r[0];
  if (!name || /^model$/i.test(name)) continue;
  const id = idOf(name.replace(/\s*\((?:≤|>)[^)]*\)\s*$/i, '').trim());
  const isFree = /free/i.test(r[1]);
  const inp = money(r[1]);
  const out = money(r[2]);
  const cache = money(r[3]);
  if (inp == null || out == null) continue;
  addModel(id, name.replace(/\s*\(.*?\)\s*$/, '').replace(/\s*Free$/i, ''));
  upsert(s.apiPrices, {
    id: `oczen-${id}`,
    provider: 'OpenCode Zen',
    modelId: id,
    band: isFree ? '免费' : '标准',
    currency: 'USD',
    in: inp,
    cache: cache ?? inp,
    out,
    free: isFree || undefined,
    note: isFree ? '官方标注限时免费（收集反馈用）' : null,
    source: SRC_ZEN,
    verifiedAt: V,
  });
  if (isFree) free++;
  else paid++;
}

/* ---- 支付方式 ---- */
const DOLLAR = String.fromCharCode(36);
pay.providers['OpenCode'] = {
  cn: true,
  methods: ['支付宝', '微信'],
  note:
    '支持支付宝与微信支付（官方 billing 文档列出 Card / Link / Alipay / UPI / WeChat Pay 五种；' +
    `手续费 4.6% + ${DOLLAR}0.31，旧 Zen 文档仍写 4.4% + ${DOLLAR}0.30，两处口径不一致）。不支持境内银联。` +
    'Go 超额后可由余额兜底（v2 中该项由「Use balance」更名为「Extra usage」）。',
};
pay.providers['OpenCode Zen'] = { ...pay.providers['OpenCode'] };

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
await writeFile(path.join(DATA, 'payment.json'), JSON.stringify(pay, null, 2), 'utf8');
console.log(`Go：${Object.keys(built[0].models).length} 个模型，池 $${built[0].sum}`);
if (built[1]) console.log(`Go Plus：${Object.keys(built[1].models).length} 个模型，池 $${built[1].sum}`);
console.log(`Zen：付费 ${paid} 条 + 免费 ${free} 条`);
console.log(`目录：模型 ${s.models.length}｜按量价 ${s.apiPrices.length}｜套餐 ${s.plans.length}`);
