// 对比官方页当前的模型数据与本目录里的数据，列出差异（用于「官网有变动」后的人工核对）
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = 'https://commandcode.ai/docs/resources/pricing-limits';
async function fetchCommandCodeModels() {
  const res = await fetch(SRC, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } });
  const html = await res.text();
  const un = html.replace(/\\"/g, '"').replace(/\\u0026/g, '&').replace(/\\n/g, ' ');
  const start = un.indexOf('{"id":"deepseek-v4-flash"');
  if (start < 0) throw new Error('未找到模型 JSON');
  const arrStart = un.lastIndexOf('[', start);
  let depth = 0, end = -1;
  for (let i = arrStart; i < un.length; i++) {
    const ch = un[i];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return JSON.parse(un.slice(arrStart, end));
}


const s = JSON.parse(await readFile(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8'));
const live = await fetchCommandCodeModels();
const ID_MAP = {
  'deepseek-v4.1-flash': 'deepseek-v4-1-flash',
  'qwen-3.8-max': 'qwen3.8-max',
  'qwen-3.8-flash': 'qwen3.8-flash',
  'qwen-3.8-27b': 'qwen3.8-27b',
  'tencent/hy3-paid': 'hunyuan-hy3',
  'tencent/hy4-preview': 'hunyuan-hy4-preview',
};

let priceDiff = 0, allowDiff = 0, missing = 0;
for (const m of live) {
  const id = ID_MAP[m.id] || m.id;
  const mine = s.apiPrices.find((a) => a.id === `cc-api-${id}`);
  if (!mine) { console.log(`[缺按量行] ${id}`); missing++; continue; }
  const same = mine.in === m.inputCost && mine.out === m.outputCost && mine.cache === m.cacheReadCost;
  if (!same) {
    console.log(`[单价变化] ${id}: 目录 $${mine.in}/$${mine.cache}/$${mine.out} → 官方 $${m.inputCost}/$${m.cacheReadCost}/$${m.outputCost}`);
    priceDiff++;
  }
  const goat = s.plans.find((p) => p.id === 'cmdcode-goat')?.models?.[id];
  const a = goat?.quotaOverride;
  if (a !== m.planAllowanceUsd?.goat) {
    console.log(`[额度变化] ${id}: 目录 goat=$${a} → 官方 $${m.planAllowanceUsd?.goat}`);
    allowDiff++;
  }
}
console.log(`\n模型总数 ${live.length}｜单价变化 ${priceDiff}｜额度变化 ${allowDiff}｜新增未收录 ${missing}`);
if (!priceDiff && !allowDiff && !missing) console.log('✅ 与官方一致，无需改动');
