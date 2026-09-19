// 给套餐补上「产品线」与「是否可重复购买」：
//   line      —— 同一条产品线同时只能订阅一档（档位是互斥的，不能 Small+Medium 一起买）
//   repeatable/maxCopies —— 官方允许在同一周期内叠加购买（如 SCNet：额度用完后可直接续费，无需等下一周期）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const LINES = [
  [/^cmdcode-/, 'cmdcode'],
  [/^ollama-/, 'ollama'],
  [/^volc-agent-/, 'volc-agent'],
  [/^volc-coding-/, 'volc-coding'],
  [/^ali-coding-/, 'ali-coding'],
  [/^ali-token-/, 'ali-token'],
  [/^baidu-token-/, 'baidu-token'],
  [/^tencent-hy-/, 'tencent-hy'],
  [/^tencent-token-/, 'tencent-token'],
  [/^scnet-token-/, 'scnet-token'],
  [/^glm-coding-/, 'zhipu-coding'],
  [/^mm-token-/, 'mm-token'],
  [/^mimo-token-/, 'mimo-token'],
  [/^opencode-go/, 'opencode-go'],
  [/^kimi-/, 'kimi-member'],
];

// 官方允许同周期叠加购买的（其余一律不可重复购买）
const REPEATABLE = {
  'scnet-token-basic': { maxCopies: 3, note: '官方 FAQ：额度用完后可直接续费，无需等下一周期' },
  'scnet-token-standard': { maxCopies: 3, note: '官方 FAQ：额度用完后可直接续费，无需等下一周期' },
  'scnet-token-advanced': { maxCopies: 3, note: '官方 FAQ：额度用完后可直接续费，无需等下一周期' },
  'scnet-token-flagship': { maxCopies: 3, note: '官方 FAQ：额度用完后可直接续费，无需等下一周期' },
};

for (const p of s.plans) {
  const hit = LINES.find(([re]) => re.test(p.id));
  p.line = hit ? hit[1] : p.id;
  const rep = REPEATABLE[p.id];
  if (rep) {
    p.repeatable = true;
    p.maxCopies = rep.maxCopies;
    p.repeatNote = rep.note;
  } else {
    delete p.repeatable;
    delete p.maxCopies;
    delete p.repeatNote;
  }
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

const byLine = new Map();
for (const p of s.plans) {
  if (!byLine.has(p.line)) byLine.set(p.line, []);
  byLine.get(p.line).push(p.name);
}
console.log('产品线（同线同时只能订阅一档）：');
for (const [line, names] of byLine) console.log(`  ${line.padEnd(15)} ${names.length} 档：${names.join(' / ')}`);
console.log('\n可重复购买：' + (s.plans.filter((p) => p.repeatable).map((p) => `${p.id}(≤${p.maxCopies})`).join(', ') || '无'));
