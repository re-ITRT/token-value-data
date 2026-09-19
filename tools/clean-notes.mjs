// 清掉 note 里的 markdown 标记（** 与反引号）——看板/后台是纯文本渲染，星号会原样显示出来
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const stripMd = (x) => (typeof x === 'string' ? x.replace(/\*\*/g, '').replace(/[`]/g, '') : x);

const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
let n = 0;
const fix = (obj, keys) => {
  for (const k of keys) if (typeof obj?.[k] === 'string') {
    const y = stripMd(obj[k]);
    if (y !== obj[k]) { obj[k] = y; n++; }
  }
};
for (const p of s.plans) {
  fix(p, ['note']);
  for (const v of p.priceVariants || []) fix(v, ['note']);
}
for (const a of s.apiPrices) fix(a, ['note', 'promoNote']);
for (const m of s.models) fix(m, ['note']);
await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');

const pay = JSON.parse(await readFile(path.join(DATA, 'payment.json'), 'utf8'));
let k = 0;
for (const key of Object.keys(pay.providers)) {
  const p = pay.providers[key];
  const y = stripMd(p.note);
  if (y !== p.note) { p.note = y; k++; }
}
await writeFile(path.join(DATA, 'payment.json'), JSON.stringify(pay, null, 2), 'utf8');

console.log(`清理 markdown 标记：sources ${n} 处、payment ${k} 处`);
const sample = s.plans.find((p) => p.id === 'supergrok');
console.log('样例（supergrok）:', sample.note.slice(0, 90));
