// 同步 OpenCode：Go 订阅（$10/月，按模型的月度额度 + 5h/周/月窗口）与 Zen 按量价（含免费模型）
// 数据源：官方文档在 GitHub 上的源文件（比渲染后的页面更可靠、可重复抓）
//   https://raw.githubusercontent.com/sst/opencode/dev/packages/web/src/content/docs/go.mdx
//   https://raw.githubusercontent.com/sst/opencode/dev/packages/web/src/content/docs/zen.mdx
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC_GO = 'https://opencode.ai/docs/go';
const SRC_ZEN = 'https://opencode.ai/docs/zen';
const RAW = 'https://raw.githubusercontent.com/sst/opencode/dev/packages/web/src/content/docs';
const V = '2026-09-19';

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 tv-deploy' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
};

/* ---- 文档里的模型名 → 本目录的 id（其余按 slug 规则自动生成） ---- */
const ALIAS = {
  'glm 5.3 flash': 'glm-5.3-flash',
  'glm 5.3': 'glm-5.3',
  'glm 5.2': 'glm-5.2',
  'glm 5.1': 'glm-5.1',
  'glm 5': 'glm-5',
  'kimi k3': 'kimi-k3',
  'kimi k2.7 code': 'kimi-k2.7-code',
  'kimi k2.6': 'kimi-k2.6',
  'kimi k2.5': 'kimi-k2.5',
  'minimax m3': 'minimax-m3',
  'minimax m2.7': 'minimax-m2.7',
  'minimax m2.5': 'minimax-m2.5',
  'mimo v2.5': 'mimo-v2.5',
  'mimo v2.5 pro': 'mimo-v2.5-pro',
  'mimo-v2.5 free': 'mimo-v2.5',
  'longcat-2.0': 'longcat-2.0',
  'muse spark 1.3': 'muse-spark-1.3',
  'muse spark 1.2': 'muse-spark-1.2',
  'muse spark 1.1': 'muse-spark-1.1',
  'muse spark 1.3 contributor': 'muse-spark-1.3-contributor',
  'muse spark 1.2 contributor': 'muse-spark-1.2-contributor',
  'muse spark 1.3 contributor free': 'muse-spark-1.3-contributor',
  'qwen3.8 max': 'qwen3.8-max',
  'qwen3.8 flash': 'qwen3.8-flash',
  'qwen3.8 27b': 'qwen3.8-27b',
  'qwen3.7 max': 'qwen-3.7-max',
  'qwen3.7 plus': 'qwen-3.7-plus',
  'qwen3.7 flash': 'qwen-3.7-flash',
  'qwen3.6 plus': 'qwen-3.6-plus',
  'qwen3.6 max': 'qwen-3.6-max',
  'deepseek v4.1 flash': 'deepseek-v4-1-flash',
  'deepseek v4 pro': 'deepseek-v4-pro',
  'deepseek v4 flash': 'deepseek-v4-flash',
  'deepseek v4 flash vision exp': 'deepseek-v4-flash-vision-exp',
  'hy3': 'hunyuan-hy3',
  'hy4 preview': 'hunyuan-hy4-preview',
  'claude fable 5.1': 'claude-fable-5-1',
  'claude fable 5': 'claude-fable-5',
  'claude opus 5': 'claude-opus-5',
  'claude opus 4.8': 'claude-opus-4-8',
  'claude opus 4.7': 'claude-opus-4-7',
  'claude opus 4.6': 'claude-opus-4-6',
  'claude opus 4.5': 'claude-opus-4-5',
  'claude sonnet 5': 'claude-sonnet-5',
  'claude sonnet 4.6': 'claude-sonnet-4-6',
  'claude sonnet 4.5': 'claude-sonnet-4-5',
  'claude haiku 4.5': 'claude-haiku-4-5',
  'gpt 6 astra': 'gpt-6-astra',
  'gpt 5.6 sol': 'gpt-5.6-sol',
  'gpt 5.6 terra': 'gpt-5.6-terra',
  'gpt 5.6 luna': 'gpt-5.6-luna',
  'gemini 3.8 flash': 'gemini-3.8-flash',
  'gemini 3.7 flash': 'gemini-3.7-flash',
  'gemini 3.6 flash': 'gemini-3.6-flash',
  'gemini 3.5 flash': 'gemini-3.5-flash',
  'gemini 3.5 flash lite': 'gemini-3.5-flash-lite',
  'gemini 3.1 pro': 'gemini-3.1-pro',
  'gemini 3 flash': 'gemini-3-flash',
  'grok 4.6': 'grok-4.6',
  'grok 4.5': 'grok-4.5',
  'nemotron 3 ultra': 'nemotron-3-ultra',
  'nemotron 3 ultra free': 'nemotron-3-ultra',
};
const slug = (name) =>
  name
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-]/g, '');
const idOf = (name) => ALIAS[name.trim().toLowerCase()] || slug(name);

