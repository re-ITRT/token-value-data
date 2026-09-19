// 把「官网直营」厂商（智谱 / Kimi / MiniMax）的 API 定价与订阅写进 sources.json
// 幂等：按 id upsert，可反复运行
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.push(item);
};
const addModel = (m) => upsert(s.models, m);
const addApi = (a) => upsert(s.apiPrices, a);
const addPlan = (p) => upsert(s.plans, p);

/* ---------------- 模型 ---------------- */
[
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', vendor: '智谱', note: '1M 上下文，原生多模态' },
  { id: 'glm-5.1', name: 'GLM-5.1', vendor: '智谱', note: '200K 上下文' },
  { id: 'glm-5-turbo', name: 'GLM-5-Turbo', vendor: '智谱', note: '' },
  { id: 'glm-4.7', name: 'GLM-4.7', vendor: '智谱', note: '在 Coding Plan 内会被切到 GLM-5.3-Flash' },
  { id: 'glm-4.7-flash', name: 'GLM-4.7-Flash', vendor: '智谱', note: '按量 API 免费' },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', vendor: '月之暗面', note: '' },
  { id: 'kimi-k2.7-code-highspeed', name: 'Kimi K2.7 Code HighSpeed', vendor: '月之暗面', note: '独立定价，约 2×' },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', vendor: 'MiniMax', note: '' },
  { id: 'minimax-m2.7-highspeed', name: 'MiniMax M2.7 HighSpeed', vendor: 'MiniMax', note: '' },
].forEach(addModel);

/* ---------------- 智谱官方 API（元/百万 token，open.bigmodel.cn/pricing） ---------------- */
const Z = 'https://open.bigmodel.cn/pricing';
const ZV = '2026-09-18';
addApi({ id: 'zhipu-glm53flash', provider: '智谱 BigModel API', modelId: 'glm-5.3-flash', band: '标准', currency: 'CNY', in: 0.8, cache: 0.23, out: 2.8, source: Z, verifiedAt: ZV });
addApi({ id: 'zhipu-glm53', provider: '智谱 BigModel API', modelId: 'glm-5.3', band: '标准', currency: 'CNY', in: 8, cache: 2, out: 28, source: Z, verifiedAt: ZV });
addApi({ id: 'zhipu-glm52', provider: '智谱 BigModel API', modelId: 'glm-5.2', band: '标准', currency: 'CNY', in: 8, cache: 2, out: 28, source: Z, verifiedAt: ZV });
addApi({ id: 'zhipu-glm51', provider: '智谱 BigModel API', modelId: 'glm-5.1', band: '标准（0–32K）', currency: 'CNY', in: 6, cache: 1.3, out: 24, note: '输入 ≥32K 时 ¥8 / ¥2 / ¥28', source: Z, verifiedAt: ZV });
addApi({ id: 'zhipu-glm5turbo', provider: '智谱 BigModel API', modelId: 'glm-5-turbo', band: '标准（0–32K）', currency: 'CNY', in: 5, cache: 1.2, out: 22, note: '输入 ≥32K 时 ¥7 / ¥1.8 / ¥26', source: Z, verifiedAt: ZV });
addApi({ id: 'zhipu-glm47', provider: '智谱 BigModel API', modelId: 'glm-4.7', band: '标准（0–32K）', currency: 'CNY', in: 2, cache: 0.4, out: 8, note: '按输入+输出长度分三段，最高 ¥4 / ¥0.8 / ¥16', source: Z, verifiedAt: ZV });
addApi({ id: 'zhipu-glm47flash', provider: '智谱 BigModel API', modelId: 'glm-4.7-flash', band: '免费', currency: 'CNY', in: 0, cache: 0, out: 0, free: true, source: Z, verifiedAt: ZV });

