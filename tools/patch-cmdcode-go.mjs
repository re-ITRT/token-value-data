// Command Code Go 的 $1 是官方入门体验价（$1/月 → $10 额度，10× 杠杆），
// 按用户要求标记为「优惠」而不是标准价：把价格变体的 id 从 list 改成 promo 即可。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const go = s.plans.find((p) => p.id === 'cmdcode-go');
if (!go) throw new Error('找不到 cmdcode-go');

go.priceVariants = [
  {
    id: 'promo', // 非 list → 看板会打「优惠」标记，购买推荐里按促销价处理
    label: '体验价',
    amount: 1,
    note: '官方定位为入门体验价：$1/月 换 $10 额度（10× 杠杆）；额度只能在它家 CLI 里用，不含 API 权限',
  },
];
go.note = go.note.replace(/\s*｜\$?1?\s*为体验价（非常规刊例价）/, '') + '｜$1 为体验价（非常规刊例价）';

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log('cmdcode-go 价格变体：', JSON.stringify(go.priceVariants[0]));
console.log('套餐说明：', go.note);
