// 对 OpenCode 同步结果做补充修正（可重复跑）：
//   1) 官方表格用 ~~$15~~ **$60** 表示促销价 —— 取数要取促销值
//   2) v2 控制台里另列的免费模型（官方文档未列）
//   3) 套餐触顶行为与支付方式说明（支付证据来自 2026-09-19 的浏览器核验）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC_ZEN = 'https://opencode.ai/docs/zen';
const V = '2026-09-19';

const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const pay = JSON.parse(await readFile(path.join(DATA, 'payment.json'), 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

/* 1) DeepSeek V4.1 Flash 的 4x 促销额度：官方是 ~~$15~~ $60（截至 9/20） */
const go = s.plans.find((p) => p.id === 'opencode-go');
let promoFix = 0;
for (const [id, limit] of [['deepseek-v4-1-flash', 60]]) {
  const m = go?.models?.[id];
  if (!m) continue;
  const note = `官方单模型月额度 $${limit}（限时 4x 促销，原 $15，2026-09-20 结束）`;
  if (m.quotaOverride !== limit || m.note !== note) { m.quotaOverride = limit; m.note = note; m.promoLimit = true; promoFix++; }
}

/* 2) 控制台免费模型 */
const CONSOLE_FREE = [
  ['deepseek-v4-flash', 'DeepSeek V4 Flash'],
  ['laguna-s-2.1', 'Laguna S 2.1'],
  ['ling-3.0-tiny', 'Ling 3.0 Tiny'],
  ['longcat-2.0', 'LongCat-2.0'],
  ['north-mini-code', 'North Mini Code'],
];
let addedFree = 0;
for (const [mid, name] of CONSOLE_FREE) {
  if (!s.models.some((m) => m.id === mid)) s.models.push({ id: mid, name, vendor: 'OpenCode', note: 'OpenCode Zen 限时免费（控制台列表）' });
  if (s.apiPrices.some((a) => a.id === `oczen-${mid}` && a.free)) continue;
  if (s.apiPrices.some((a) => a.id === `oczen-free-${mid}`)) continue;
  upsert(s.apiPrices, {
    id: `oczen-free-${mid}`,
    provider: 'OpenCode Zen',
    modelId: mid,
    band: '免费',
    currency: 'USD',
    in: 0,
    cache: 0,
    out: 0,
    free: true,
    note: 'v2 控制台的模型列表里列出（官方文档未列）；限速数值未公布，触顶报 “Free usage exceeded”',
    source: SRC_ZEN,
    verifiedAt: V,
  });
  addedFree++;
}

/* 3) 说明文字 */
if (go) {
  go.note =
    '额度按模型分别计算：5 小时 = 该模型月额度的 20%、周 = 50%、月 = 100%；' +
    '用满某模型后它不可用（默认直接拒请求，控制台可开「Use balance」用 Zen 余额兜底）。' +
    'DeepSeek V4.1 Flash 目前有 4x 限时促销（月额度 $15 → $60，2026-09-20 结束）';
  go.tags = ['含 API 端点', '兼容 Claude Code'];
}
pay.providers['OpenCode'] = {
  cn: true,
  methods: ['支付宝'],
  note: '支持支付宝（Go 订阅页「其他付款方式」只有 Alipay 与 UPI；有 2026-08-11 的 $5 支付宝成功付款记录）。不支持微信支付，也无独立境内银联入口；默认走 Stripe 信用卡（手续费 4.4% + $0.30 按成本转嫁）。社区多次报告支付宝在 Stripe 结账时校验失败，时好时坏。',
};
pay.providers['OpenCode Zen'] = { ...pay.providers['OpenCode'] };

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
await writeFile(path.join(DATA, 'payment.json'), JSON.stringify(pay, null, 2), 'utf8');

console.log(`促销额度修正 ${promoFix} 处；新增控制台免费模型 ${addedFree} 条`);
const v41 = go?.models?.['deepseek-v4-1-flash'];
console.log(`DeepSeek V4.1 Flash：单模型月额度 $${v41?.quotaOverride}｜${v41?.note}`);
console.log(`OpenCode Zen 免费条目合计：${s.apiPrices.filter((a) => a.free && /OpenCode/.test(a.provider)).length} 条`);