// 国际站 z.ai（USD/百万 token）
const ZI = 'https://docs.z.ai/guides/overview/pricing';
addApi({ id: 'zai-glm53', provider: '智谱 z.ai（国际）', modelId: 'glm-5.3', band: '标准', currency: 'USD', in: 1.4, cache: 0.26, out: 4.4, source: ZI, verifiedAt: ZV });
addApi({ id: 'zai-glm53flash', provider: '智谱 z.ai（国际）', modelId: 'glm-5.3-flash', band: '标准', currency: 'USD', in: 0.15, cache: 0.03, out: 0.5, source: ZI, verifiedAt: ZV });
addApi({ id: 'zai-glm52', provider: '智谱 z.ai（国际）', modelId: 'glm-5.2', band: '标准', currency: 'USD', in: 1.4, cache: 0.26, out: 4.4, source: ZI, verifiedAt: ZV });
addApi({ id: 'zai-glm47', provider: '智谱 z.ai（国际）', modelId: 'glm-4.7', band: '标准', currency: 'USD', in: 0.6, cache: 0.11, out: 2.2, source: ZI, verifiedAt: ZV });

/* ---------------- Kimi 官方 API ---------------- */
const KIMI_CN = 'https://platform.kimi.com/docs/pricing/chat';
const KIMI_INTL = 'https://platform.kimi.ai/docs/pricing/chat';
const KV = '2026-09-18';
addApi({ id: 'kimi-cn-k3', provider: 'Kimi API（国内）', modelId: 'kimi-k3', band: '标准', currency: 'CNY', in: 20, cache: 2, out: 100, source: KIMI_CN, verifiedAt: KV });
addApi({ id: 'kimi-cn-k27code', provider: 'Kimi API（国内）', modelId: 'kimi-k2.7-code', band: '标准', currency: 'CNY', in: 6.5, cache: 1.3, out: 27, note: 'Batch API 为标准价 60%', source: KIMI_CN, verifiedAt: KV });
addApi({ id: 'kimi-cn-k27hs', provider: 'Kimi API（国内）', modelId: 'kimi-k2.7-code-highspeed', band: '标准（高速版）', currency: 'CNY', in: 13, cache: 2.6, out: 54, source: KIMI_CN, verifiedAt: KV });
addApi({ id: 'kimi-cn-k26', provider: 'Kimi API（国内）', modelId: 'kimi-k2.6', band: '标准', currency: 'CNY', in: 6.5, cache: 1.1, out: 27, source: KIMI_CN, verifiedAt: KV });
addApi({ id: 'kimi-intl-k3', provider: 'Kimi API（国际站）', modelId: 'kimi-k3', band: '标准', currency: 'USD', in: 3, cache: 0.3, out: 15, source: KIMI_INTL, verifiedAt: KV });
addApi({ id: 'kimi-intl-k27code', provider: 'Kimi API（国际站）', modelId: 'kimi-k2.7-code', band: '标准', currency: 'USD', in: 0.95, cache: 0.19, out: 4, source: KIMI_INTL, verifiedAt: KV });
addApi({ id: 'kimi-intl-k27hs', provider: 'Kimi API（国际站）', modelId: 'kimi-k2.7-code-highspeed', band: '标准（高速版）', currency: 'USD', in: 1.9, cache: 0.38, out: 8, source: KIMI_INTL, verifiedAt: KV });
addApi({ id: 'kimi-intl-k26', provider: 'Kimi API（国际站）', modelId: 'kimi-k2.6', band: '标准', currency: 'USD', in: 0.95, cache: 0.16, out: 4, source: KIMI_INTL, verifiedAt: KV });

