// 审计：找出「换模型后每¥1 token 数完全不变」的行，确认它们是设计如此还是算错了
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const fx = JSON.parse(await readFile(path.join(DATA, 'fx.json'), 'utf8'));
const rate = fx.USDCNY;
const R = { fi: 57 / 915, fc: 840 / 915, fo: 18 / 915 };
const perReq = (s.tokensPerRequestDefaultM ?? 0.3) * 1e6;

const map = new Map();
const add = (key, meta, model, val) => {
  if (!map.has(key)) map.set(key, { ...meta, vals: new Map() });
  map.get(key).vals.set(model, val);
};

for (const model of s.models.map((m) => m.id)) {
  for (const a of s.apiPrices.filter((x) => x.modelId === model)) {
    if (a.free) continue;
    const cur = a.currency === 'USD' ? rate : 1;
    const cnyPerM = (R.fi * a.in + R.fc * (a.cache ?? a.in) + R.fo * a.out) * cur;
    add(`api|${a.provider}|${a.band}`, { kind: 'api', provider: a.provider, plan: '按量', band: a.band, why: '单价表' }, model, 1e6 / cnyPerM);
  }
  for (const p of s.plans) {
    if (p.kind === 'uncomputable') continue;
    const spec = p.models === 'any' ? {} : p.models[model];
    if (!spec) continue;
    for (const pv of p.priceVariants) {
      const priceCny = pv.amount * (p.currency === 'USD' ? rate : 1);
      if (p.kind === 'requests') {
        add(`sub|${p.id}|${pv.id}`, { kind: 'sub', provider: p.provider, plan: p.name, variant: pv.label, why: `按请求计费：quota=${p.quota}${p.quotaUnit} × ${perReq / 1e6}M/次` }, model, (p.quota * perReq) / priceCny);
        continue;
      }
      const quota = spec.quotaOverride ?? p.quota;
      for (const band of spec.bands ?? [null]) {
        const mult = band?.mult ?? 1;
        const upm = (R.fi * spec.u.input + R.fc * spec.u.cache + R.fo * spec.u.output) * mult;
        add(`sub|${p.id}|${pv.id}|${band?.id ?? 'base'}`, { kind: 'sub', provider: p.provider, plan: p.name, variant: pv.label, band: band?.label ?? '', why: `quota=${quota} / ${upm.toFixed(1)} 单位每百万 token` }, model, (quota / upm) * 1e6 / priceCny);
      }
    }
  }
}

const rows = [...map.values()];
const indep = rows.filter((r) => r.vals.size > 3 && new Set([...r.vals.values()].map((v) => v.toFixed(4))).size === 1);
const dep = rows.filter((r) => r.vals.size > 3 && new Set([...r.vals.values()].map((v) => v.toFixed(4))).size > 1);

console.log(`总行数 ${rows.length}｜随模型变化 ${dep.length}｜换模型不变 ${indep.length}\n`);
console.log('=== 换模型后数值不变的行 ===');
for (const r of indep) {
  const v = [...r.vals.values()][0];
  console.log(`  ${(r.provider + ' · ' + r.plan + (r.variant ? ' · ' + r.variant : '') + (r.band ? ' · ' + r.band : '')).padEnd(58)} 每¥1 ${(v / 1e4).toFixed(0)} 万 token ｜ ${r.why}`);
}
console.log('\n=== 抽查：同一套餐跨模型的数值差（前 6 个套餐）===');
const byPlan = new Map();
for (const r of dep) {
  if (!byPlan.has(r.plan)) byPlan.set(r.plan, []);
  byPlan.get(r.plan).push(r);
}
let n = 0;
for (const [plan, rs] of byPlan) {
  if (n++ >= 6) break;
  const all = rs.flatMap((r) => [...r.vals.values()]);
  console.log(`  ${plan.padEnd(34)} 最小 ${(Math.min(...all) / 1e4).toFixed(0)} 万 ～ 最大 ${(Math.max(...all) / 1e4).toFixed(0)} 万`);
}
