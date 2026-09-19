// 国外四家的消费者会员套餐（含编码 agent 额度）
// 结论（2026-09-19 核验）：四家**官方都不公布额度的 token / 美元绝对值**，只给百分比或相对倍数
// → 一律按 kind:'uncomputable' 收录，展示价格、窗口结构、可用模型与「为什么算不出来」，不参与排名。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const V = '2026-09-19';

const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
const pay = JSON.parse(await readFile(path.join(DATA, 'payment.json'), 'utf8'));
const upsert = (arr, item) => {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = { ...arr[i], ...item };
  else arr.push(item);
};

const U = '5h + 周 双窗口共享池（官方只给百分比/相对倍数，无 token 或美元绝对值）';

const PLANS = [
  /* ---------------- Anthropic（Claude 会员） ---------------- */
  {
    id: 'claude-pro', provider: 'Anthropic', name: 'Claude Pro', line: 'claude-member',
    amount: 20, annual: 17, models: 'Opus 全档（另有独立 Opus 周限额）、Sonnet、Haiku；Fable 需买 usage credits',
    source: 'https://claude.com/pricing',
    note:
      '含 Claude Code；网页/桌面/手机/Claude Code/Cowork **共用同一个池**（5h 滚动窗口 + 周窗口），官方称「there is no fixed message count」只给百分比进度条；' +
      '官方明确 /usage 里的美元数「对订阅者没有计费意义」→ 无 token/美元绝对值可折算。触顶**直接阻断**（不自动降级模型），可开 usage credits 按 API 牌价续跑。' +
      '社区实测（不可用于定价）：Max 20x 约 1.8–2.2M tokens/5h、11–13M/周，≈600k tokens/小时；另有实测称 $200 档周额度仅为 $100 档的 2.1×（非 4×）。',
  },
  {
    id: 'claude-max-5x', provider: 'Anthropic', name: 'Claude Max 5x', line: 'claude-member',
    amount: 100, models: '同 Pro，额度约 5×Pro（官方口径）',
    source: 'https://claude.com/pricing',
    note: '仅月付（无年付）。编码额度为 Pro 的 5 倍（官方相对倍数），绝对值未公布，无法折算成 token/元。',
  },
  {
    id: 'claude-max-20x', provider: 'Anthropic', name: 'Claude Max 20x', line: 'claude-member',
    amount: 200, models: '同 Pro，额度约 20×Pro（官方口径）',
    source: 'https://claude.com/pricing',
    note: '仅月付。官方称 20×Pro；但社区多次实测 5x→20x 的周额度只有 1.4×–2.5×（有争议），且额度可被单方调整（2026-09-14 把促销 +50% 永久改为 +25%）→ 不可作稳定换算基准。',
  },

  /* ---------------- OpenAI（ChatGPT 会员） ---------------- */
  {
    id: 'chatgpt-go', provider: 'OpenAI', name: 'ChatGPT Go', line: 'chatgpt-member',
    amount: 8, models: '无 GPT-5.6 Sol、无 Astra（推理走 Luna）',
    source: 'https://chatgpt.com/codex/pricing',
    note: '含 Codex 但官方只说「limits vary by plan」，**连 5 小时窗口的数字都没给**；Free/Go 触顶后被引导升级而不是买 credits → 完全无法折算。',
  },
  {
    id: 'chatgpt-plus', provider: 'OpenAI', name: 'ChatGPT Plus', line: 'chatgpt-member',
    amount: 20, models: 'Sol/Terra/Luna 全档 + Astra（限量，仅 Work/Codex 渠道）',
    source: 'https://chatgpt.com/codex/pricing',
    note:
      '含 Codex；官方按模型给「每 5 小时本地消息数**区间**」：Astra 3–30、Sol 10–100、Terra 25–200、Luna 250–2,000（区间上下差 10–20 倍，且官方声明「不是固定限制」）；' +
      '每周窗口数值**未公布**。Codex web/CLI/IDE/手机与 ChatGPT Work/Excel 共用同一池。官方唯一美元锚点是「Codex 平均 ~$100–200/开发者/月」（事后均值，不是包含额度）。',
  },
  {
    id: 'chatgpt-pro-5x', provider: 'OpenAI', name: 'ChatGPT Pro 5x', line: 'chatgpt-member',
    amount: 100, models: 'Astra 全额 + 5.3-Codex-Spark（Pro 独占）',
    source: 'https://chatgpt.com/codex/pricing',
    note: 'Codex 5h 消息数为 Plus 的 5 倍（Astra 15–150、Sol 50–500、Luna 1,250–10,000）；同样只有区间、每周窗口未公布。',
  },
  {
    id: 'chatgpt-pro-20x', provider: 'OpenAI', name: 'ChatGPT Pro 20x', line: 'chatgpt-member',
    amount: 200, models: '同 Pro 5x，额度约 20×（Astra 60–600、Luna 5,000–40,000）',
    source: 'https://chatgpt.com/codex/pricing',
    note: '⚠️ 官方已暂停新注册/升级到 $200 档。额度为区间值；官方 credits 体系（Sol = 100 credits/M 输入）与企业 rate card 反推 1 credit ≈ $0.04，但官方明示 credit 单价随 plan/agreement 变、且「不是 API credits」→ 不能当作定价依据。',
  },

  /* ---------------- Google（AI 会员 / Antigravity） ---------------- */
  {
    id: 'google-ai-plus', provider: 'Google', name: 'Google AI Plus', line: 'google-member',
    amount: 4.99, models: 'Antigravity 有限 agent 请求；且不可购买 AI credits',
    source: 'https://antigravity.google/docs/plans',
    note: '编码走 Antigravity（Gemini CLI 已于 2026-06-18 停止为消费级档位服务）。额度只有隐藏池的分数，官方无数值。',
  },
  {
    id: 'google-ai-pro', provider: 'Google', name: 'Google AI Pro', line: 'google-member',
    amount: 19.99, models: 'Gemini 3.x + Antigravity（5h 滚动窗口刷新，直至触及周上限）',
    source: 'https://antigravity.google/docs/plans',
    note:
      '含 $10/月 Google Cloud credits。官方只说额度「按 API 计价扣减」且「随 agent 完成的工作量浮动、可随时调整」，**从不公布绝对量**；' +
      'AI credits 已于 2026-05-19 从基础套餐移除，仅作超额机制。中国大陆不在支持地区（港澳台在列）。',
  },
  {
    id: 'google-ultra-5x', provider: 'Google', name: 'Google AI Ultra 5x', line: 'google-member',
    amount: 99.99, models: '同上，额度为 Pro 的 5× token 当量（官方口径）',
    source: 'https://antigravity.google/blog/changes-to-antigravity-plans',
    note: '官方只给「5× Pro 的 token 当量」这个相对倍数，Pro 的绝对值未公布 → 无法折算。含 $40/月 Google Cloud credits。',
  },
  {
    id: 'google-ultra-20x', provider: 'Google', name: 'Google AI Ultra 20x', line: 'google-member',
    amount: 199.99, models: '同上，额度为 Pro 的 20× token 当量；独占第三方模型',
    source: 'https://antigravity.google/blog/changes-to-antigravity-plans',
    note: '同为相对倍数（20×Pro）。用第三方客户端接 Antigravity 登录态违反 ToS（可封号），官方要求改用 API key。',
  },

  /* ---------------- xAI（SuperGrok / X Premium+） ---------------- */
  {
    id: 'supergrok', provider: 'xAI', name: 'SuperGrok', line: 'grok-member',
    amount: 30, models: 'Grok 4.6、Grok Bot、Grok Build、Imagine',
    source: 'https://x.ai/pricing',
    note:
      '官方口径：**一个共享周池，只以百分比展示**（「shown as a percentage used」），且不同产品（对话/视频/Build）消耗差异巨大；' +
      '触顶后付费功能暂停至周重置，可买 Extra Usage Credits（$5 起，按标准 API 价，费率劣于套餐内）。**不含 API credits**，官方从不公布折算成 token/美元的值。',
  },
  {
    id: 'supergrok-plus', provider: 'xAI', name: 'SuperGrok Plus', line: 'grok-member',
    amount: 100, models: '同上，Build 用量「significantly higher」（官方无数值）',
    source: 'https://x.ai/pricing',
    note: '官方只给「显著更高」的措辞，没有倍数也没有绝对值 → 无法折算。',
  },
  {
    id: 'supergrok-heavy', provider: 'xAI', name: 'SuperGrok Heavy', line: 'grok-member',
    amount: 300, models: '多智能体、最高额度；反向赠送 X Premium+',
    source: 'https://x.ai/pricing',
    note: '官方页对额度只说「highest usage」；$300 与 $10 Lite 档的**一手价格来源不足**（官方页未列价，需登录 grok.com 才显示）→ 价格与额度都需人工再核。',
  },
  {
    id: 'x-premium-plus', provider: 'xAI', name: 'X Premium+', line: 'grok-member',
    amount: 40, annual: 32.92, models: 'X 内 Grok + 官方称含 SuperGrok access + Grok Bot + X Pro',
    source: 'https://help.x.com/en/using-x/x-premium',
    note: '官方明示含 SuperGrok access；但反向不成立（买 X Premium+ ≠ grok.com 侧 SuperGrok 池，只有 Heavy 反向赠 Premium+）。年付 $395/年 ≈ $32.9/月。',
  },
];