/* ---------------- Kimi 会员订阅（官方不公开 token 绝对值 → 不可折算） ---------------- */
const KIMI_SUB_SRC = 'https://www.kimi.com/membership/pricing';
const kimiPlan = (id, name, variants, agentQuota, hasCode) => ({
  id,
  provider: 'Kimi',
  name,
  kind: 'uncomputable',
  currency: 'CNY',
  quota: null,
  quotaUnit: '额度按实际 token 从共享池扣除（绝对值未公开）',
  period: '月',
  window: '月·周·5h',
  priceVariants: variants,
  tags: [],
  note: `${hasCode ? '含 Kimi Code' : '不含 Kimi Code（旧 ¥49 档含，新版移除）'}；Agent 参考用量 ${agentQuota}；官方只给百分比锚（代码片段 ≈0.5–2%/月），未公开 token 绝对值，无法折算。两个官方锚点（会员 ≈¥1.63/任务 vs 加油包 ≈¥1.6/任务且加油包≈API 价）推算杠杆约 1×`,
  source: KIMI_SUB_SRC,
  verifiedAt: KV,
  models: {},
});
addPlan(kimiPlan('kimi-go', 'Kimi 会员 Go', [
  { id: 'list', label: '月付', amount: 39 },
  { id: 'annual', label: '年付（¥468/年）', amount: 39 },
], '1x', false));
addPlan(kimiPlan('kimi-plus', 'Kimi 会员 Plus', [
  { id: 'list', label: '月付', amount: 79 },
  { id: 'annual', label: '年付（¥948/年）', amount: 79 },
], '2x', true));
addPlan(kimiPlan('kimi-pro', 'Kimi 会员 Pro', [
  { id: 'list', label: '月付', amount: 159 },
  { id: 'annual', label: '年付（¥1908/年）', amount: 159 },
], '4x', true));
addPlan(kimiPlan('kimi-max', 'Kimi 会员 Max', [
  { id: 'list', label: '月付', amount: 559 },
  { id: 'annual', label: '年付（¥6708/年）', amount: 559 },
], '14x', true));

/* ---------------- MiniMax 官方 API ---------------- */
const MM_SRC = 'https://platform.minimaxi.com/document/price';
const MMV = '2026-09-18';
addApi({ id: 'mm-m3-cn', provider: 'MiniMax API（国内）', modelId: 'minimax-m3', band: '≤512K（永久五折）', currency: 'CNY', in: 2.1, cache: 0.42, out: 8.4, promo: true, promoNote: '原价 ¥4.20 / ¥0.84 / ¥16.80', source: MM_SRC, verifiedAt: MMV });
addApi({ id: 'mm-m3-cn-long', provider: 'MiniMax API（国内）', modelId: 'minimax-m3', band: '>512K', currency: 'CNY', in: 4.2, cache: 0.84, out: 16.8, note: '512K 以上为长度阶梯价', source: MM_SRC, verifiedAt: MMV });
addApi({ id: 'mm-m3-priority', provider: 'MiniMax API（国内）', modelId: 'minimax-m3', band: '优先服务 ×1.5（≤512K）', currency: 'CNY', in: 3.15, cache: 0.63, out: 12.6, source: MM_SRC, verifiedAt: MMV });
addApi({ id: 'mm-m3-intl', provider: 'MiniMax API（国际）', modelId: 'minimax-m3', band: '≤512K', currency: 'USD', in: 0.3, cache: 0.06, out: 1.2, promo: true, promoNote: '原价 $0.60 / $0.12 / $2.40', source: 'https://platform.minimax.io/docs/pricing', verifiedAt: MMV });
addApi({ id: 'mm-m27-cn', provider: 'MiniMax API（国内）', modelId: 'minimax-m2.7', band: '标准', currency: 'CNY', in: 2.1, cache: 0.42, out: 8.4, source: MM_SRC, verifiedAt: MMV });
addApi({ id: 'mm-m27hs-cn', provider: 'MiniMax API（国内）', modelId: 'minimax-m2.7-highspeed', band: '标准', currency: 'CNY', in: 4.2, cache: 0.42, out: 16.8, source: MM_SRC, verifiedAt: MMV });

