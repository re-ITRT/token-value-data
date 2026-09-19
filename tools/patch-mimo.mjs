// 小米 MiMo 官方定价与 Token Plan（来源：mimo.mi.com 官方文档）
//   API 按量：国内 元/百万 token；海外 美元/百万 token
//   Token Plan：四档月度/年度，额度以 Credits 计，按 token 折算；夜间（北京 00:00–08:00）0.8 倍消耗
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const PLAN_SRC = 'https://mimo.mi.com/docs/zh-CN/tokenplan/subscription';
const API_SRC = 'https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go';
const V = '2026-09-18';

const s = JSON.parse(await readFile(FILE, 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

/* ---- 模型 ---- */
for (const [id, name, note] of [
  ['mimo-v2.5', 'MiMo-V2.5', '1M 上下文'],
  ['mimo-v2.5-pro', 'MiMo-V2.5 Pro', '1M 上下文'],
]) {
  const m = s.models.find((x) => x.id === id);
  if (m) { m.vendor = '小米'; m.name = name; m.note = note; }
  else s.models.push({ id, name, vendor: '小米', note });
}

/* ---- 官方按量价 ---- */
const api = (id, modelId, provider, band, currency, i, c, o, note) =>
  upsert(s.apiPrices, { id, provider, modelId, band, currency, in: i, cache: c, out: o, note, source: API_SRC, verifiedAt: V });
// 国内（元/百万 token）：缓存写入限时免费；无峰谷
api('mimo-cn-v25', 'mimo-v2.5', '小米 MiMo API（国内）', '标准', 'CNY', 1.0, 0.02, 2.0);
api('mimo-cn-v25pro', 'mimo-v2.5-pro', '小米 MiMo API（国内）', '标准', 'CNY', 3.0, 0.025, 6.0);
// 海外（美元/百万 token）
api('mimo-intl-v25', 'mimo-v2.5', '小米 MiMo API（海外）', '标准', 'USD', 0.14, 0.0028, 0.28);
api('mimo-intl-v25pro', 'mimo-v2.5-pro', '小米 MiMo API（海外）', '标准', 'USD', 0.435, 0.0036, 0.87);

/* ---- Token Plan 四档 ----
   官方口径：语言模型按 token 扣 Credit——mimo-v2.5-pro：缓存 2.5 / 输入 300 / 输出 600 Credits 每 token
                                             mimo-v2.5：缓存 2 / 输入 100 / 输出 200 Credits 每 token
   → 每 100 万 token = 上述 × 1e6                                                */
const u = {
  'mimo-v2.5': { input: 100e6, cache: 2e6, output: 200e6 },
  'mimo-v2.5-pro': { input: 300e6, cache: 2.5e6, output: 600e6 },
};
const bands = [
  { id: 'base', label: '标准（北京 08:00–24:00）', mult: 1 },
  { id: 'night', label: '夜间 0.8 倍（北京 00:00–08:00）', mult: 0.8 },
];
const models = Object.fromEntries(
  Object.entries(u).map(([id, x]) => [id, { u: x, bands, note: '官方 Credit 系数（每 token）已换算成每百万 token' }]),
);

const plan = (id, name, monthly, annualPerMonth, credits) => ({
  id,
  provider: '小米 MiMo',
  name,
  kind: 'points',
  currency: 'CNY',
  quota: credits,
  quotaUnit: 'Credits/月',
  period: '月',
  window: null,
  priceVariants: [
    { id: 'list', label: '月付', amount: monthly },
    { id: 'promo', label: '首购 / 年付 88 折', amount: annualPerMonth },
  ],
  tags: [],
  note: '夜间（北京 00:00–08:00）消耗系数 0.8×；额度耗尽即停服（不扣余额）；同账号同时只能有 1 个套餐（可补差价升级）',
  source: PLAN_SRC,
  verifiedAt: V,
  models,
});

upsert(s.plans, plan('mimo-token-lite', 'MiMo Token Plan Lite', 39, 34.32, 4_100_000_000));
upsert(s.plans, plan('mimo-token-standard', 'MiMo Token Plan Standard', 99, 87.12, 11_000_000_000));
upsert(s.plans, plan('mimo-token-pro', 'MiMo Token Plan Pro', 329, 289.52, 38_000_000_000));
upsert(s.plans, plan('mimo-token-max', 'MiMo Token Plan Max', 659, 579.92, 82_000_000_000));

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

console.log('小米 MiMo 已写入：4 条按量价 + 4 个 Token Plan 档位');
for (const p of s.plans.filter((x) => /^mimo-token/.test(x.id))) {
  console.log(`  ${p.name.padEnd(26)} ¥${p.priceVariants[0].amount}/月（88折 ¥${p.priceVariants[1].amount}）  ${(p.quota / 1e9).toFixed(1)}B Credits`);
}
