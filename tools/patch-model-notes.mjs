// 收尾修补：
//   1) 合并 OpenCode Zen 造成的重复模型 claude-sonnet-4.5（分档后缀没被剥掉，落成了一个新 id）
//   2) 给「厂商官方 API 没有/已下架该模型，价格只能来自第三方网关」的模型补说明，
//      这样审计脚本再跑时能一眼分辨「真漏项」和「厂商确实不卖」
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

/* 1) 合并重复模型 */
let merged = 0;
for (const bad of s.models.filter((m) => m.id === 'claude-sonnet-4.5')) {
  const good = s.models.find((m) => m.id === 'claude-sonnet-4-5');
  if (good) {
    for (const a of s.apiPrices) if (a.modelId === bad.id) { a.modelId = good.id; merged++; }
    s.models = s.models.filter((m) => m !== bad);
    good.note = good.note || '分档（≤/> 200K）取小档';
  }
}

/* 2) 厂商官方未在售的模型补说明（依据 2026-09-19 的官网核验） */
const NOTES = {
  'kimi-k2.5': 'Kimi 官方 API 已下架该档（官网价目表现只有 k2.6 / k2.7 / k3），价格来自第三方网关',
  'kimi-k2.8-preview': '预览版，Kimi 官方 API 未上价目表，价格来自第三方网关',
  'minimax-m2.5': 'MiniMax 官方 API 未在售该档（官网只有 M2.7 / M3），价格来自第三方网关',
  'glm-5': '智谱官网价目表未见该档（只有 GLM-5.3 / 5.2 / 5.1 / 5-Turbo / 4.7 系），价格来自第三方网关',
  'qwen3-coder-next': '阿里百炼已下架本目录，该模型暂无可用报价',
};
let noted = 0;
for (const [id, note] of Object.entries(NOTES)) {
  const m = s.models.find((x) => x.id === id);
  if (m && m.note !== note) { m.note = note; noted++; }
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`合并重复模型 claude-sonnet-4.5 → claude-sonnet-4-5：转移 ${merged} 条按量价`);
console.log(`补充「官方未在售」说明 ${noted} 个模型`);
console.log(`模型总数 ${s.models.length}｜按量价 ${s.apiPrices.length}`);
