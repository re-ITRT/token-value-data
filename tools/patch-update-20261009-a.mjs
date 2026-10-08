// 2026-10-09 更新（一）：Ollama Cloud 与小米 MiMo
//
// Ollama（官方 pricing 页 2026-10-09 核验）：
//   - 档位：Free $0 / Pro $20（年付 $200）/ Max $100（含 $300 credits）/ Team $500（含 $1,000 credits）
//     ⚠️ 我原来把 $60 credits 记在 Pro 上；官方页面明确 Pro 是 $60？—— 实测页面文案：Pro 档 $60 credits 未标注，
//        页面在 Pro 下有 "$60 of usage credits per month"，Max 才是 $300。这里按官方页面保留 Pro=$60、Max=$300、Team=$1000。
//   - 峰时：工作日 UTC 12:00–18:00；其余时段与整个周末为非峰（半价）
//   - deepseek-v4-flash 已于 2026-09-25 下架；新增 deepseek-v4.1-flash；deepseek-v4-pro 价格改为峰/非峰两档
//
// 小米 MiMo（官方 pricing 页 2026-10-09 核验）：
//   - V2.5 → V2.6 换代：mimo-v2.6-flash（原 v2.5 同价）、mimo-v2.6-pro（原 v2.5-pro 同价）、
//     新增 mimo-v2.6-pro-ultraspeed（¥0.25/¥30/¥60，海外 $0.036/$4.35/$8.7）
//   - mimo-v2.5 / mimo-v2.5-pro 于 2026-10-21 10:00 下线
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const V = '2026-10-09';
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};
const addModel = (id, name, vendor, note) => {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor, note: note || '' });
};

/* ================= Ollama ================= */
const OLLAMA_SRC = 'https://ollama.com/pricing';
// 官方页面：Pro $20（$60 credits/月）、Max $100（$300 credits/月）、Team $500（$1,000 credits/月，团队共享）
upsert(s.plans, {
  id: 'ollama-pro', provider: 'Ollama Cloud', name: 'Pro', kind: 'credit', currency: 'USD',
  quota: 60, quotaUnit: 'USD 额度/月', period: '月',
  priceVariants: [
    { id: 'list', label: '月付', amount: 20 },
    { id: 'annual', label: '年付折合（$200/年）', amount: 16.67 },
  ],
  window: null,
  tags: ['额度不结转'],
  note: '含 $60/月 用量额度（每月重置，不结转）；自购 credits 自加入起 1 年过期；并发 3；数据不用于训练、零留存。峰时＝工作日 UTC 12:00–18:00，其余时段与整个周末为非峰（半价）。',
  source: OLLAMA_SRC, verifiedAt: V, models: s.plans.find((p) => p.id === 'ollama-pro')?.models || {},
});
upsert(s.plans, {
  id: 'ollama-max', provider: 'Ollama Cloud', name: 'Max', kind: 'credit', currency: 'USD',
  quota: 300, quotaUnit: 'USD 额度/月', period: '月',
  priceVariants: [{ id: 'list', label: '月付', amount: 100 }],
  window: null,
  tags: ['额度不结转'],
  note: '含 $300/月 用量额度；并发 10；其余同 Pro（额度不结转、自购 credits 1 年过期、数据不训练）。2026-08-31 起的透明计价改版新增档。',
  source: OLLAMA_SRC, verifiedAt: V, models: {},
  line: 'ollama',
});
upsert(s.plans, {
  id: 'ollama-team', provider: 'Ollama Cloud', name: 'Team', kind: 'credit', currency: 'USD',
  quota: 1000, quotaUnit: 'USD 额度/月（团队共享）', period: '月',
  priceVariants: [{ id: 'list', label: '月付', amount: 500 }],
  window: null,
  tags: ['团队共享额度'],
  note: '含 $1,000/月 团队共享额度；并发 10；可限制团队成员可用模型；更大团队可谈量价。',
  source: OLLAMA_SRC, verifiedAt: V, models: {},
  line: 'ollama-team',
});

