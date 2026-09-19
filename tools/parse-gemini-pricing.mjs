// 从已下载的 Gemini 定价页文本里，按模型抽出「输入 / 输出 / 缓存 / 免费层」四行
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
const html = await readFile(file, 'utf8');
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{2,}/g, '\n');
const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

const MODELS = [
  ['gemini-3.8-flash', 'Gemini 3.8 Flash'],
  ['gemini-3.7-flash', 'Gemini 3.7 Flash'],
  ['gemini-3.6-flash', 'Gemini 3.6 Flash'],
  ['gemini-3.5-flash', 'Gemini 3.5 Flash'],
  ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite'],
  ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite'],
  ['gemini-3.1-pro', 'Gemini 3.1 Pro'],
  ['gemini-3-flash', 'Gemini 3 Flash'],
];

for (const [id, name] of MODELS) {
  // 找到「模型名 + id」这一对出现的位置（定价区块的特征）
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === id && lines[i - 1] === name) { at = i; break; }
  }
  if (at < 0) {
    for (let i = 0; i < lines.length; i++) if (lines[i] === name) { at = i; break; }
  }
  console.log(`\n===== ${id} (${name}) ${at < 0 ? '未找到' : ''} =====`);
  if (at < 0) continue;
  const block = lines.slice(at, at + 46);
  for (const l of block) {
    if (/price|Free|tier|tokens|Free of charge|\$|caching|Batch|Standard/i.test(l)) console.log('  ' + l.slice(0, 110));
  }
}
