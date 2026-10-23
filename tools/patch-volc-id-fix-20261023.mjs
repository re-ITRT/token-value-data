// 修正火山 Agent Plan 的模型 id 对不上的问题 + 补两个缺失的豆包模型 + 标注 DeepSeek V4.1-Flash-1017
// 背景：昨日补丁里把 v4.1 写成了带点的 `deepseek-v4.1-flash`，而目录里是 `deepseek-v4-1-flash`，
// 导致看板上这个热门模型完全看不到火山方舟的条目。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));

// 1) 修 id
let fixed = 0;
for (const p of s.plans.filter((x) => /^volc-agent/.test(x.id))) {
  if (p.models['deepseek-v4.1-flash']) {
    p.models['deepseek-v4-1-flash'] = p.models['deepseek-v4.1-flash'];
    delete p.models['deepseek-v4.1-flash'];
    fixed++;
  }
}

// 2) 补缺失的模型目录项（火山自己的模型）
const ADD = {
  'doubao-seed-2.0-mini': ['Doubao Seed 2.0 Mini', '字节', '火山 Agent Plan 系数 0.25（音频 2.5）'],
  'doubao-embedding-vision': ['Doubao Embedding Vision', '字节', '火山 Agent Plan 系数 0.5（向量模型，禁 API 调用）'],
};
for (const [id, [name, vendor, note]] of Object.entries(ADD)) {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor, note });
}

// 3) DeepSeek V4.1 Flash：标注官方已切换到 1017 版本（价格未变）
const dsv = s.models.find((m) => m.id === 'deepseek-v4-1-flash');
if (dsv) {
  dsv.name = 'DeepSeek V4.1 Flash 1017';
  dsv.note =
    '官方 2026-10-17 将 API 模型切换为 **V4.1-Flash-1017**（权重已开源），价格未变：' +
    '空闲时段 ¥1 / ¥0.02 / ¥4（未命中/命中/输出，每百万 token），高峰时段 ×2。' +
    '各厂商均以「latest」跟随该版本。新增 Search / Fetch 接口 5 元/千次（2026-11-01 00:00 起计费）。';
}
// 官方那一行的价格锚点（CNY 直接来自官方页，避免汇率换算误差）
for (const a of s.apiPrices.filter((a) => a.modelId === 'deepseek-v4-1-flash' && /DeepSeek 官方/.test(a.provider))) {
  a.note = (a.note ? a.note + '｜' : '') + '官方页标注 V4.1-Flash-1017（2026-10-17）';
}

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
console.log(`火山 id 修正 ${fixed} 处；补模型 ${Object.keys(ADD).length} 个`);
const ids = new Set(s.models.map((m) => m.id));
for (const p of s.plans.filter((x) => /^volc-agent/.test(x.id))) {
  const bad = Object.keys(p.models).filter((k) => !ids.has(k));
  console.log('  ' + p.id.padEnd(20) + ' 模型 ' + Object.keys(p.models).length + ' 个，未匹配目录: ' + (bad.length ? bad.join(', ') : '无'));
}
