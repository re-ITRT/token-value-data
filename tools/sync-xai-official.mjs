// 同步 xAI（Grok）官方 API 价格
// 来源：https://docs.x.ai/docs/pricing.md（官方文档的 Markdown 版，比渲染页可靠；2026-09-19 核验）
// 注意：Grok 4.6/4.5/Build 0.1 等有「长上下文加价」——prompt ≥200K 时整单按高价计费，这里取 <200K 档并在 note 说明。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const SRC = 'https://docs.x.ai/docs/pricing';
const V = '2026-09-19';
const PROVIDER = 'xAI 官方';

const s = JSON.parse(await readFile(FILE, 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};
const addModel = (id, name, note) => {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor: 'xAI', note: note || '' });
};

// id, 名称, 上下文, <200K 的输入/缓存/输出, ≥200K 的输入/缓存/输出
const ROWS = [
  ['grok-4.6', 'Grok 4.6', '500K', 2.0, 0.5, 6.0, 4.0, 1.0, 12.0],
  ['grok-4.5', 'Grok 4.5', '500K', 2.0, 0.3, 6.0, 4.0, 0.6, 12.0],
  ['grok-build-0.1', 'Grok Build 0.1', '256K', 1.0, 0.2, 2.0, 2.0, 0.4, 4.0],
  ['grok-4.3', 'Grok 4.3', '1M', 1.25, 0.2, 2.5, 2.5, 0.4, 5.0],
  ['grok-4.20-0309-reasoning', 'Grok 4.20 Reasoning', '1M', 1.25, 0.2, 2.5, 2.5, 0.4, 5.0],
  ['grok-4.20-0309-non-reasoning', 'Grok 4.20 (non-reasoning)', '1M', 1.25, 0.2, 2.5, 2.5, 0.4, 5.0],
  ['grok-4.20-multi-agent-0309', 'Grok 4.20 Multi-Agent', '1M', 1.25, 0.2, 2.5, 2.5, 0.4, 5.0],
];

let added = 0;
for (const [modelId, name, ctx, inp, cache, out, linp, lcache, lout] of ROWS) {
  addModel(modelId, name, `上下文 ${ctx}`);
  const id = `xai-official-${modelId}`;
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
    note: `上下文 ${ctx}；prompt ≥200K 时长上下文加价：$${linp} 输入 / $${lcache} 缓存 / $${lout} 输出（整单按高价计）`,
    source: SRC,
    verifiedAt: V,
  });
  if (!exists) added++;
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`xAI 官方价写入 ${ROWS.length} 条（新增 ${added}）`);
for (const a of s.apiPrices.filter((x) => x.provider === PROVIDER)) {
  console.log(`  ${a.modelId.padEnd(30)} $${a.in} / $${a.cache} / $${a.out}`);
}
