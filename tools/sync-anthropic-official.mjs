// 同步 Anthropic 官方 API 价格
// 来源：https://platform.claude.com/docs/en/about-claude/pricing（本机无法直连 anthropic 域，经 Exa 的官方页快照核验，
// 与 docs.anthropic.com 数值一致）；2026-09-19 核验。
// 要点：无 >200K 长文加价；Batch 统一 5 折且可与缓存折扣叠加；Fast mode（Opus 5/4.8）$10/$50；数据驻留 us 1.1x。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const SRC = 'https://platform.claude.com/docs/en/about-claude/pricing';
const V = '2026-09-19';
const PROVIDER = 'Anthropic 官方';

const s = JSON.parse(await readFile(FILE, 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

// id, 输入, 缓存命中, 输出, 上下文, 备注
const ROWS = [
  ['claude-fable-5-1', 10, 0.25, 50, '1M', '当前最贵在售型号（2026-09-01 发布）；缓存命中按输入价 0.025× 计'],
  ['claude-fable-5', 10, 1.0, 50, '1M', '缓存命中 0.1×'],
  ['claude-opus-5', 5, 0.5, 25, '1M', '1M 窗口按标准价，无长文加价；Fast mode 另计 $10/$50'],
  ['claude-opus-4-8', 5, 0.5, 25, '1M', 'Fast mode 另计 $10/$50'],
  ['claude-opus-4-7', 5, 0.5, 25, '1M', ''],
  ['claude-opus-4-6', 5, 0.5, 25, '1M', ''],
  ['claude-opus-4-5', 5, 0.5, 25, '200K', '仅 200K 窗口'],
  ['claude-sonnet-5', 2, 0.2, 10, '1M', '原上市促销价已转为标准价（原定 2026-09-01 涨到 $3/$15 已取消）'],
  ['claude-sonnet-4-6', 3, 0.3, 15, '1M', ''],
  ['claude-sonnet-4-5', 3, 0.3, 15, '200K', '仅 200K 窗口'],
  ['claude-haiku-4-5', 1, 0.1, 5, '200K', '在售型号里单价最低'],
];

let added = 0;
for (const [modelId, inp, cache, out, ctx, extra] of ROWS) {
  const id = `anthropic-official-${modelId}`;
  const exists = s.apiPrices.some((a) => a.id === id);
  upsert(s.apiPrices, {
    id,
    provider: PROVIDER,
    modelId,
    band: '标准',
    currency: 'USD',
    in: inp,
    cache,
    out,
    cacheWrite: inp * 1.25,
    cacheWrite1h: inp * 2,
    note: `${extra ? extra + '；' : ''}上下文 ${ctx}；缓存写入 1.25×（5 分钟）/ 2×（1 小时）输入价；Batch 5 折可叠加缓存折扣`.replace(/^；/, ''),
    source: SRC,
    verifiedAt: V,
  });
  if (!exists) added++;
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`Anthropic 官方价写入 ${ROWS.length} 条（新增 ${added}）`);
for (const a of s.apiPrices.filter((x) => x.provider === PROVIDER)) {
  console.log(`  ${a.modelId.padEnd(22)} $${a.in} / $${a.cache} / $${a.out}`);
}