/* ---------------- GLM Coding Plan（官方积分公式） ---------------- */
// 官方：(输入token×6.9 + 缓存命中token×1.7 + 输出token×24)/10000  → 每百万 token：690 / 170 / 2400 分
// Flash 官方系数 2.3 / 0.56 / 8 → 每百万 token：230 / 56 / 800 分
// 窗口只有 5 小时 + 周两个，无月额度；此处把周额度 ×4.33 折成月量做同口径比较
const GLM_U_53 = { input: 690, cache: 170, output: 2400 };
const GLM_U_FLASH = { input: 230, cache: 56, output: 800 };
const GLM_BANDS = [
  { id: 'base', label: '高峰（周一至五 14–18 点）', mult: 1 },
  { id: 'off', label: '非高峰 5 折', mult: 0.5 },
];
const GLM_BANDS_FLASH = [
  ...GLM_BANDS,
  { id: 'night', label: '夜间畅用 9/3–9/20（其他 Agent 额度 ×2）', mult: 0.5, note: 'ZCode 端 0 消耗；仅 GLM-5.3-Flash' },
];
const GLM_SRC = 'https://bigmodel.cn/glm-coding';
const glmPlan = (id, name, variants, weeklyPoints, h5) => ({
  id,
  provider: '智谱',
  name,
  kind: 'points',
  currency: 'CNY',
  quota: Math.round(weeklyPoints * 4.33),
  quotaUnit: '积分（周额度×4.33 折月）',
  period: '月',
  window: '5h·周',
  priceVariants: variants,
  tags: [],
  note: `官方周积分 ${weeklyPoints.toLocaleString()}、5 小时滚动 ${h5.toLocaleString()}（周额度是瓶颈）；无月额度，此处×4.33 折成月量；非高峰按 50% 抵扣`,
  source: GLM_SRC,
  verifiedAt: '2026-09-18',
  models: {
    'glm-5.3': { u: GLM_U_53, bands: GLM_BANDS, note: '官方抵扣公式 (输入×6.9 + 缓存×1.7 + 输出×24)/10000' },
    'glm-5.2': { u: GLM_U_53, bands: GLM_BANDS, note: '按 GLM-5.3 系数' },
    'glm-5.1': { u: GLM_U_53, bands: GLM_BANDS, note: '按 GLM-5.3 系数' },
    'glm-5-turbo': { u: GLM_U_53, bands: GLM_BANDS, note: '按 GLM-5.3 系数' },
    'glm-5.3-flash': { u: GLM_U_FLASH, bands: GLM_BANDS_FLASH, note: '官方系数 2.3 / 0.56 / 8' },
    'glm-4.7': { u: GLM_U_FLASH, bands: GLM_BANDS_FLASH, note: 'Coding Plan 内调用 GLM-4.7 会被自动切到 GLM-5.3-Flash，故按 Flash 系数' },
  },
});
addPlan(glmPlan('glm-coding-lite', 'GLM Coding Plan Lite', [
  { id: 'list', label: '连续包月', amount: 118 },
  { id: 'quarterly', label: '季付 8 折', amount: 94.4 },
  { id: 'annual', label: '年付 7 折', amount: 82.6 },
], 10000, 2000));
addPlan(glmPlan('glm-coding-pro', 'GLM Coding Plan Pro', [
  { id: 'list', label: '连续包月', amount: 538 },
  { id: 'quarterly', label: '季付 8 折', amount: 430.4 },
  { id: 'annual', label: '年付 7 折', amount: 376.6 },
], 60000, 12000));
addPlan(glmPlan('glm-coding-max', 'GLM Coding Plan Max', [
  { id: 'list', label: '连续包月', amount: 1078 },
  { id: 'quarterly', label: '季付 8 折', amount: 862.4 },
  { id: 'annual', label: '年付 7 折', amount: 754.6 },
], 140000, 28000));

/* ---------------- MiniMax Token Plan（官方只给量级口径） ---------------- */
// 官方口径：月调用次数 × 单次约 50K token → Plus 12,000 次 ≈6 亿+、Max 36,000 次 ≈18 亿+、Ultra 140,000 次 ≈71 亿+
// 官方未公开池子绝对价值与"单次 50K"的构成，因此按总量口径计，不随比例变化
const mmPlan = (id, name, variants, tokens) => ({
  id,
  provider: 'MiniMax',
  name,
  kind: 'tokens',
  currency: 'CNY',
  quota: tokens,
  quotaUnit: 'token（官网量级口径）',
  period: '月',
  window: '5h·周',
  priceVariants: variants,
  tags: [],
  note: '官方量级口径 = 月调用次数 × 单次约 50K token；输入/输出/缓存构成未公开，且套餐池按按量目录价扣减，实际可用量随构成变化',
  source: 'https://platform.minimaxi.com/subscribe/token-plan',
  verifiedAt: '2026-09-18',
  models: {
    'minimax-m3': { u: { input: 1000000, cache: 1000000, output: 1000000 } },
    'minimax-m2.7': { u: { input: 1000000, cache: 1000000, output: 1000000 } },
    'minimax-m2.7-highspeed': { u: { input: 1000000, cache: 1000000, output: 1000000 } },
  },
});
addPlan(mmPlan('mm-token-plus', 'Token Plan Plus', [
  { id: 'list', label: '月付', amount: 49 },
  { id: 'annual', label: '年付（¥490/年）', amount: 40.83 },
], 600000000));
addPlan(mmPlan('mm-token-max', 'Token Plan Max', [
  { id: 'list', label: '月付', amount: 119 },
  { id: 'annual', label: '年付（¥1190/年）', amount: 99.17 },
], 1800000000));
addPlan(mmPlan('mm-token-ultra', 'Token Plan Ultra', [
  { id: 'list', label: '月付', amount: 469 },
  { id: 'annual', label: '年付（¥4690/年）', amount: 390.83 },
], 7100000000));

