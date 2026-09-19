// 解析已下载到本地的官方定价页（PowerShell 抓的 HTML），抽模型价格行
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
const kws = process.argv.slice(3);
const html = await readFile(file, 'utf8');
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{2,}/g, '\n');

console.log(`${file}: HTML ${html.length} 字节 → 文本 ${text.length}`);
const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

for (const kw of kws) {
  const hits = [];
  lines.forEach((l, i) => {
    if (l.toLowerCase().includes(kw.toLowerCase())) hits.push(`L${i}: ${l.slice(0, 150)}`);
  });
  console.log(`\n=== 含「${kw}」的行（${hits.length}）===`);
  for (const h of hits.slice(0, 12)) console.log('  ' + h);
}

// 附：表格形态的抓取（同一行的多个格子会被拆成连续行，这里把价格附近的窗口打出来）
const priceIdx = lines.findIndex((l) => /\$\s?\d/.test(l));
if (priceIdx >= 0) {
  console.log('\n=== 第一处价格附近的 40 行 ===');
  for (const l of lines.slice(Math.max(0, priceIdx - 12), priceIdx + 40)) console.log('  ' + l.slice(0, 120));
}
