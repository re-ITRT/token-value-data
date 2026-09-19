// 从 opencode 文档源（go.mdx / zen.mdx）里抽表：Go 套餐的每模型月度额度与单价、Zen 按量单价与免费模型
import { readFile } from 'node:fs/promises';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法: node parse-opencode-docs.mjs <go.mdx> <zen.mdx>');
  process.exit(1);
}

const parseRows = (text, startMarker) => {
  const i = text.indexOf(startMarker);
  if (i < 0) return [];
  const rows = [];
  for (const line of text.slice(i).split('\n')) {
    const t = line.trim();
    if (t.startsWith('|')) {
      const cells = t.split('|').slice(1, -1).map((c) => c.replace(/\*\*/g, '').trim());
      if (cells.length >= 4 && !/^-+$/.test(cells[1])) rows.push(cells);
    } else if (rows.length && !t.startsWith('|') && t && !t.startsWith('#')) break;
  }
  return rows;
};

for (const f of files) {
  const text = await readFile(f, 'utf8');
  const isGo = /go\.mdx$/.test(f);
  console.log(`\n===== ${f} =====`);
  const rows = parseRows(text, isGo ? '| Model' : '| Model');
  console.log(`表头: ${rows[0]?.join(' | ')}`);
  let n = 0;
  for (const r of rows.slice(1)) {
    if (isGo && r[0] && /^\$/.test(r[5] || '')) {
      console.log(`  ${r[0].padEnd(34)} in=${r[1]} out=${r[2]} cache=${r[3]} 月额度=${r[5]}`);
      n++;
    } else if (!isGo && /^\$|Free/.test(r[1] || '')) {
      console.log(`  ${r[0].padEnd(34)} in=${r[1]} out=${r[2]} cache=${r[3]}`);
      n++;
    }
  }
  console.log(`  （${n} 行）`);
  const pay = text.split('\n').filter((l) => /支付宝|微信|Alipay|WeChat|UnionPay|payment|Payment|credit card|Credit card|billing|Billing/.test(l));
  console.log('  支付相关行：');
  for (const p of pay.slice(0, 8)) console.log('    ' + p.trim().slice(0, 150));
}
