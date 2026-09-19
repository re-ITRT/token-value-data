// 审计：每个模型有哪些「按量」来源，重点找「厂商官方的按量价缺席」的模型
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(await readFile(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8'));

// 厂商 → 自家官方按量 provider 名（用来判断「官方价是否缺席」）
const OFFICIAL = {
  DeepSeek: ['DeepSeek 官方'],
  智谱: ['智谱 BigModel API'],
  Zhipu: ['智谱 BigModel API'],
  月之暗面: ['Kimi API（国内）'],
  MiniMax: ['MiniMax API（国内）'],
  小米: ['小米 MiMo API（国内）'],
  字节: ['火山方舟 API'],
  腾讯: ['腾讯混元 API'],
  百度: ['百度千帆 API'],
  阿里: ['阿里百炼 API'],
  OpenAI: ['OpenAI 官方'],
  Anthropic: ['Anthropic 官方'],
  Google: ['Google Gemini 官方'],
  xAI: ['xAI 官方'],
};

const providersOf = (modelId) => {
  const list = [...new Set(s.apiPrices.filter((a) => a.modelId === modelId).map((a) => a.provider))];
  return list;
};

let missingOfficial = [];
let noApiAtAll = [];
for (const m of s.models) {
  const provs = providersOf(m.id);
  if (!provs.length) { noApiAtAll.push(m); continue; }
  const official = OFFICIAL[m.vendor] || [];
  if (official.length && !official.some((o) => provs.includes(o))) {
    missingOfficial.push({ id: m.id, name: m.name, vendor: m.vendor, has: provs });
  }
}

console.log(`模型总数 ${s.models.length}｜有按量价 ${s.models.length - noApiAtAll.length}｜一条按量价都没有 ${noApiAtAll.length}`);
console.log(`\n=== 有官方按量渠道、但这个模型缺官方价（${missingOfficial.length} 个）===`);
for (const x of missingOfficial) {
  console.log(`  ${x.id.padEnd(30)} ${String(x.name).padEnd(24)} 现有: ${x.has.join(', ')}`);
}
console.log(`\n=== 完全没有按量价的模型（${noApiAtAll.length} 个）===`);
for (const m of noApiAtAll) console.log(`  ${m.id.padEnd(30)} ${String(m.name).padEnd(24)} ${m.vendor}`);

console.log('\n=== 各家官方按量覆盖了哪些模型 ===');
for (const [vendor, provs] of Object.entries(OFFICIAL)) {
  for (const p of provs) {
    const ids = [...new Set(s.apiPrices.filter((a) => a.provider === p).map((a) => a.modelId))];
    if (ids.length) console.log(`  ${p.padEnd(22)} ${ids.length} 个: ${ids.join(', ')}`);
  }
}
