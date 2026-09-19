import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D = path.join(__dirname, '..', 'data');
const rd = async (f, d) => { try { return JSON.parse(await readFile(path.join(D, f), 'utf8')); } catch { return d; } };
const sources = await rd('sources.json', null);
const state = await rd('state.json', null);
const fx = await rd('fx.json', null);
const history = await rd('history.json', []);
if (!sources || !state || !fx) throw new Error('缺少 sources/state/fx，先跑一次 updater');
await writeFile(path.join(D, 'bundle.json'), JSON.stringify({
  generatedAt: state.finishedAt || state.generatedAt,
  nextRunAt: state.nextRunAt,
  intervalMs: state.intervalMs || 12 * 60 * 60 * 1000,
  fx, state, sources, history,
}, null, 2), 'utf8');
console.log('bundle 已重建：sources.models=' + sources.models.length + ' plans=' + sources.plans.length + '（state/fx 沿用 ' + state.generatedAt + '）');