// Ollama 的按量价：官方表（USD/百万 token）
s.apiPrices = s.apiPrices.filter((a) => a.provider !== 'Ollama Cloud API');
const OLLAMA_ROWS = [
  // 模型 id, 峰时/标准 input/cache/out, 非峰 input/cache/out（没有非峰档的写 null）
  ['deepseek-v4-1-flash', [0.3, 0.006, 1.2], [0.15, 0.003, 0.6]],
  ['deepseek-v4-pro', [1.32, 0.044, 3.96], [0.66, 0.022, 1.98]],
  ['gemma4', [0.14, 0.05, 0.4], null],
  ['glm-5.3', [1.4, 0.26, 4.4], null],
  ['glm-5.3-flash', [0.15, 0.03, 0.5], null],
  ['glm-5.2', [1.4, 0.26, 4.4], null],
  ['gpt-oss:120b', [0.15, 0.014, 0.6], null],
  ['gpt-oss:20b', [0.07, 0.035, 0.3], null],
  ['kimi-k3', [3, 0.3, 15], null],
  ['kimi-k2.7-code', [0.95, 0.19, 4], null],
  ['kimi-k2.6', [0.95, 0.16, 4], null],
  ['minimax-m3', [0.6, 0.12, 2.4], null],
  ['minimax-m2.7', [0.3, 0.06, 1.2], null],
  ['mistral-large-4', [0.68, 0.07, 2.09], null],
  ['mistral-large-3', [0.5, 0.5, 1.5], null],
  ['nemotron-3-nano', [0.06, 0.06, 0.24], null],
  ['nemotron-3-super', [0.015, 0.015, 0.6], null],
  ['nemotron-3-ultra', [0.1, 0.1, 3], null],
];
const PEAK = { tz: 'UTC', days: [1, 2, 3, 4, 5], ranges: [[12, 18]], note: '工作日 UTC 12:00–18:00；其余时段与整个周末为非峰（半价）' };
for (const [modelId, peak, off] of OLLAMA_ROWS) {
  const name = modelId
    .replace('deepseek-v4-1-flash', 'DeepSeek V4.1 Flash').replace('deepseek-v4-pro', 'DeepSeek V4 Pro')
    .replace('glm-5.3-flash', 'GLM-5.3 Flash').replace('glm-5.3', 'GLM-5.3').replace('glm-5.2', 'GLM-5.2')
    .replace('kimi-k3', 'Kimi K3').replace('kimi-k2.7-code', 'Kimi K2.7 Code').replace('kimi-k2.6', 'Kimi K2.6')
    .replace('minimax-m3', 'MiniMax M3').replace('minimax-m2.7', 'MiniMax M2.7').replace('mistral-large-4', 'Mistral Large 4')
    .replace('mistral-large-3', 'Mistral Large 3').replace('nemotron-3-nano', 'Nemotron 3 Nano').replace('nemotron-3-super', 'Nemotron 3 Super')
    .replace('nemotron-3-ultra', 'Nemotron 3 Ultra').replace('gemma4', 'Gemma 4');
  const vendorId = modelId.replace(/[:.]/g, '-');
  addModel(vendorId, name, 'Ollama', '');
  const bid = off ? `ollama-api-${vendorId}` : `ollama-api-${vendorId}-flat`;
  s.apiPrices = s.apiPrices.filter((a) => a.modelId !== vendorId || a.provider !== 'Ollama Cloud API');
  if (off) {
    upsert(s.apiPrices, {
      id: bid, provider: 'Ollama Cloud API', modelId: vendorId, band: '非峰时', slot: 'offpeak', peakRule: PEAK,
      currency: 'USD', in: off[0], cache: off[1], out: off[2], promo: true, promoNote: '非峰半价（工作日 UTC 12:00–18:00 之外与周末全天）',
      source: OLLAMA_SRC, verifiedAt: V,
    });
    upsert(s.apiPrices, {
      id: `${bid}-peak`, provider: 'Ollama Cloud API', modelId: vendorId, band: '峰时', slot: 'peak', peakRule: PEAK,
      currency: 'USD', in: peak[0], cache: peak[1], out: peak[2],
      source: OLLAMA_SRC, verifiedAt: V,
    });
  } else {
    upsert(s.apiPrices, {
      id: bid, provider: 'Ollama Cloud API', modelId: vendorId, band: '标准',
      currency: 'USD', in: peak[0], cache: peak[1], out: peak[2],
      source: OLLAMA_SRC, verifiedAt: V,
    });
  }
}
// deepseek-v4-flash 已于 2026-09-25 下架
const dsf = s.models.find((m) => m.id === 'deepseek-v4-flash');
if (dsf) dsf.note = `${dsf.note || ''}｜Ollama Cloud 已于 2026-09-25 下架该模型`.replace(/^｜/, '');

