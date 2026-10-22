// SCNet（国家超算互联网）Token Plan 2026-10-22 更新
// 官方页面：https://www2.scnet.cn/ac/openapi/doc/2.0/moduleapi/plans/token-plan.html
//
// 核对结果：
//   - 四档价格与 Credits 全部未变（¥50/30、185/110、440/265、1274/764；60k/240k/600k/1.8M）
//   - 「2026年9月1日扣减倍率」与已记录的倍率逐条一致（新增 4 个模型要补）
//   - **重要修正**：官方明写「每个账号最多可同时持有 1 个 Token Plan（不区分档位）」，
//     我此前记成「可重复购买 ≤3」，已改为不可重复，否则推荐器会高估可获得的额度
//   - 每个 Token Plan 只能生成 1 个专属 API Key（sk-tp- 开头）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const SRC = 'https://www2.scnet.cn/ac/openapi/doc/2.0/moduleapi/plans/token-plan.html';
const V = '2026-10-22';
const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));

// 官方倍率表（2026-09-01 生效，全量 19 个模型）
const MULT = {
  'glm-5.3': 2.29,
  'glm-5.3-flash': 0.15,
  'glm-5.2': 0.85,
  'glm-5.1': 1.4,
  'glm-5': 1.11,
  'deepseek-v4-pro-0813': 1.11,
  'deepseek-v4-1-flash': 0.23,
  'deepseek-v4-flash-0731': 0.4,
  'deepseek-v4-pro': 1.06,
  'deepseek-v4-flash': 0.13,
  'kimi-k3': 4.12,
  'kimi-k2.7-code': 1.0,
  'kimi-k2.6': 1.0,
  'kimi-k2.5': 0.65,
  'minimax-m3': 0.43,
  'minimax-m2.7': 0.43,
  'minimax-m2.5': 0.3,
  'qwen3.8-max': 2.1,
  'qwen3.8-flash': 0.14,
};

// 换算：每 100 万 token 的 Credits = 倍率 × 8333.33；缓存命中按 6%、输出按 4.2353 倍输入（与已记录条目一致）
const BASE = 10000 / 1.2; // 8333.333…
const u = (mult) => {
  const input = Math.round(mult * BASE);
  return { input, cache: Math.round(input * 0.06), output: Math.round(input * 4.2353) };
};

// 目录里缺的模型补上
const ADD_MODEL = {
  'deepseek-v4-pro-0813': ['DeepSeek V4 Pro 0813', 'DeepSeek'],
  'deepseek-v4-flash-0731': ['DeepSeek V4 Flash 0731', 'DeepSeek'],
};
for (const [id, [name, vendor]] of Object.entries(ADD_MODEL)) {
  if (!s.models.some((m) => m.id === id)) s.models.push({ id, name, vendor, note: '日期快照版模型（SCNet Token Plan 在售）' });
}

let added = 0;
let updated = 0;
for (const p of s.plans.filter((x) => /^scnet-token/.test(x.id))) {
  for (const [id, mult] of Object.entries(MULT)) {
    const cur = p.models[id];
    if (!cur) {
      p.models[id] = { u: u(mult), note: `官方倍率 ${mult}` };
      added++;
    } else if (Math.abs(cur.u.input - u(mult).input) > 2) {
      p.models[id] = { ...cur, u: u(mult), note: `官方倍率 ${mult}` };
      updated++;
    } else {
      cur.note = `官方倍率 ${mult}`;
    }
  }
  // 修正：不可重复购买
  p.repeatable = false;
  p.maxCopies = 1;
  p.tags = ['单账号仅 1 个套餐', '禁非交互式调用'];
  p.verifiedAt = V;
  p.source = SRC;
  p.note =
    '倍率表 2026-09-01 生效、官方按周核对；Credits 按月发放、不结转。' +
    '**每个账号同时只能持有 1 个 Token Plan（不区分档位）**，且每份订阅只能生成 1 个专属 API Key（sk-tp- 开头）；' +
    'Token Plan 的 Key 与通用 API Key 不互通。套餐 Key 仅限官方支持的交互式 AI 工具（OpenClaw / OpenCode / Claude Code / Cursor / CodeX / Cline / RooCode 等），' +
    'FAQ 明确 Dify / Postman / cURL 在允许范围外。旗舰版含 OpenClaw 2 核 4G 实例免费使用。';
  if (p.id === 'scnet-token-flagship') p.tags = [...p.tags, '含 OpenClaw 实例'];
}

await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
const p = s.plans.find((x) => x.id === 'scnet-token-basic');
console.log(`SCNet：新增模型条目 ${added} 处、修正换算 ${updated} 处；现覆盖 ${Object.keys(p.models).length} 个模型`);
console.log('倍率覆盖检查：' + Object.entries(MULT).map(([id, m]) => `${id}=${m}${p.models[id] ? '' : '(缺)'}`).join(' '));
