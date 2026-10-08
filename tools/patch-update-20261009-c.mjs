// 2026-10-09 更新（三）：Command Code 新档位、支付与地域限制
// 来源：/docs/resources/pricing-limits（套餐表、窗口表、地域限制表）、/terms（2026-09-20 更新）、payment-methods
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const V = '2026-10-09';
const SRC = 'https://commandcode.ai/docs/resources/pricing-limits';
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const pay = JSON.parse(await readFile(path.join(DATA, 'payment.json'), 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

/* ---- 新档位：官方给了价格/池/窗口，但「单模型额度」没有独立页面公开 → 记成无法换算，不猜 ---- */
const NEW_TIERS = [
  ['cmdcode-provider', 'Provider', 15, null, '按量另计', '只为 Provider API 访问权（$15/月）＋按量付费；不含套餐额度。旧记录只写了「按量」'],
  ['cmdcode-max10', 'Max 10×', 100, 150, '$45 / $90', '每月 $150 额度；5 小时上限 $45、周上限 $90；约 230K 请求'],
  ['cmdcode-max20', 'Max 20×', 200, 300, '$90 / $180', '每月 $300 额度；5 小时上限 $90、周上限 $180；约 370K 请求'],
  ['cmdcode-teampro', 'Team Pro', 40, 40, '$12 / $24', '团队档；每月 $40 额度；5 小时上限 $12、周上限 $24'],
];
for (const [id, name, price, credits, caps, note] of NEW_TIERS) {
  upsert(s.plans, {
    id, provider: 'Command Code', name, kind: 'uncomputable', currency: 'USD',
    quota: credits, quotaUnit: credits ? 'USD 额度/月' : '无套餐额度（按量付费）', period: '月',
    window: credits ? '5h·周·月' : null,
    priceVariants: [{ id: 'list', label: '月付', amount: price }],
    tags: [], line: 'cmdcode-' + id.replace('cmdcode-', ''),
    note: `${note}｜单模型额度官方未按套餐页公开（Go/GOAT/Pro 有逐模型表，这三档没有）→ 不参与排名，避免给出错误推荐`,
    source: SRC, verifiedAt: V, models: {},
  });
}

/* ---- 已有档位：窗口与结构变化 ---- */
const go = s.plans.find((p) => p.id === 'cmdcode-go');
if (go) go.note = `${go.note}｜2026-09-28 起新用户由「整池 $10」改为按模型额度，老用户续费时自动切换；窗口：5 小时 $2 / 周 $5`;
const providApi = s.plans.find((p) => p.id === 'cmdcode-provider');
if (providApi) providApi.tags = ['含 Provider API'];

/* ---- 地域限制：官方明示两个模型中国不可用 ---- */
const REGION = { 'gpt-5.6-luna': 'Command Code 标注该模型在中国不可用', 'gemini-3.7-flash': 'Command Code 标注该模型在中国不可用' };
for (const [id, note] of Object.entries(REGION)) {
  const m = s.models.find((x) => x.id === id);
  if (m) m.note = `${m.note ? m.note + '｜' : ''}${note}`;
}

/* ---- 支付：官方已明列支付宝；条款含「仅美元且仅限美国」的冲突条款 ---- */
pay.providers['Command Code'] = {
  cn: true,
  methods: ['支付宝', '加密货币', 'UPI'],
  note:
    '官方支付方式页已明列：信用卡、支付宝、USDC 加密货币（Ethereum/Solana/Polygon/Base）、印度 UPI（₹，额度上限 ₹15,000）；用户实测支付宝可用。' +
    '⚠️ 但服务条款（2026-09-20 更新）写着「All payments must be made in U.S. dollars and within the United States」——与官方支付页自相矛盾，支付宝路径可能受地区风控影响。' +
    '自动充值仅支持已存卡的卡支付（支付宝/加密货币/UPI 不可）。订阅额度不结转、充值额度永久结转。',
};
pay.providers['Command Code Provider API'] = { ...pay.providers['Command Code'] };

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
await writeFile(path.join(DATA, 'payment.json'), JSON.stringify(pay, null, 2), 'utf8');
console.log(`新增 Command Code 档位 ${NEW_TIERS.length} 个（无法换算）；支付方式更新为 ${pay.providers['Command Code'].methods.join('/')}`);
console.log('套餐总数 ' + s.plans.length + '（无法换算 ' + s.plans.filter((p) => p.kind === 'uncomputable').length + '）');
