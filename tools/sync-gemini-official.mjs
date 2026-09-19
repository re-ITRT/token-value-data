// 同步 Google Gemini 官方 API 价格（来源：ai.google.dev/gemini-api/docs/pricing，2026-09-19 核验）
// 注意：3.6/3.7/3.8 Flash 现在是「2026-12-31 前的优惠价」，2027-01-01 起翻倍 → 记成促销价并在 note 里写明。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const SRC = 'https://ai.google.dev/gemini-api/docs/pricing';
const V = '2026-09-19';
const PROVIDER = 'Google Gemini 官方';

const s = JSON.parse(await readFile(FILE, 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

// promo: 2026-12-31 前的价格（2027 起翻倍）
const PROMO_NOTE = '2026-12-31 前的优惠价；2027-01-01 起翻倍（输入 $1.50 / 输出 $7.50）';
const FREE_NOTE = '官方有免费层（Free of charge，含每分钟/每天限速），付费层价格见本条';

const ROWS = [
  // id, in, cache, out, promo, 备注
  ['gemini-3.8-flash', 0.75, 0.075, 3.75, true, PROMO_NOTE],
  ['gemini-3.7-flash', 0.75, 0.075, 3.75, true, PROMO_NOTE],
  ['gemini-3.6-flash', 0.75, 0.075, 3.75, true, PROMO_NOTE],
  ['gemini-3.5-flash', 1.5, 0.15, 9.0, false, FREE_NOTE],
  ['gemini-3.5-flash-lite', 0.3, 0.03, 2.5, false, `${FREE_NOTE}；输入按文本/图片/视频/音频同价 $0.30`],
  ['gemini-3.1-flash-lite', 0.25, 0.025, 1.5, false, `${FREE_NOTE}；输入文本/图片/视频 $0.25、音频 $0.50`],
  ['gemini-3.1-pro', 2.0, 0.2, 12.0, false, 'Gemini 3.1 Pro Preview：≤200K 输入 $2.00（文本/图片）、输出 $12.00（含思考）；>200K 翻倍为 $4.00/$18.00；无免费层'],
  ['gemini-3-flash', 0.5, 0.05, 3.0, false, 'Gemini 3 Flash Preview（legacy）：输入文/图/视 $0.50（音频 $1.00）、缓存 $0.05（音频 $0.10）、输出 $3.00；有免费层'],
  ['gemini-2.5-flash-lite', 0.1, 0.01, 0.4, false, 'Gemini 2.5 Flash-Lite：官方在售最便宜型号（输入 $0.10 / 输出 $0.40）；有免费层'],
];

const EXTRA_MODELS = [
  ['gemini-3-flash', 'Gemini 3 Flash Preview', 'Google', 'legacy 预览版'],
  ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', 'Google', '官方在售最便宜型号'],
];
for (const [id, name, vendor, note] of EXTRA_MODELS) {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor, note });
}

let added = 0;
for (const [modelId, inp, cache, out, promo, note] of ROWS) {
  const id = `google-gemini-${modelId}`;
  const exists = s.apiPrices.some((a) => a.id === id);
  upsert(s.apiPrices, {
    id,
    provider: PROVIDER,
    modelId,
    band: promo ? '优惠期' : '标准',
    currency: 'USD',
    in: inp,
    cache,
    out,
    promo: promo || undefined,
    promoNote: promo ? '2026-12-31 前' : null,
    note,
    source: SRC,
    verifiedAt: V,
  });
  if (!exists) added++;
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`Gemini 官方价写入 ${ROWS.length} 条（新增 ${added}）`);
for (const a of s.apiPrices.filter((x) => x.provider === PROVIDER)) {
  console.log(`  ${a.modelId.padEnd(24)} $${a.in} / $${a.cache} / $${a.out}${a.promo ? '  [优惠期]' : ''}`);
}
