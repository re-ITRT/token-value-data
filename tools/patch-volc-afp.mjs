// 按官方「套餐内 AFP 抵扣规则」文档（更新 2026-09-17）校正 Agent Plan 的抵扣系数，
// 并移除火山 Coding Plan（用户实测用量不透明、与实际不符，不再统计）。
//
// 官方公式：单次请求 AFP = (输入 token × 输入系数 + 输出 token × 输出系数) / 10,000
// → 每 100 万 token 消耗的 AFP = 系数 × 100
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const DOC = 'https://www.volcengine.com/docs/ark/agent-plan-personal-afp-credits-billing-rules?lang=zh';
const VERIFIED = '2026-09-17';

// 官方表：模型 → 抵扣系数（输入=输出）
const AFP = {
  'doubao-seed-2.0-mini': 0.25,
  'doubao-seed-2.0-lite': 0.5,
  'deepseek-v4-flash': 0.5,
  'glm-5.3-flash': 0.5,
  'doubao-seed-2.1-turbo': 2.5,
  'doubao-seed-evolving': 2.5,
  'minimax-m3': 2.5,
  'kimi-k2.7-code': 4.5,
  'glm-5.3': 4.5,
  'deepseek-v4-pro': 5.5,
  'deepseek-v4-1-flash': 2.5,
  'kimi-k2.8-preview': 8,
  'kimi-k3': 10,
};
// 限时折扣（官方 doc 列出的活动）
const DEALS = {
  'deepseek-v4-1-flash': { mult: 0.5, label: '系数 5 折（9/15–9/28）', note: '原系数 2.5 → 1.25' },
  'kimi-k2.8-preview': { mult: 0.6, label: '系数 6 折（9/17–9/30）', note: '原系数 8 → 4.8' },
};

/* ---- 补模型（若目录里没有） ---- */
for (const [id, name, vendor] of [['kimi-k2.8-preview', 'Kimi K2.8 Preview', '月之暗面']]) {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor, note: '' });
}

/* ---- 写回 Agent Plan 各档的模型系数 ---- */
const AGENT = ['volc-agent-small', 'volc-agent-medium', 'volc-agent-large'];
let fixed = 0;
for (const id of AGENT) {
  const p = s.plans.find((x) => x.id === id);
  if (!p) continue;
  const models = {};
  for (const [mid, coef] of Object.entries(AFP)) {
    const u = Math.round(coef * 100);
    const deal = DEALS[mid];
    const spec = {
      u: { input: u, cache: u, output: u },
      note: `官方抵扣系数 ${coef} AFP/万 token`,
    };
    if (deal) {
      spec.bands = [
        { id: 'base', label: '常规系数', mult: 1 },
        { id: 'deal', label: deal.label, mult: deal.mult, note: deal.note },
      ];
    }
    models[mid] = spec;
  }
  p.models = models;
  p.source = DOC;
  p.verifiedAt = VERIFIED;
  p.note =
    'AFP 系数整表照抄官方文档（2026-09-17）；缓存读取按同系数估算（官方未单列）。' +
    '活动：Auto 模式系数 0.5、夜间 00:00–08:00 多路由到 kimi-k3（6/10–11/8）；' +
    'deepseek-v4.1-flash 系数 5 折（9/15–9/28）；kimi-k2.8-preview 系数 6 折（9/17–9/30）';
  fixed += 1;
}

/* ---- 移除火山 Coding Plan（用量口径不透明，用户实测对不上） ---- */
const REMOVE = ['volc-coding-lite', 'volc-coding-pro'];
const before = s.plans.length;
s.plans = s.plans.filter((p) => !REMOVE.includes(p.id));
s.removedPlans = [...new Set([...(s.removedPlans || []), ...REMOVE])];

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

console.log(`已修正 ${fixed} 个 Agent Plan 档位的模型系数`);
console.log(`已移除火山 Coding Plan：${before - s.plans.length} 档（${REMOVE.join(', ')}）`);
console.log('\nAgent Plan 系数（每百万 token 消耗 AFP）：');
const small = s.plans.find((p) => p.id === 'volc-agent-small');
for (const [mid, spec] of Object.entries(small.models)) {
  const band = spec.bands ? `　折扣档 ${spec.bands[1].label} → ${Math.round(spec.u.input * spec.bands[1].mult)}` : '';
  console.log(`  ${mid.padEnd(24)} ${String(spec.u.input).padStart(5)} AFP/百万 token${band}`);
}
