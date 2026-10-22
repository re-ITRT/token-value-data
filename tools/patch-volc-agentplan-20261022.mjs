// 火山方舟 Agent Plan 个人版 2026-10-22 大改（官方文档核验）
//
// 变化要点：
//  1. 四档：Small ¥40/20,000 AFP、Medium ¥200/100,000、Large ¥500/**250,000（原 500,000 腰斩）**、
//     **Max ¥1,000/500,000（新增档）**；单价已拉平为 0.002 元/AFP
//  2. 新增 5 小时 / 周 / 日 三级限额（日额度 = 月额度一半）
//  3. 首 2 月 2.5 折延至 2026-11-08：Small ¥9.9、**Medium ¥49.9**（旧记录缺这一档）；Large/Max 无折扣
//  4. **2026-09-01 起取消输入分段系数**（原来 ≤32k ×0.67、>128k ×2），统一为模型系数 → 短输入 AFP 消耗上升约 49%
//  5. 系数表更新：新增 doubao-seed-2.1-pro(2.5)、doubao-seed-2.1-lite(0.5)、deepseek-v4.1-flash-economy(2，折后 1)；
//     移除 doubao-seed-2.1-turbo、doubao-seed-2.0-lite、glm-5.2、kimi-k2.6；
//     折扣延期：v4.1-flash 1.25→2026-12-30、k2.8-preview 4.8→2026-12-14、kimi-k3 5→2026-10-25
//  6. 新机制：超额后付费（自动切换，Auto/kimi-k3/kimi-k2.8-preview/glm-5.3/minimax-m3/生图生视频不支持）；
//     文本与向量模型**禁止 API 调用**（非 AI 工具里用专属 Base URL/Key 可判滥用）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC = 'https://ark.volcengine.com/region:cn-beijing/docs/agent-plan-personal-afp-credits-billing-rules';
const SRC_PLAN = 'https://ark.volcengine.com/region:cn-beijing/docs/agent-plan-personal-plan-overview';
const V = '2026-10-22';
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

/* ---- AFP 系数（输入=输出）：值 = 系数 × 100（每百万 token 消耗的 AFP） ---- */
const NO_DISCOUNT = [
  ['doubao-seed-2.0-mini', 0.25],
  ['deepseek-v4-flash', 0.5],
  ['glm-5.3-flash', 0.5],
  ['doubao-seed-2.1-lite', 0.5],
  ['doubao-embedding-vision', 0.5],
  ['doubao-seed-evolving', 2.5],
  ['minimax-m3', 2.5],
  ['doubao-seed-2.1-pro', 2.5],
  ['kimi-k2.7-code', 4.5],
  ['glm-5.3', 4.5],
  ['deepseek-v4-pro', 5.5],
];
// 带限时折扣的模型：[id, 原系数, 折后系数, 折扣标签]
const DISCOUNTED = [
  ['deepseek-v4.1-flash', 2.5, 1.25, '系数 5 折（延至 2026-12-30）'],
  ['deepseek-v4.1-flash-economy', 2, 1, '系数 5 折（2026-10-20~12-30）'],
  ['kimi-k2.8-preview', 8, 4.8, '系数 6 折（延至 2026-12-14）'],
  ['kimi-k3', 10, 5, '系数 5 折（至 2026-10-25）'],
];
// 即将下线提示
const DEPRECATING = { 'kimi-k2.7-code': '2026-10-28', 'minimax-m3': '2026-11-02' };

const addModel = (id, name, note) => {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor: '字节', note: note || '' });
};

function buildModels() {
  const out = {};
  for (const [id, coef] of NO_DISCOUNT) {
    const u = Math.round(coef * 100);
    out[id] = { u: { input: u, cache: u, output: u }, note: `官方抵扣系数 ${coef} AFP/万 token${DEPRECATING[id] ? `；官方将于 ${DEPRECATING[id]} 下线` : ''}` };
  }
  for (const [id, coef, now, label] of DISCOUNTED) {
    const u = Math.round(coef * 100);
    const un = Math.round(now * 100);
    out[id] = {
      u: { input: u, cache: u, output: u },
      bands: [
        { id: 'base', label: '常规系数', mult: 1 },
        { id: 'deal', label, mult: +(now / coef).toFixed(4) },
      ],
      note: `官方抵扣系数 ${coef}，${label}（折后 ${now}）`,
    };
  }
  return out;
}

