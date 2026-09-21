// Command Code 支持支付宝（用户 2026-09-21 实测确认）→ 支付标注从 cn:false 改为 cn:true
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'payment.json');
const pay = JSON.parse(await readFile(FILE, 'utf8'));

const NOTE =
  '支持支付宝（用户实测确认，Stripe 结账可选 Alipay；官方文档只写了信用卡手续费 4.4% + $0.30 按成本转嫁，未提支付宝）。' +
  '不支持微信支付与境内银联；订阅额度只能在它家 CLI 里用，Provider API 才可自建 harness。';

for (const key of ['Command Code', 'Command Code Provider API']) {
  const before = pay.providers[key];
  pay.providers[key] = { cn: true, methods: ['支付宝'], note: NOTE };
  console.log(`${key}: cn ${before?.cn} → true，方式 ${before?.methods?.join('/')} → 支付宝`);
}

await writeFile(FILE, JSON.stringify(pay, null, 2), 'utf8');
const cn = Object.entries(pay.providers).filter(([, v]) => v.cn).map(([k]) => k);
console.log(`\n现在支持中国支付的渠道（${cn.length}）：${cn.join('、')}`);
