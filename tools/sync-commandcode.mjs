// 从 Command Code 定价页同步全部模型：目录、Provider API 按量价（含峰谷）、以及三档套餐的模型范围与单模型额度
// 官方页面把模型表以 JSON 内嵌在 HTML 里（70 个模型，每个带 inputCost/outputCost/cacheReadCost/timeOfDay/planAllowanceUsd）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const SRC = 'https://commandcode.ai/docs/resources/pricing-limits';
const VERIFIED = '2026-09-18';

async function fetchModels() {
  const res = await fetch(SRC, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } });
  const html = await res.text();
  const un = html.replace(/\\"/g, '"').replace(/\\u0026/g, '&').replace(/\\n/g, ' ');
  const start = un.indexOf('{"id":"deepseek-v4-flash"');
  if (start < 0) throw new Error('未找到模型 JSON');
  const arrStart = un.lastIndexOf('[', start);
  let depth = 0, end = -1;
  for (let i = arrStart; i < un.length; i++) {
    const ch = un[i];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return JSON.parse(un.slice(arrStart, end));
}

const models = await fetchModels();
const s = JSON.parse(await readFile(FILE, 'utf8'));

/* ---- Command Code 的模型 id → 本目录已有的 id（避免同一个模型出现两次） ---- */
const ID_MAP = {
  'deepseek-v4.1-flash': 'deepseek-v4-1-flash',
  'qwen-3.8-max': 'qwen3.8-max',
  'qwen-3.8-flash': 'qwen3.8-flash',
  'qwen-3.8-27b': 'qwen3.8-27b',
  'tencent/hy3-paid': 'hunyuan-hy3',
  'tencent/hy4-preview': 'hunyuan-hy4-preview',
};
// 官方文档写明需要 Max 档才有的模型（本目录没有 Max 档，先不挂到 Go/GOAT/Pro）
const MAX_ONLY = [/^claude-opus-/, /^claude-fable-/];

const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

/* ---- 1. 目录（厂商名统一成与本目录一致的中文口径，避免同一家出现两个分组） ---- */
const VENDOR_MAP = {
  Alibaba: '阿里', 'Moonshot AI': '月之暗面', 'Z.ai': '智谱', Tencent: '腾讯', Xiaomi: '小米',
  StepFun: '阶跃星辰', DeepSeek: 'DeepSeek', MiniMax: 'MiniMax', OpenAI: 'OpenAI', Anthropic: 'Anthropic',
  Google: 'Google', Meta: 'Meta', NVIDIA: 'NVIDIA', xAI: 'xAI', Sakana: 'Sakana', 'Thinking Machines': 'Thinking Machines',
};
let addedModels = 0;
for (const m of models) {
  const id = ID_MAP[m.id] || m.id;
  if (s.models.some((x) => x.id === id)) continue;
  s.models.push({ id, name: m.name, vendor: VENDOR_MAP[m.provider] || m.provider, note: m.category === 'premium' ? '闭源高级模型' : '' });
  addedModels++;
}

/* ---- 2. Provider API 按量价（USD/百万 token，含峰谷） ---- */
const bandOf = (m) => {
  if (!m.timeOfDay) return { band: '标准', promo: false };
  return { band: '谷时', promo: true, promoNote: `峰时 $${m.timeOfDay.peak.inputCost} / $${m.timeOfDay.peak.cacheReadCost} / $${m.timeOfDay.peak.outputCost}（${m.timeOfDay.windows}）` };
};
let apiCount = 0;
for (const m of models) {
  const id = ID_MAP[m.id] || m.id;
  const b = bandOf(m);
  upsert(s.apiPrices, {
    id: `cc-api-${id}`, provider: 'Command Code Provider API', modelId: id, band: b.band,
    currency: 'USD', in: m.inputCost, cache: m.cacheReadCost, out: m.outputCost,
    promo: b.promo, promoNote: b.promoNote, source: SRC, verifiedAt: VERIFIED,
  });
  apiCount++;
  if (m.timeOfDay) {
    upsert(s.apiPrices, {
      id: `cc-api-${id}-peak`, provider: 'Command Code Provider API', modelId: id, band: '峰时',
      currency: 'USD', in: m.timeOfDay.peak.inputCost, cache: m.timeOfDay.peak.cacheReadCost, out: m.timeOfDay.peak.outputCost,
      source: SRC, verifiedAt: VERIFIED,
    });
    apiCount++;
  }
}

/* ---- 3. 三档套餐的模型范围 + 单模型额度 ---- */
const planModels = (key) => {
  const out = {};
  for (const m of models) {
    if (MAX_ONLY.some((re) => re.test(m.id))) continue;      // 需要 Max 档，跳过
    if (key === 'go' && m.category !== 'opensource') continue; // Go 只有开源模型 + 少数闭源
    const id = ID_MAP[m.id] || m.id;
    const allowance = m.planAllowanceUsd?.[key];
    out[id] = {
      u: { input: m.inputCost, cache: m.cacheReadCost, output: m.outputCost },
      ...(allowance != null ? { quotaOverride: allowance } : {}),
      note: allowance != null ? `官方单模型月额度 $${allowance}` : '',
    };
    if (m.timeOfDay) {
      out[id].bands = [
        { id: 'base', label: '谷时', mult: 1 },
        { id: 'peak', label: '峰时', mult: m.timeOfDay.peak.inputCost / m.timeOfDay.offPeak.inputCost },
      ];
    }
  }
  return out;
};

for (const [planId, key] of [['cmdcode-go', 'go'], ['cmdcode-goat', 'goat'], ['cmdcode-pro', 'pro']]) {
  const p = s.plans.find((x) => x.id === planId);
  if (!p) continue;
  p.models = planModels(key);
  p.source = SRC;
  p.verifiedAt = VERIFIED;
  if (key === 'go') {
    // Go 档的单模型额度官方只公布了两个模型，其余按整池 $10 计（会偏保守）
    for (const mid of ['qwen-3.7-max', 'minimax-m3']) if (p.models[mid]) p.models[mid].quotaOverride = 20;
    p.note = 'Go 档官方只公布部分模型的单模型额度（Qwen 3.7 Max / MiniMax M3 各 $20），其余模型按整池 $10 计，偏保守';
  }
  if (key === 'goat') p.note = 'GOAT 的单模型额度整表照抄官方（如 DeepSeek V4 Flash $60、Kimi K3 $20）；Claude Opus / Fable 需 Max 档，未纳入';
  if (key === 'pro') p.note = 'Pro 的单模型额度整表照抄官方；Claude Opus / Fable 需 Max 档，未纳入';
}

/* ---- 4. 时段规则挂到新的峰时行上 ---- */
const deepseekRule = { tz: 'UTC', days: [1, 2, 3, 4, 5], ranges: [[1, 4], [6, 10]], note: 'UTC 周一至五 01–04、06–10（北京 09–12、14–18）' };
for (const a of s.apiPrices) {
  if (/^cc-api-/.test(a.id) && /谷时|峰时/.test(a.band)) a.peakRule = deepseekRule;
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

console.log(`新增模型 ${addedModels} 个（目录共 ${s.models.length}）`);
console.log(`Command Code 按量价 ${apiCount} 条（含峰时行）`);
for (const id of ['cmdcode-go', 'cmdcode-goat', 'cmdcode-pro']) {
  const p = s.plans.find((x) => x.id === id);
  const withCap = Object.values(p.models).filter((m) => m.quotaOverride != null).length;
  console.log(`  ${p.name}: ${Object.keys(p.models).length} 个模型，其中 ${withCap} 个带单模型额度（整池 $${p.quota}）`);
}
console.log('\n抽查单模型额度：');
const goat = s.plans.find((p) => p.id === 'cmdcode-goat');
for (const mid of ['deepseek-v4-flash', 'deepseek-v4-1-flash', 'kimi-k3', 'glm-5.3', 'glm-5.2', 'qwen3.8-27b', 'gpt-5.6-sol']) {
  console.log(`  ${mid.padEnd(22)} goat=$${goat.models[mid]?.quotaOverride ?? '-'}`);
}
