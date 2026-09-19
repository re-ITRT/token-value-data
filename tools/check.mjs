// 换算自检：对指定模型打印每 1 RMB 的 token 数排名
// 用法: node tools/check.mjs [modelId] [ratioIn:cache:out]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');

const modelId = process.argv[2] || 'deepseek-v4-flash';
const [ri, rc, ro] = (process.argv[3] || '57:840:18').split(':').map(Number);
const t = ri + rc + ro;
const R = { fi: ri / t, fc: rc / t, fo: ro / t };

const sources = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const fx = JSON.parse(await readFile(path.join(DATA, 'fx.json'), 'utf8'));
const rate = fx.USDCNY;
const perReq = (sources.tokensPerRequestDefaultM ?? 0.3) * 1e6;

const fmt = (n) => (n >= 1e8 ? (n / 1e8).toFixed(2) + ' 亿' : (n / 1e4).toFixed(0) + ' 万');
const rows = [];

for (const a of sources.apiPrices.filter((x) => x.modelId === modelId)) {
  const cur = a.currency === 'USD' ? rate : 1;
  const cnyPerM = (R.fi * a.in + R.fc * (a.cache ?? a.in) + R.fo * a.out) * cur;
  rows.push({ label: `${a.provider} · 按量 ${a.band}`, price: '按量', perRMB: 1e6 / cnyPerM, monthly: null });
}

for (const p of sources.plans) {
  if (p.kind === 'uncomputable') continue;
  const anyModel = p.models === 'any';
  const spec = anyModel ? {} : p.models?.[modelId];
  if (!anyModel && !spec) continue;
  for (const pv of p.priceVariants) {
    const priceCny = pv.amount * (p.currency === 'USD' ? rate : 1);
    if (p.kind === 'requests') {
      const tokens = p.quota * perReq;
      rows.push({ label: `${p.provider} · ${p.name} · ${pv.label}`, price: `¥${priceCny.toFixed(1)}`, perRMB: tokens / priceCny, monthly: tokens });
      continue;
    }
    const quota = spec.quotaOverride ?? p.quota;
    for (const band of spec.bands ?? [null]) {
      const mult = band?.mult ?? 1;
      const unitsPerM = (R.fi * spec.u.input + R.fc * spec.u.cache + R.fo * spec.u.output) * mult;
      const tokens = (quota / unitsPerM) * 1e6;
      rows.push({
        label: `${p.provider} · ${p.name} · ${pv.label}${band ? ' · ' + band.label : ''}`,
        price: `¥${priceCny.toFixed(1)}`,
        perRMB: tokens / priceCny,
        monthly: tokens,
      });
    }
  }
}

rows.sort((a, b) => b.perRMB - a.perRMB);
console.log(`模型 ${modelId} · 比例 ${ri}:${rc}:${ro} · USD/CNY ${rate} · 每次请求 ${perReq} token\n`);
console.log('  每¥1 token 数     月额度         月费      条目');
for (const r of rows) {
  console.log(
    `  ${fmt(r.perRMB).padStart(10)}   ${(r.monthly ? fmt(r.monthly) : '—').padStart(10)}   ${r.price.padStart(8)}   ${r.label}`,
  );
}
