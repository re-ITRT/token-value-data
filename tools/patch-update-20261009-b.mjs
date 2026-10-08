// 2026-10-09 更新（二）：OpenAI 与 Anthropic 新增模型
// 来源：developers.openai.com/api/docs/pricing（本站直接抓取核对过 4 列：输入/缓存命中/缓存写入/输出）
//       platform.claude.com/docs/en/about-claude/pricing（本机无法直连，经官方页快照核验）
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

/* ---------------- OpenAI ---------------- */
const OA = 'https://developers.openai.com/api/docs/pricing';
const OA_ROWS = [
  // id, 名称, 输入, 缓存命中, 输出, 长档(>272K) 输入/缓存/输出, 备注
  ['gpt-6.1-sol', 'GPT-6.1 Sol', 2, 0.1, 10, [4, 0.2, 15], '2026-09 新增；缓存写入 $2.50'],
  ['gpt-6-luna', 'GPT-6 Luna', 0.1, 0.01, 0.5, [0.2, 0.02, 0.75], '2026-09 新增；缓存写入 $0.125'],
  ['gpt-5.6-cyber', 'GPT-5.6 Cyber', 12.5, 1.25, 75, null, '新「Cyber」品类；缓存写入 $15.625'],
];
for (const [id, name, inp, cache, out, long, extra] of OA_ROWS) {
  addModel(id, name, 'OpenAI', '');
  const longNote = long ? `；prompt ≥272K 时整单按长档计费：$${long[0]} 输入 / $${long[1]} 缓存 / $${long[2]} 输出` : '';
  upsert(s.apiPrices, {
    id: `openai-official-${id}`, provider: 'OpenAI 官方', modelId: id, band: '标准', currency: 'USD',
    in: inp, cache, out,
    note: `${extra}${longNote}；Batch/Flex 5 折、Fast mode 2x；区域数据驻留与 FedRAMP 端点 +10%`.replace(/^；/, ''),
    source: OA, verifiedAt: V,
  });
}
// gpt-5.6-sol 归入 Cyber 品类并延长促销
const solRow = s.apiPrices.find((a) => a.id === 'openai-official-gpt-5.6-sol');
if (solRow) {
  solRow.note = '促销价（原 $5/$30），官方承诺至少延续至 2026-11-21；已归入新 Cyber/Daybreak 品类';
  solRow.promoNote = '促销至 2026-11-21';
}

/* ---------------- Anthropic ---------------- */
const AN = 'https://platform.claude.com/docs/en/about-claude/pricing';
const AN_ROWS = [
  // id, 名称, 输入, 缓存命中, 输出, 缓存命中倍率说明, 备注
  ['claude-opus-5-5', 'Claude Opus 5.5', 4, 0.2, 20, '0.05×', '2026-09/10 新增'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 2, 0.1, 10, '0.05×', '2026-09/10 新增'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5', 0.1, 0.01, 0.5, '0.1×', '首个按上下文分档的 Claude：≤100K 取本行；>100K 跳到 $0.50/$0.05/$2.50（5×）'],
  ['claude-mythos-5-1', 'Claude Mythos 5.1', 10, 0.25, 50, '0.025×', '限量可用（limited availability）'],
  ['claude-mythos-5', 'Claude Mythos 5', 10, 1, 50, '0.1×', '限量可用（limited availability）'],
];
for (const [id, name, inp, cache, out, mult, extra] of AN_ROWS) {
  addModel(id, name, 'Anthropic', '');
  upsert(s.apiPrices, {
    id: `anthropic-official-${id}`, provider: 'Anthropic 官方', modelId: id, band: '标准', currency: 'USD',
    in: inp, cache, out, cacheWrite: +(inp * 1.25).toFixed(4), cacheWrite1h: inp * 2,
    note: `${extra}；缓存命中倍率 ${mult}（其余模型 0.1×）；缓存写入 1.25×/2× 输入价；Batch 5 折可叠加缓存折扣；US-only 推理 +10%`,
    source: AN, verifiedAt: V,
  });
}
// Sonnet 5 转正
const s5 = s.apiPrices.find((a) => a.id === 'anthropic-official-claude-sonnet-5');
if (s5) s5.note = '原上市促销价已转为永久标准价（原定 2026-09-01 涨到 $3/$15 已取消）；缓存写入 1.25×（5 分钟）/ 2×（1 小时）输入价；Batch 5 折可叠加缓存折扣；US-only 推理 +10%';

/* ---------------- Ollama 带出来的新模型归到各自厂商 ---------------- */
const VENDOR_FIX = { 'gemma4': 'Google', 'gpt-oss-120b': 'OpenAI', 'gpt-oss-20b': 'OpenAI' };
for (const [id, vendor] of Object.entries(VENDOR_FIX)) {
  const m = s.models.find((x) => x.id === id);
  if (m) m.vendor = vendor;
}

/* ---------------- Kimi 会员：补月付价 ---------------- */
const KIMI_MONTHLY = { 'kimi-go': 49, 'kimi-plus': 99, 'kimi-pro': 199, 'kimi-max': 699 };
for (const [id, monthly] of Object.entries(KIMI_MONTHLY)) {
  const p = s.plans.find((x) => x.id === id);
  if (!p) continue;
  p.priceVariants = p.priceVariants.filter((v) => v.id !== 'monthly');
  p.priceVariants.push({ id: 'monthly', label: '月付', amount: monthly });
  p.priceVariants.sort((a, b) => Number(a.id === 'list') - Number(b.id === 'list'));
}

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
console.log(`OpenAI 新增 ${OA_ROWS.length} 个模型；Anthropic 新增 ${AN_ROWS.length} 个模型`);
console.log('模型总数 ' + s.models.length + '｜按量价 ' + s.apiPrices.length + '｜套餐 ' + s.plans.length);