let added = 0;
for (const p of PLANS) {
  const priceVariants = [{ id: 'list', label: '月付', amount: p.amount }];
  if (p.annual) priceVariants.push({ id: 'annual', label: '年付折算', amount: p.annual });
  const exists = s.plans.some((x) => x.id === p.id);
  upsert(s.plans, {
    id: p.id,
    provider: p.provider,
    name: p.name,
    kind: 'uncomputable',
    currency: 'USD',
    quota: null,
    quotaUnit: U,
    period: '月',
    window: '5h·周',
    priceVariants,
    tags: ['含编码 agent'],
    note: `${p.note}｜可用模型：${p.models}`,
    source: p.source,
    verifiedAt: V,
    models: {},
    line: p.line,
  });
  if (!exists) added++;
}

/* 会员套餐的支付标注（四家都不支持中国支付） */
pay.providers['Anthropic'] = { cn: false, methods: ['信用卡'], note: 'Claude 网页订阅只收信用卡/借记卡（无支付宝/微信/银联）；付费套餐要求「实体位于支持地区」，中国大陆不在支持名单，需支持地区手机号。' };
pay.providers['OpenAI'] = { cn: false, methods: ['信用卡'], note: 'ChatGPT 订阅付款只支持信用卡/借记卡（官方多币种页列了 CNY–中国，但付款方式里没有支付宝/微信/银联）；官方支持国家名单不含中国大陆与港澳，从不支持地区访问或付款可致封号。' };
pay.providers['Google'] = { cn: false, methods: ['信用卡'], note: 'Google AI 会员需「qualifying form of payment」（信用卡），未找到支持支付宝/微信/银联的官方说明；AI Pro 支持地区含港澳台，**不含中国大陆**。学生可经 SheerID 免费领 12 个月 AI Pro（港澳除外）。' };
pay.providers['xAI'] = { cn: false, methods: ['信用卡'], note: 'SuperGrok / X Premium+ 走国际卡（Stripe）；官方无任何支持支付宝/微信/银联的说明（相关说法只出现在第三方代充平台）。' };

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
await writeFile(path.join(DATA, 'payment.json'), JSON.stringify(pay, null, 2), 'utf8');

console.log(`会员套餐写入 ${PLANS.length} 条（新增 ${added}）`);
for (const p of s.plans.filter((x) => ['claude-member', 'chatgpt-member', 'google-member', 'grok-member'].includes(x.line))) {
  console.log(`  ${p.provider.padEnd(10)} ${p.name.padEnd(22)} $${p.priceVariants[0].amount}/月`);
}
console.log(`套餐总数 ${s.plans.length}｜其中无法换算 ${s.plans.filter((p) => p.kind === 'uncomputable').length} 条`);
