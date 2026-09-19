// 四家国外厂商的支付/地区标注（按 2026-09-19 的核验结果写实）
// 结论一致：都只收境外信用卡、都限制中国大陆地区；OpenCode 是唯一支持支付宝的国外渠道。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'payment.json');
const pay = JSON.parse(await readFile(FILE, 'utf8'));

pay.providers['xAI 官方'] = {
  cn: false,
  methods: ['信用卡', '对公汇款'],
  note: '只收境外信用卡（卡品牌枚举里有 unionpay，但官方没有任何支付宝/微信/境内银联人民币通道说明）或企业对公汇款（ACH/wire/check，需联系 sales@x.ai）。官方无国别黑白名单，但要求符合 OFAC 出口管制；境内直连 api.x.ai 实测不通。自动充值单次最低 $5。',
};
pay.providers['OpenAI 官方'] = {
  cn: false,
  methods: ['信用卡'],
  note: 'API 充值只支持 USD + 信用卡/借记卡（多币种里的 CNY 只适用于 ChatGPT 订阅），不支持支付宝/微信/银联。官方支持国家名单不含中国大陆、香港、澳门（台湾在列），名单外访问或付款可能被封号。最低充值 $5，额度 1 年过期不退；发票仅企业合同客户按月开。',
};
pay.providers['Anthropic 官方'] = {
  cn: false,
  methods: ['信用卡'],
  note: '只接受境外主流信用卡（Visa/MC/Amex，走 Stripe），官方文档从未出现支付宝/微信/银联。企业客户可经 Sales 走月度后付发票（可 T/T）。支持国家名单不含中国大陆、香港、澳门（台湾在列）。API 无免费层（仅新用户少量免费 credits，金额未公布）。',
};
pay.providers['Google Gemini 官方'] = {
  cn: false,
  methods: ['信用卡'],
  note: '接受的卡组织只有 Amex/MasterCard/Visa/Discover/JCB/Visa Electron/Elo，银联不在列，且不支持电汇转账 → 必须境外卡。有免费层（限速未公布），付费可预付（最低 $5，12 个月过期不退）或后付。地区名单不含中国大陆、香港、澳门（含台湾），官方建议受限地区改用 Vertex AI（定价几乎一致，但无免费层、需 GCP 合同）。',
};

await writeFile(FILE, JSON.stringify(pay, null, 2), 'utf8');
console.log('已写入 4 家厂商的支付标注；总条数 ' + Object.keys(pay.providers).length);
for (const k of ['xAI 官方', 'OpenAI 官方', 'Anthropic 官方', 'Google Gemini 官方']) {
  console.log(`  ${k.padEnd(22)} cn=${pay.providers[k].cn}  ${pay.providers[k].methods.join('/')}`);
}
