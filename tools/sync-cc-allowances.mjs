// 从 Command Code 套餐页提取「模型 → 每月 credits」表（列：Model | Input | Output | Cache Read | Cache Write | Monthly credits）
// 这张表是**当前真实额度**（pricing-limits 页内嵌 JSON 存的是促销折后值，且过期促销会残留）
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const PLANS = { go: 'https://commandcode.ai/docs/plans/go', goat: 'https://commandcode.ai/docs/plans/goat', pro: 'https://commandcode.ai/docs/plans/pro' };

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
};

/** 找出「Monthly credits」表：返回 [[cell,...],...] */
function parseCreditsTable(html) {
  const tables = html.split(/<table/i).slice(1).map((s) => '<table' + s.split(/<\/table>/i)[0]);
  const target = tables.find((t) => /Monthly credits/i.test(t));
  if (!target) return [];
  const rows = [...target.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  return rows
    .map((r) =>
      [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&#x27;|&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim(),
      ),
    )
    .filter((c) => c.length >= 4);
}

const result = {};
for (const [key, url] of Object.entries(PLANS)) {
  const rows = parseCreditsTable(await fetchText(url));
  const map = {};
  for (const cells of rows.slice(1)) {
    const name = cells[0];
    const credits = cells[cells.length - 1];
    const m = /\$?\s*([\d.]+)/.exec(credits || '');
    if (name && m) map[name.toLowerCase()] = Number(m[1]);
  }
  result[key] = map;
  console.log(`${key}: ${Object.keys(map).length} 个模型的每月额度`);
  for (const n of ['kimi k3', 'glm-5.3', 'glm-5.3 flash', 'minimax m3', 'deepseek v4.1 flash', 'claude haiku 5.5']) {
    if (map[n] !== undefined) console.log(`   ${n.padEnd(22)} $${map[n]}`);
  }
}

if (process.argv[2] === '--write') {
  const s = JSON.parse(await readFile(path.join(DATA, 'sources.json'), 'utf8'));
  const NAME2ID = {};
  for (const m of s.models) NAME2ID[m.name.toLowerCase()] = m.id;
  let changed = 0;
  const log = [];
  for (const [planKey, id] of [['go', 'cmdcode-go'], ['goat', 'cmdcode-goat'], ['pro', 'cmdcode-pro']]) {
    const p = s.plans.find((x) => x.id === id);
    if (!p) continue;
    for (const [name, credits] of Object.entries(result[planKey] || {})) {
      const mid = NAME2ID[name];
      if (!mid || !p.models[mid] || !credits) continue;
      if (p.models[mid].quotaOverride !== credits) {
        log.push(`[${planKey}] ${mid}: $${p.models[mid].quotaOverride} → $${credits}`);
        p.models[mid].quotaOverride = credits;
        p.models[mid].note = `官方单模型月额度 $${credits}`;
        changed++;
      }
    }
  }
  await writeFile(path.join(DATA, 'sources.json'), JSON.stringify(s, null, 2), 'utf8');
  console.log(`\n按套餐页表格修正额度 ${changed} 处：`);
  for (const l of log) console.log('  ' + l);
}
