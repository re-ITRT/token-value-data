// 给分时条目补上「机器可读的时段规则」，供推荐工具按时区/使用时段自动算峰谷系数
// peakRule: { tz, days: [0..6] 0=周日, ranges: [[起,止]] 小时，可跨午夜写成两段 }
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERYDAY = [0, 1, 2, 3, 4, 5, 6];

// 官方公布的峰时段（各自时区）
const RULES = {
  deepseek: { tz: 'UTC', days: WEEKDAYS, ranges: [[1, 4], [6, 10]], note: 'UTC 周一至五 01–04、06–10（北京 09–12、14–18）' },
  ollama: { tz: 'UTC', days: WEEKDAYS, ranges: [[12, 18]], note: 'UTC 周一至五 12–18（北京 20:00–次日 02:00）' },
  glm: { tz: 'Asia/Shanghai', days: WEEKDAYS, ranges: [[14, 18]], note: '北京时间周一至五 14–18，其余时段积分 5 折' },
  mimo: { tz: 'Asia/Shanghai', days: EVERYDAY, ranges: [[8, 24]], note: '北京 08:00–24:00 为标准；00:00–08:00 夜间 0.8 倍消耗' },
  sf: { tz: 'Asia/Shanghai', days: EVERYDAY, ranges: [[8, 24], [0, 2]], note: '北京时间 02–08 为谷时（五折），其余为原价' },
};

/* ---- 按量价：按 id 打规则 ---- */
const API_RULES = {
  'deepseek-official-flash-peak': RULES.deepseek,
  'deepseek-official-pro-peak': RULES.deepseek,
  'cmdcode-api-dsv4flash-peak': RULES.deepseek,
  'ollama-dsv4flash-peak': RULES.ollama,
  'ollama-dsv41flash-peak': RULES.ollama,
  'sf-cn-v4flash-peak': RULES.sf,
};
for (const a of s.apiPrices) {
  // Command Code 的按量行是批量生成的，按前缀匹配
  const r = API_RULES[a.id] || (/^cc-api-/.test(a.id) && /谷时|峰时/.test(a.band) ? RULES.deepseek : null);
  if (r) a.peakRule = { tz: r.tz, days: r.days, ranges: r.ranges, note: r.note };
  else delete a.peakRule;
  // 谷时行也标注同一套规则，方便前端知道「非峰即谷」
  const offMap = {
    'deepseek-official-flash-off': RULES.deepseek,
    'deepseek-official-pro-off': RULES.deepseek,
    'cmdcode-api-dsv4flash-off': RULES.deepseek,
    'ollama-dsv4flash-base': RULES.ollama,
    'ollama-dsv41flash-base': RULES.ollama,
    'sf-cn-v4flash-off': RULES.sf,
  };
  if (offMap[a.id]) a.peakRule = { tz: offMap[a.id].tz, days: offMap[a.id].days, ranges: offMap[a.id].ranges, note: offMap[a.id].note };
}

/* ---- 订阅时段：给 peak 行打规则（谷行由 peak 行推导） ---- */
const PLAN_BAND_RULES = {
  'cmdcode-go': { peak: RULES.deepseek },
  'cmdcode-goat': { peak: RULES.deepseek },
  'cmdcode-pro': { peak: RULES.deepseek },
  'ollama-pro': { peak: RULES.ollama },
  'glm-coding-lite': { peak: RULES.glm },
  'glm-coding-pro': { peak: RULES.glm },
  'glm-coding-max': { peak: RULES.glm },
  'mimo-token-lite': { peak: RULES.mimo },
  'mimo-token-standard': { peak: RULES.mimo },
  'mimo-token-pro': { peak: RULES.mimo },
  'mimo-token-max': { peak: RULES.mimo },
};

let tagged = 0;
for (const p of s.plans) {
  const rules = PLAN_BAND_RULES[p.id];
  if (!rules || !p.models || p.models === 'any') continue;
  for (const spec of Object.values(p.models)) {
    for (const band of spec.bands || []) {
      if (band.slot === 'peak' && rules.peak) {
        band.peakRule = { tz: rules.peak.tz, days: rules.peak.days, ranges: rules.peak.ranges, note: rules.peak.note };
        tagged += 1;
      } else {
        delete band.peakRule;
      }
    }
  }
}

/* ---- 百度 Token Plan：三档时段（工作日白天 / 夜间 / 周末），官方未公布精确小时 ----
   推荐器无法准确建模，显式标注，让它退回标准价而不是猜错倍数。 */
for (const p of s.plans) {
  if (/^baidu-token/.test(p.id)) {
    p.timeNote = '三档时段（工作日白天 2 折 / 夜间 0.5 折 / 周末 1 折）精确小时未核实，推荐器按标准价计';
  } else {
    delete p.timeNote;
  }
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

console.log(`按量价带规则 ${s.apiPrices.filter((a) => a.peakRule).length} 条；订阅 peak 时段带规则 ${tagged} 处`);
console.log('\n规则一览：');
for (const [k, r] of Object.entries(RULES)) {
  console.log(`  ${k.padEnd(9)} ${r.tz.padEnd(15)} days=[${r.days.join(',')}] ranges=${JSON.stringify(r.ranges)}  ${r.note}`);
}