/* ---- 解析 markdown 表格 ---- */
function parseTable(text, requiredHeaderBits, afterIndex = 0) {
  const lines = text.split('\n').slice(afterIndex);
  // 必须按「表头包含哪些列」来定位表格——文档里有多张以 | Model 开头的表（端点表、定价表、额度表）
  const start = lines.findIndex((l) => {
    const low = l.trim().toLowerCase();
    return low.startsWith('|') && requiredHeaderBits.every((b) => low.includes(b));
  });
  if (start < 0) return [];
  const rows = [];
  for (let i = start + 2; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('|')) break;
    const cells = t.split('|').slice(1, -1).map((c) => c.replace(/\*\*/g, '').trim());
    if (cells.length >= 4) rows.push(cells);
  }
  return rows;
}
const money = (s) => {
  if (!s) return null;
  // 官方用 ~~$15~~ **$60** 表示「划线原价 → 当前促销价」：先丢掉删除线部分，再取数字
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
const addModel = (id, name, vendor, note) => {
  const m = s.models.find((x) => x.id === id);
  if (m) { m.name = m.name || name; return; }
  s.models.push({ id, name, vendor, note: note || '' });
};

/* ================= Go / Go Plus 订阅 ================= */
const goText = await fetchText(`${RAW}/go.mdx`);
// 文档里 Go 与 Go Plus 各有一张「模型 / 单价 / 月额度」表（后者在 <TabItem label="Go Plus"> 之后）
const plusAt = goText.indexOf('label="Go Plus"');
const plusLine = plusAt > 0 ? goText.slice(0, plusAt).split('\n').length - 1 : 0;
const goRows = parseTable(goText, ['| model', 'monthly limit']);
const plusRows = plusLine > 0 ? parseTable(goText, ['| model', 'monthly limit'], plusLine) : [];

function buildPlanModels(rows) {
  const models = {};
  let sum = 0;
  const seen = new Set();
  for (const r of rows) {
    const rawName = r[0];
    const baseName = rawName.replace(/\s*\((Off-Peak|Peak|≤[^)]*|>[^)]*)\)\s*$/i, '').trim();
    const id = idOf(baseName);
    const inp = money(r[1]), out = money(r[2]), cache = money(r[3]), limit = money(r[5]);
    if (inp == null || limit == null) continue;
    addModel(id, baseName, r[0].split(' ')[0], '');
    const u = { input: inp, cache: cache ?? inp, output: out };
    const tier = /≤|>/.test(rawName) ? rawName.match(/\(([^)]*)\)/)?.[1] : null;
    if (!models[id]) {
      models[id] = { u, quotaOverride: limit, note: `官方单模型月额度 $${limit}${tier ? `（按输入长度分档，这里取 ${tier} 档）` : ''}` };
      if (!seen.has(id)) { seen.add(id); sum += limit; }
    }
    if (/peak/i.test(rawName)) {
      // DeepSeek 系：文档给了峰/谷两行，转成时段带
      models[id].u = { input: inp / 2, cache: (cache ?? inp) / 2, output: out / 2 }; // 谷时价
      models[id].bands = [
        { id: 'base', label: '谷时', mult: 1 },
        { id: 'peak', label: '峰时', mult: 2 },
      ];
    }
  }
  return { models, sum };
}

const goBuilt = buildPlanModels(goRows);
const goModels = goBuilt.models;
const limitSum = goBuilt.sum;

upsert(s.plans, {
  id: 'opencode-go',
  provider: 'OpenCode',
  name: 'Go',
  kind: 'points',
  currency: 'USD',
  quota: limitSum,
  quotaUnit: 'USD 额度/月（各模型独立）',
  period: '月',
  window: '5h·周·月',
  priceVariants: [{ id: 'list', label: '月付', amount: 10 }],
  tags: ['含 API 端点'],
  note: '额度按模型分别计算：5 小时 = 该模型月额度的 20%、周 = 50%、月 = 100%；用满某模型后它不可用（默认直接拒请求，控制台可开 Extra usage 用余额兜底）。',
  source: SRC_GO,
  verifiedAt: V,
  models: goModels,
});