/* ---------------- 硅基流动 SiliconFlow（纯按量，无订阅套餐） ---------------- */
const SF_CN = 'https://siliconflow.cn/pricing';
const SF_INTL = 'https://www.siliconflow.com/pricing';
const SFV = '2026-09-18';
[
  { id: 'qwen3.8-27b', name: 'Qwen3.8-27B', vendor: '阿里', note: '256K 上下文' },
  { id: 'longcat-2.0', name: 'LongCat 2.0', vendor: '美团', note: '1M 上下文' },
  { id: 'xing4.0-29b', name: 'Xing4.0-29B', vendor: '讯飞', note: '256K + 工具调用，平台长期免费' },
].forEach(addModel);

addApi({ id: 'sf-cn-v4flash-off', provider: '硅基流动（国内站）', modelId: 'deepseek-v4-flash', band: '谷时（02–08 点）', currency: 'CNY', in: 1.5, cache: 0.15, out: 4.5, slot: 'offpeak', promo: true, promoNote: '原价 ¥3.00 / ¥0.30 / ¥9.00', source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-v4flash-peak', provider: '硅基流动（国内站）', modelId: 'deepseek-v4-flash', band: '其余时段', currency: 'CNY', in: 3, cache: 0.3, out: 9, slot: 'peak', source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-v4pro', provider: '硅基流动（国内站）', modelId: 'deepseek-v4-pro', band: '标准', currency: 'CNY', in: 12, cache: 1, out: 24, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-v32', provider: '硅基流动（国内站）', modelId: 'deepseek-v4-pro', band: '标准（V3.2，164K）', currency: 'CNY', in: 4, cache: 0.4, out: 6, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-glm53', provider: '硅基流动（国内站）', modelId: 'glm-5.3', band: '标准', currency: 'CNY', in: 8, cache: 2, out: 28, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-glm52', provider: '硅基流动（国内站）', modelId: 'glm-5.2', band: '标准', currency: 'CNY', in: 8, cache: 2, out: 28, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-glm51', provider: '硅基流动（国内站）', modelId: 'glm-5.1', band: '标准（<32K）', currency: 'CNY', in: 6, cache: 1.3, out: 24, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-k27code', provider: '硅基流动（国内站）', modelId: 'kimi-k2.7-code', band: '标准', currency: 'CNY', in: 6.5, cache: 1.3, out: 27, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-k26', provider: '硅基流动（国内站）', modelId: 'kimi-k2.6', band: '标准', currency: 'CNY', in: 6.5, cache: 1.1, out: 27, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-qwen3827b', provider: '硅基流动（国内站）', modelId: 'qwen3.8-27b', band: '标准', currency: 'CNY', in: 3, cache: 3, out: 12, cacheIsInput: true, note: '不支持上下文缓存', source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-longcat', provider: '硅基流动（国内站）', modelId: 'longcat-2.0', band: '标准', currency: 'CNY', in: 5, cache: 0.1, out: 20, source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-cn-xing4', provider: '硅基流动（国内站）', modelId: 'xing4.0-29b', band: '免费', currency: 'CNY', in: 0, cache: 0, out: 0, free: true, note: '平台长期免费模型，限额固定、触顶返回 429', source: SF_CN, verifiedAt: SFV });
addApi({ id: 'sf-intl-v4flash', provider: '硅基流动（国际站）', modelId: 'deepseek-v4-flash', band: '标准', currency: 'USD', in: 0.13, cache: 0.028, out: 0.28, source: SF_INTL, verifiedAt: SFV });
addApi({ id: 'sf-intl-k3', provider: '硅基流动（国际站）', modelId: 'kimi-k3', band: '标准', currency: 'USD', in: 3, cache: 0.3, out: 15, source: SF_INTL, verifiedAt: SFV });
addApi({ id: 'sf-intl-m3', provider: '硅基流动（国际站）', modelId: 'minimax-m3', band: '标准', currency: 'USD', in: 0.3, cache: 0.06, out: 1.2, source: SF_INTL, verifiedAt: SFV });

/* ---------------- 国家超算互联网 SCNet ---------------- */
// 官方锚点（倍率 1.00 的 Kimi-K2.6）：60,000 Credits ≈ 1.2 亿缓存命中输入 / 720 万非命中输入 / 170 万输出
// → 每 100 万 token 消耗：缓存 500、输入 8,333、输出 35,294 Credits（再乘各模型倍率）
const SC_SRC = 'https://www2.scnet.cn/ac/openapi/doc/2.0/moduleapi/plans/token-plan.html';
const SC_MAAS = 'https://www.scnet.cn/home/subject/maas/index.html';
const SCV = '2026-09-18';
const SC_BASE = { cache: 500, input: 8333, output: 35294 };
// 官方 2026-09-01 倍率表（按周调整，整表照抄自官方文档）
const SC_MULT = {
  'glm-5.3': 2.29,
  'glm-5.3-flash': 0.15,
  'glm-5.2': 0.85,
  'glm-5.1': 1.4,
  'deepseek-v4-pro': 1.06,
  'deepseek-v4-1-flash': 0.23,
  'deepseek-v4-flash': 0.13,
  'kimi-k3': 4.12,
  'kimi-k2.7-code': 1.0,
  'kimi-k2.6': 1.0,
  'minimax-m3': 0.43,
  'minimax-m2.7': 0.43,
  'qwen3.8-max': 2.1,
  'qwen3.8-flash': 0.14,
};
const scModels = (extra = {}) =>
  Object.fromEntries(
    Object.entries(SC_MULT).map(([id, k]) => [
      id,
      {
        u: { input: Math.round(SC_BASE.input * k), cache: Math.round(SC_BASE.cache * k), output: Math.round(SC_BASE.output * k) },
        note: `官方倍率 ${k}`,
        ...extra,
      },
    ]),
  );

const scToken = (id, name, listPrice, promoPrice, credits) => ({
  id,
  provider: '超算互联网 SCNet',
  name,
  kind: 'points',
  currency: 'CNY',
  quota: credits,
  quotaUnit: 'Credits',
  period: '月',
  window: null,
  priceVariants: [
    { id: 'list', label: '原价', amount: listPrice },
    { id: 'promo', label: '活动价', amount: promoPrice },
  ],
  tags: [],
  note: '官方倍率按周调整；Credits 不结转，套餐 Key 仅限官方支持的交互式 AI 工具（FAQ 明确 Dify / Postman / cURL 均在允许范围外）',
  source: SC_SRC,
  verifiedAt: SCV,
  models: scModels(),
});
addPlan(scToken('scnet-token-basic', 'Token Plan 基础版', 50, 30, 60000));
addPlan(scToken('scnet-token-standard', 'Token Plan 标准版', 185, 110, 240000));
addPlan(scToken('scnet-token-advanced', 'Token Plan 高级版', 440, 265, 600000));
addPlan(scToken('scnet-token-flagship', 'Token Plan 旗舰版', 1274, 764, 1800000));

// 按量价（SCNet 明确无闲忙时定价，全时段按忙时价）
const scApi = (id, modelId, band, i, c, o, note) =>  addApi({ id, provider: '超算互联网 SCNet', modelId, band, currency: 'CNY', in: i, cache: c, out: o, note, source: SC_MAAS, verifiedAt: SCV });
scApi('scnet-api-v4flash', 'deepseek-v4-flash', '标准', 1, 0.2, 2);
scApi('scnet-api-v41flash', 'deepseek-v4-1-flash', '标准', 2, 0.04, 8);
scApi('scnet-api-v4pro', 'deepseek-v4-pro', '标准', 12, 1, 24);
scApi('scnet-api-v4pro0813', 'deepseek-v4-pro', '标准（Pro-0813）', 9, 0.9, 27);
scApi('scnet-api-glm53flash', 'glm-5.3-flash', '标准', 0.8, 0.23, 2.8);
scApi('scnet-api-glm53', 'glm-5.3', '标准', 8, 2, 28);
scApi('scnet-api-glm52', 'glm-5.2', '标准', 8, 2, 28);
scApi('scnet-api-k3', 'kimi-k3', '标准', 20, 2, 100);
scApi('scnet-api-k27code', 'kimi-k2.7-code', '标准', 6.5, 1.3, 27);
scApi('scnet-api-m3', 'minimax-m3', '标准', 4.2, 0.84, 16.8);
scApi('scnet-api-m27', 'minimax-m2.7', '标准', 2.1, 0.42, 8.4);
scApi('scnet-api-qwen38max', 'qwen3.8-max', '标准', 12, 1.5, 36);
scApi('scnet-api-qwen38flash', 'qwen3.8-flash', '标准', 0.8, 0.1, 2.7);

/* ---------------- 收紧「按请求计费」套餐的模型范围 ----------------
   之前用 models:"any"，会让它们出现在自己其实跑不了的模型下。
   范围按各家官方活动页/文档的模型清单写死。 */
const scope = (ids) => Object.fromEntries(ids.map((id) => [id, {}]));
const VOLC_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-1-flash',
  'deepseek-v4-pro',
  'glm-5.3',
  'glm-5.3-flash',
  'glm-5.2',
  'kimi-k3',
  'kimi-k2.7-code',
  'minimax-m3',
  'doubao-seed-evolving',
];
const ALI_CODING_MODELS = ['qwen3.8-max', 'qwen3.8-flash', 'qwen3-coder-next', 'glm-5.3', 'glm-5.2', 'kimi-k2.7-code', 'minimax-m3'];
for (const p of s.plans) {
  if (p.id === 'volc-coding-lite' || p.id === 'volc-coding-pro') p.models = scope(VOLC_MODELS);
  if (p.id === 'ali-coding-pro') p.models = scope(ALI_CODING_MODELS);
}

/* ---------------- 补齐/标注历史条目 ---------------- */
// Agent Plan Large 是 Medium 的更高档，模型范围应与 Medium 一致（Large 不该比 Medium 少模型）
const volcMedium = s.plans.find((p) => p.id === 'volc-agent-medium');
const volcLarge = s.plans.find((p) => p.id === 'volc-agent-large');
if (volcMedium && volcLarge) volcLarge.models = JSON.parse(JSON.stringify(volcMedium.models));

// Doubao-Seed-2.0-Code 官方已标「即将下线」，按量行保留但注明
const seedCode = s.apiPrices.find((a) => a.id === 'volc-api-seed20code');
if (seedCode) seedCode.note = '官方已标「即将下线」，新项目请用 Doubao-Seed-Evolving';

/* ---------------- 已下线的条目（保留在这里，避免被 upsert 重新加回来） ----------------
   SCNet Coding Plan：官方 FAQ 与订阅页当前只描述 Token Plan 四档，Coding Plan（Lite/Pro）已不可购买，
   用户已确认 Lite 停售 → 整条产品线从看板移除。 */
const REMOVED_PLANS = ['scnet-coding-lite', 'scnet-coding-pro'];
const before = s.plans.length;
s.plans = s.plans.filter((p) => !REMOVED_PLANS.includes(p.id));
if (before !== s.plans.length) console.log(`已移除下线套餐 ${before - s.plans.length} 个：${REMOVED_PLANS.join(', ')}`);

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`models=${s.models.length} apiPrices=${s.apiPrices.length} plans=${s.plans.length}`);