const TIERS = [
  ['volc-agent-small', 'Agent Plan Small', 40, 9.9, 20000, '5h 2,000 / 周 7,000 / 日 10,000'],
  ['volc-agent-medium', 'Agent Plan Medium', 200, 49.9, 100000, '5h 10,000 / 周 35,000 / 日 50,000'],
  ['volc-agent-large', 'Agent Plan Large', 500, null, 250000, '5h 25,000 / 周 87,500 / 日 125,000'],
  ['volc-agent-max', 'Agent Plan Max', 1000, null, 500000, '5h 50,000 / 周 175,000 / 日 250,000'],
];
for (const [id, name, price, promo, afp, caps] of TIERS) {
  const priceVariants = [{ id: 'list', label: '原价', amount: price }];
  if (promo) priceVariants.push({ id: 'promo', label: '2.5 折（首 2 个月）', amount: promo, note: '活动至 2026-11-08，第 3 月起原价' });
  upsert(s.plans, {
    id, provider: '火山方舟', name, kind: 'points', currency: 'CNY',
    quota: afp, quotaUnit: 'AFP/月', period: '月',
    window: '5h·周·日·月',
    priceVariants,
    tags: ['禁 API 调用', '超额可转后付费'],
    line: 'volc-agent',
    note:
      `四档统一 0.002 元/AFP；限额：${caps}（日额度恒为月额度一半）。` +
      '2026-09-01 起取消输入分段系数（原来 ≤32k ×0.67、>128k ×2），统一按模型系数计，短输入实际消耗上升约 49%。' +
      '额度耗尽自动切后付费（Auto 模式、kimi-k3、kimi-k2.8-preview、glm-5.3、minimax-m3、生图生视频不支持）。' +
      '文本与向量模型禁止用于 API（非 AI 工具中使用专属 Base URL/Key 可判滥用，停订封号）。仅支持升配、不支持降配；' +
      '连续包季 9.7 折、包年 9.5 折（2026-05-19~2028-05-19，仅首个周期）。kimi-k3 不支持 Small 档。',
    source: SRC_PLAN, verifiedAt: V,
    models: buildModels(),
  });
}

// 新增模型目录项
addModel('doubao-seed-2.1-lite', 'Doubao Seed 2.1 Lite', 'Agent Plan 系数 0.5');
addModel('doubao-seed-2.1-pro', 'Doubao Seed 2.1 Pro', 'Agent Plan 系数 2.5');
addModel('deepseek-v4.1-flash-economy', 'DeepSeek V4.1 Flash Economy', 'Agent Plan 系数 2（折后 1）');

// 已从 Agent Plan 移出的模型：补说明（仍可能在别家的列表里）
for (const [id, why] of [
  ['doubao-seed-2.1-turbo', '火山 Agent Plan 已于 2026-10-09 移出该模型'],
  ['doubao-seed-2.0-lite', '火山 Agent Plan 已改名为 doubao-seed-2.1-lite'],
  ['glm-5.2', '火山 Agent Plan 已移出该模型（2026-10）'],
  ['kimi-k2.6', '火山 Agent Plan 已移出该模型（2026-10）'],
]) {
  const m = s.models.find((x) => x.id === id);
  if (m) m.note = `${m.note ? m.note + '｜' : ''}${why}`;
}

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
const volcPlans = s.plans.filter((p) => /^volc-agent/.test(p.id));
console.log('火山 Agent Plan：' + volcPlans.map((p) => `${p.name} ¥${p.priceVariants[0].amount}/${p.quota} AFP`).join(' | '));
const sm = volcPlans[0].models;
console.log('系数覆盖 ' + Object.keys(sm).length + ' 个模型；带折扣 ' + Object.values(sm).filter((m) => m.bands).length + ' 个');
