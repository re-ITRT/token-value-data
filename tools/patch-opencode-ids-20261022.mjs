// 收尾：OpenCode 渲染页带进来的 id 归一化（显式映射，绝不做模糊匹配）
// 上一版用「点→连字符」的通用规则，把不同模型互相合并了（184 → 65），这里改成白名单式重命名。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));

// 只重命名这些已知的「同一模型的另一种写法」
const RENAME = {
  'claude-fable-5.1': 'claude-fable-5-1',
  'claude-opus-4.8': 'claude-opus-4-8',
  'claude-opus-4.7': 'claude-opus-4-7',
  'claude-opus-4.6': 'claude-opus-4-6',
  'claude-opus-4.5': 'claude-opus-4-5',
  'claude-sonnet-4.6': 'claude-sonnet-4-6',
  'claude-sonnet-4.5': 'claude-sonnet-4-5',
  'claude-haiku-4.5': 'claude-haiku-4-5',
  'qwen3.7-max': 'qwen-3.7-max',
  'deepseek-v4.1-flash': 'deepseek-v4-1-flash',
  'minimax-m3.1-flash': 'minimax-m3-1-flash',
  'nemotron-3.5-super-vl': 'nemotron-3-5-super-vl',
  'typesafe/jev-1.14.0': 'typesafe/jev-1-14-0',
};
const VENDOR_GUESS = {
  'gemini-4-argon-contributor': 'Google',
  'gemini-4-argon': 'Google',
  beam: '其他',
  'flint-40b': '其他',
  'minimax-m3-1-flash': 'MiniMax',
  'nemotron-3-5-super-vl': 'NVIDIA',
  ornith: 'Ornith',
};
const existing = new Set(s.models.map((m) => m.id));
let renamed = 0;
let merged = 0;

function remapId(from, to) {
  for (const a of s.apiPrices) {
    if (a.modelId !== from) continue;
    a.modelId = to;
    if (String(a.id).includes(from)) a.id = String(a.id).replace(from, to);
  }
  for (const p of s.plans) {
    if (p.models && p.models[from]) {
      if (!p.models[to]) p.models[to] = p.models[from];
      delete p.models[from];
    }
  }
}

// 1) 显式重命名（目标已存在则合并）
for (const [from, to] of Object.entries(RENAME)) {
  const m = s.models.find((x) => x.id === from);
  if (!m) continue;
  remapId(from, to);
  if (existing.has(to)) {
    s.models = s.models.filter((x) => x.id !== from);
    merged++;
  } else {
    m.id = to;
    existing.add(to);
    renamed++;
  }
}

// 2) 「-free」后缀：并回本体
for (const m of [...s.models]) {
  if (!/-free$/.test(m.id)) continue;
  let base = m.id.replace(/-free$/, '');
  base = RENAME[base] || base;
  if (!existing.has(base)) { m.id = base; existing.add(base); continue; } // 没有本体 → 去掉 -free 独立成条
  remapId(m.id, base);
  for (const a of s.apiPrices) if (a.modelId === base) a.source = a.source || 'https://opencode.ai/docs/zen';
  s.models = s.models.filter((x) => x.id !== m.id);
  merged++;
}

// 3) 补厂商（只补空的）
let fixed = 0;
for (const m of s.models) {
  if (m.vendor) continue;
  const v = VENDOR_GUESS[m.id];
  if (v) {
    m.vendor = v;
    fixed++;
  }
}

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
console.log(`重命名 ${renamed} 个、合并 ${merged} 个、补厂商 ${fixed} 个`);
console.log(`目录：模型 ${s.models.length}｜按量价 ${s.apiPrices.length}｜套餐 ${s.plans.length}`);
const noVendor = s.models.filter((m) => !m.vendor).map((m) => m.id);
console.log('无厂商：' + (noVendor.length ? noVendor.join(', ') : '无'));