// Go Plus：$40/月，额度普遍是 Go 档的 3–4 倍（2026-09 新增档）
if (plusRows.length) {
  const plusBuilt = buildPlanModels(plusRows);
  upsert(s.plans, {
    id: 'opencode-go-plus',
    provider: 'OpenCode',
    name: 'Go Plus',
    kind: 'points',
    currency: 'USD',
    quota: plusBuilt.sum,
    quotaUnit: 'USD 额度/月（各模型独立）',
    period: '月',
    window: '5h·周·月',
    priceVariants: [{ id: 'list', label: '月付', amount: 40 }],
    tags: ['含 API 端点'],
    note: '2026-09 新增档：额度为 Go 档的 3–4 倍（如 GLM-5.3 $15→$120、GLM-5.3-Flash $60→$180、Kimi K2.6 $60→$240）；窗口规则同 Go（5h=月额度 20%、周=50%、月=100%）。一个工作区同时只能有 1 人订阅 Go 或 Go Plus。',
    source: SRC_GO,
    verifiedAt: V,
    models: plusBuilt.models,
  });
}

/* ================= Zen 按量 ================= */
const zenText = await fetchText(`${RAW}/zen.mdx`);
const zenRows = parseTable(zenText, ['| model', 'input', 'cached read']);
// 先清掉本脚本上次生成的条目，避免官方下架模型后留下僵尸行
s.apiPrices = s.apiPrices.filter((a) => !String(a.id).startsWith('oczen-'));
let zenPaid = 0, zenFree = 0;
for (const r of zenRows) {
  const name = r[0];
  if (/^model$/i.test(name)) continue;
  // 分档后缀（≤/> 200K tokens 之类）要先剥掉再查 id，否则会落成重复模型
  const id = idOf(name.replace(/\s*\((?:≤|>)[^)]*\)\s*$/i, '').trim());
  const free = /free/i.test(r[1]);
  const inp = money(r[1]), out = money(r[2]), cache = money(r[3]);
  if (inp == null || out == null) continue;
  addModel(id, name.replace(/\s*\(.*?\)\s*$/, '').replace(/\s*Free$/i, ''), name.split(' ')[0], free ? 'OpenCode Zen 限时免费' : '');
  upsert(s.apiPrices, {
    id: `oczen-${id}`,
    provider: 'OpenCode Zen',
    modelId: id,
    band: free ? '免费' : '标准',
    currency: 'USD',
    in: inp,
    cache: cache ?? inp,
    out,
    free: free || undefined,
    note: free ? '官方标注限时免费（收集反馈用）' : null,
    source: SRC_ZEN,
    verifiedAt: V,
  });
  if (free) zenFree++; else zenPaid++;
}

/* ================= 支付方式 ================= */
pay.providers['OpenCode'] = {
  cn: true,
  methods: ['支付宝', '微信'],
  note: '支持支付宝与微信支付（官方 billing 文档列出 Card / Link / Alipay / UPI / WeChat Pay 五种；手续费 4.6% + $0.31，旧 Zen 文档仍写 4.4% + $0.30，两处口径不一致）。不支持境内银联。Go 超额后可由余额兜底（v2 中该项由「Use balance」更名为「Extra usage」）。',
};
pay.providers['OpenCode Zen'] = { ...pay.providers['OpenCode'] };

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
await writeFile(path.join(DATA, 'payment.json'), JSON.stringify(pay, null, 2), 'utf8');

const go = s.plans.find((p) => p.id === 'opencode-go');
console.log(`OpenCode Go：$10/月，覆盖 ${Object.keys(goModels).length} 个模型，额度合计 $${limitSum}（各模型独立）`);
console.log(`  5h/周/月窗口 = 20% / 50% / 100%`);
console.log(`OpenCode Zen 按量：付费 ${zenPaid} 条 + 免费 ${zenFree} 条`);
console.log(`模型目录：${s.models.length} 个｜按量价 ${s.apiPrices.length} 条｜套餐 ${s.plans.length} 个`);
const sample = Object.entries(goModels).slice(0, 4).map(([k, v]) => `${k}($${v.quotaOverride})`);
console.log('样例：' + sample.join(', '));
