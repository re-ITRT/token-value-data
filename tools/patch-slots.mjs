// 给「时段」打上语义标记：peak（峰）/ offpeak（谷），便于看板显示峰谷角标
// 幂等：按规则重算，可反复运行
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

/* ---- 按量 API：看 band 文案 ---- */
for (const a of s.apiPrices) {
  const b = a.band || '';
  if (/谷时|基础价|非高峰|低峰/.test(b)) a.slot = 'offpeak';
  else if (/峰时|高峰|其余时段/.test(b)) a.slot = 'peak';
  else delete a.slot;
}

/* ---- 订阅套餐：按「套餐 id + band id」显式指定 ---- */
const RULES = {
  'cmdcode-go': { base: 'offpeak', off: 'offpeak', peak: 'peak' },
  'opencode-go': { base: 'offpeak', off: 'offpeak', peak: 'peak' },
  'cmdcode-goat': { base: 'offpeak', off: 'offpeak', peak: 'peak' },
  'cmdcode-pro': { base: 'offpeak', off: 'offpeak', peak: 'peak' },
  'ollama-pro': { base: 'offpeak', peak: 'peak' },
  'glm-coding-lite': { base: 'peak', off: 'offpeak', night: 'offpeak' },
  'glm-coding-pro': { base: 'peak', off: 'offpeak', night: 'offpeak' },
  'glm-coding-max': { base: 'peak', off: 'offpeak', night: 'offpeak' },
  'baidu-token-mini': { day: 'peak', night: 'offpeak', weekend: 'offpeak' },
  'mimo-token-lite': { base: 'peak', night: 'offpeak' },
  'mimo-token-standard': { base: 'peak', night: 'offpeak' },
  'mimo-token-pro': { base: 'peak', night: 'offpeak' },
  'mimo-token-max': { base: 'peak', night: 'offpeak' },
  'baidu-token-lite': { day: 'peak', night: 'offpeak', weekend: 'offpeak' },
  'baidu-token-pro': { day: 'peak', night: 'offpeak', weekend: 'offpeak' },
};

let tagged = 0;
for (const p of s.plans) {
  const rules = RULES[p.id];
  if (!rules || !p.models || p.models === 'any') continue;
  for (const spec of Object.values(p.models)) {
    for (const band of spec.bands || []) {
      if (rules[band.id]) {
        band.slot = rules[band.id];
        tagged += 1;
      } else {
        delete band.slot;
      }
    }
  }
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

const apiTagged = s.apiPrices.filter((a) => a.slot).length;
console.log(`按量价打标 ${apiTagged} 条；订阅时段打标 ${tagged} 处`);
console.log('\n按量：');
for (const a of s.apiPrices.filter((x) => x.slot)) console.log(`  ${a.slot.padEnd(8)} ${a.provider} · ${a.modelId} · ${a.band}`);
console.log('\n订阅（示例：glm-coding-lite / baidu-token-lite）：');
for (const id of ['glm-coding-lite', 'baidu-token-lite']) {
  const p = s.plans.find((x) => x.id === id);
  for (const [mid, spec] of Object.entries(p.models)) {
    if (spec.bands) console.log(`  ${id} · ${mid}: ` + spec.bands.map((b) => `${b.id}=${b.slot || '—'}`).join(', '));
  }
}
