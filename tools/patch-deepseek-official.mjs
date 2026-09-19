// 补齐 DeepSeek 官方的按量价：
//   官方当前在售的模型名是 deepseek-flash（= DeepSeek-V4.1-Flash），
//   旧名 deepseek-v4-flash / deepseek-v4-flash-vision-exp 仍可调用，但按 Flash 价计费。
//   来源：https://api-docs.deepseek.com/quick_start/pricing（2026-09-19 核验）
//   谷时 $0.15 / $0.003 / $0.60（每百万 token），峰时为谷时 2 倍；峰时段见 peakRule。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const SRC = 'https://api-docs.deepseek.com/quick_start/pricing';
const V = '2026-09-19';
const RULE = { tz: 'UTC', days: [1, 2, 3, 4, 5], ranges: [[1, 4], [6, 10]], note: 'UTC 周一至五 01–04、06–10（北京 09–12、14–18）' };

const s = JSON.parse(await readFile(FILE, 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

// 现行名 + 两个仍被接受的旧名，价格一致（官方说明：旧名请求由 V4.1-Flash 承接，按 Flash 价计费）
// 已有官方行的不再重复添加（v4-flash 本来就有一对谷/峰行）
const TARGETS = [
  ['deepseek-v4-1-flash', 'deepseek-flash（= DeepSeek-V4.1-Flash）：官方当前在售模型'],
  ['deepseek-v4-flash-vision-exp', '旧模型名，官方已由 V4.1-Flash 承接，按 Flash 价计费'],
].filter(([mid]) => !s.apiPrices.some((a) => a.provider === 'DeepSeek 官方' && a.modelId === mid));

let added = 0;
for (const [modelId, why] of TARGETS) {
  for (const [suffix, band, slot, price, mult] of [
    ['off', '谷时', 'offpeak', { in: 0.15, cache: 0.003, out: 0.6 }, 1],
    ['peak', '峰时', 'peak', { in: 0.3, cache: 0.006, out: 1.2 }, 2],
  ]) {
    const id = `deepseek-official-${modelId}-${suffix}`;
    const exists = s.apiPrices.some((a) => a.id === id);
    upsert(s.apiPrices, {
      id,
      provider: 'DeepSeek 官方',
      modelId,
      band,
      slot,
      peakRule: RULE,
      currency: 'USD',
      in: price.in,
      cache: price.cache,
      out: price.out,
      promo: suffix === 'off',
      promoNote: `峰时 ×${mult}（$${price.in * mult} / $${price.cache * mult} / $${price.out * mult}）`,
      note: `${why}；${band}价 $${price.in} 输入 / $${price.cache} 缓存 / $${price.out} 输出（每百万 token）`,
      source: SRC,
      verifiedAt: V,
    });
    if (!exists) added++;
  }
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`DeepSeek 官方价补齐：新增 ${added} 行`);
for (const a of s.apiPrices.filter((x) => x.provider === 'DeepSeek 官方')) {
  console.log(`  ${a.modelId.padEnd(30)}${a.band}  $${a.in} / $${a.cache} / $${a.out}`);
}
