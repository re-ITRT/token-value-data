// 同步 OpenAI 官方 API 价格
// 来源：https://developers.openai.com/api/docs/pricing（platform.openai.com 被 Cloudflare 拦，403）
// 2026-09-19 核验。注意：>272K 输入时「整单」按长档计费；Batch/Flex 5 折；Fast mode 2x；缓存写入 1.25x 输入价。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const SRC = 'https://developers.openai.com/api/docs/pricing';
const V = '2026-09-19';
const PROVIDER = 'OpenAI 官方';

const s = JSON.parse(await readFile(FILE, 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

// id, 输入, 缓存命中, 输出, 长档(>272K) 输入/缓存/输出 或 null, 备注
const ROWS = [
  ['gpt-6-astra', 10, 1, 50, [20, 2, 75], '旗舰；上下文 1.05M'],
  ['gpt-5.6-sol', 4, 0.4, 20, [8, 0.8, 30], '促销价（原 $5/$30，官方承诺至少到 2026-11-21）'],
  ['gpt-5.6-terra', 2, 0.2, 12, [4, 0.4, 18], '2026-07-30 永久降价后价格'],
  ['gpt-5.6-luna', 0.2, 0.02, 1.2, [0.4, 0.04, 1.8], '官方在售最便宜型号'],
  ['gpt-5.5', 5, 0.5, 30, [10, 1, 45], '已从定价页撤下，仅模型页列价'],
  ['gpt-5.5-pro', 30, null, 180, null, '无缓存折扣'],
  ['gpt-5.4', 2.5, 0.25, 15, [5, 0.5, 22.5], '已从定价页撤下，仅模型页列价'],
  ['gpt-5.4-mini', 0.75, 0.075, 4.5, null, ''],
  ['gpt-5.4-nano', 0.2, 0.02, 1.25, null, ''],
  ['gpt-5.3-codex', 1.75, 0.175, 14, null, ''],
  ['gpt-5.2', 1.75, 0.175, 14, null, '已从定价页撤下，仅模型页列价'],
  ['gpt-5.1', 1.25, 0.125, 10, null, '已从定价页撤下，仅模型页列价'],
  ['gpt-5-nano', 0.05, 0.005, 0.4, null, '官方标注 2026-12-11 停服'],
];

let added = 0;
for (const [modelId, inp, cache, out, long, extra] of ROWS) {
  const id = `openai-official-${modelId}`;
  const exists = s.apiPrices.some((a) => a.id === id);
  const longNote = long ? `；prompt ≥272K 时整单按长档计费：$${long[0]} 输入 / $${long[1]} 缓存 / $${long[2]} 输出` : '';
  upsert(s.apiPrices, {
    id,
    provider: PROVIDER,
    modelId,
    band: '标准',
    currency: 'USD',
    in: inp,
    cache: cache ?? inp,
    out,
    promo: /促销/.test(extra) || undefined,
    promoNote: /促销/.test(extra) ? '限时促销价' : null,
    note: `${extra}${longNote}；Batch/Flex 5 折、Fast mode 2x、缓存写入 1.25×输入价`.replace(/^；/, ''),
    source: SRC,
    verifiedAt: V,
  });
  if (!exists) added++;
}

/* 已停服型号：不写官方价，只在模型上标明，避免看板推荐买不到的型号 */
const RETIRED = {
  'gpt-5.2-codex': '2026-07-23',
  'gpt-5.1-codex': '2026-07-23',
  'gpt-5.1-codex-max': '2026-07-23',
  'gpt-5.1-codex-mini': '2026-07-23',
};
for (const [id, date] of Object.entries(RETIRED)) {
  const m = s.models.find((x) => x.id === id);
  if (m) m.note = `OpenAI 官方已于 ${date} 停服，看板不给官方报价（第三方网关行可能已失效）`;
}
const sparkNote = 'gpt-5.3-codex-spark';
const spark = s.models.find((x) => x.id === sparkNote);
if (spark) spark.note = 'OpenAI 官方定价页无此型号（仅第三方网关标价）';

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`OpenAI 官方价写入 ${ROWS.length} 条（新增 ${added}）；标注停服型号 ${Object.keys(RETIRED).length} 个`);
for (const a of s.apiPrices.filter((x) => x.provider === PROVIDER)) {
  console.log(`  ${a.modelId.padEnd(22)} $${a.in} / $${a.cache} / $${a.out}${a.promo ? '  [促销]' : ''}`);
}