/* ================= 小米 MiMo ================= */
const MIMO_SRC = 'https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go';
s.apiPrices = s.apiPrices.filter((a) => !/MiMo/.test(a.provider));
const MIMO_ROWS = [
  ['mimo-v2.6-flash', 'MiMo-V2.6-Flash', 1.0, 0.02, 2.0, 0.14, 0.0028, 0.28],
  ['mimo-v2.6-pro', 'MiMo-V2.6-Pro', 3.0, 0.025, 6.0, 0.435, 0.0036, 0.87],
  ['mimo-v2.6-pro-ultraspeed', 'MiMo-V2.6-Pro-Ultraspeed', 30.0, 0.25, 60.0, 4.35, 0.036, 8.7],
];
for (const [id, name, cnIn, cnCache, cnOut, usIn, usCache, usOut] of MIMO_ROWS) {
  addModel(id, name, '小米', id === 'mimo-v2.6-pro-ultraspeed' ? '极速档' : '');
  upsert(s.apiPrices, {
    id: `mimo-cn-${id}`, provider: '小米 MiMo API（国内）', modelId: id, band: '标准', currency: 'CNY',
    in: cnIn, cache: cnCache, out: cnOut, source: MIMO_SRC, verifiedAt: V,
    note: '批量推理为实时价 5 折',
  });
  upsert(s.apiPrices, {
    id: `mimo-intl-${id}`, provider: '小米 MiMo API（海外）', modelId: id, band: '标准', currency: 'USD',
    in: usIn, cache: usCache, out: usOut, source: MIMO_SRC, verifiedAt: V,
  });
}
for (const [id, when] of [['mimo-v2.5', '2026-10-21 10:00'], ['mimo-v2.5-pro', '2026-10-21 10:00']]) {
  const m = s.models.find((x) => x.id === id);
  if (m) m.note = `官方将于 ${when} 下线，请改用品名对应的 V2.6 版本`;

  // Token Plan 的模型映射同步换代（价格系数不变）
  for (const p of s.plans.filter((x) => /^mimo-token/.test(x.id))) {
    if (p.models?.[id]) {
      const v26 = id === 'mimo-v2.5' ? 'mimo-v2.6-flash' : 'mimo-v2.6-pro';
      p.models[v26] = { ...p.models[id] };
      delete p.models[id];
    }
  }
}
// Token Plan 说明补条款要点
for (const p of s.plans.filter((x) => /^mimo-token/.test(x.id))) {
  p.note = `${p.note}｜订阅不支持退款、未用额度不退；额度仅限编程工具，禁止当 API 用于脚本/应用后端（违规可封 Key）`;
}

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
const oll = s.apiPrices.filter((a) => a.provider === 'Ollama Cloud API');
console.log(`Ollama：套餐 ${s.plans.filter((p) => /^ollama/.test(p.id)).length} 档，按量 ${oll.length} 条`);
console.log(`  非峰行 ${oll.filter((a) => a.slot === 'offpeak').length}｜峰时行 ${oll.filter((a) => a.slot === 'peak').length}｜标准行 ${oll.filter((a) => !a.slot).length}`);
console.log(`小米 MiMo：按量 ${s.apiPrices.filter((a) => /MiMo/.test(a.provider)).length} 条（V2.6 三个型号 × 国内/海外）`);
