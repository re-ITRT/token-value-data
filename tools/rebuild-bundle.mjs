// 只重建 bundle.json（沿用已有的 state/fx/history），用于「只改了 sources.json / payment.json」的场景，
// 避免跑一次完整抓取（那会用本机渲染器覆盖 CI 的来源页基线）。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D = path.join(__dirname, '..', 'data');
const rd = async (f, d) => {
  try { return JSON.parse(await readFile(path.join(D, f), 'utf8')); } catch { return d; }
};

const sources = await rd('sources.json', null);
const state = await rd('state.json', null);
const fx = await rd('fx.json', null);
const history = await rd('history.json', []);
const payments = await rd('payment.json', { providers: {} });
if (!sources || !state || !fx) throw new Error('缺少 sources/state/fx，先跑一次 updater');

await writeFile(
  path.join(D, 'bundle.json'),
  JSON.stringify(
    {
      generatedAt: state.finishedAt || state.generatedAt,
      nextRunAt: state.nextRunAt,
      intervalMs: state.intervalMs || 12 * 60 * 60 * 1000,
      fx,
      state,
      sources,
      history,
      payments: payments.providers || {},
    },
    null,
    2,
  ),
  'utf8',
);
console.log(
  `bundle 已重建：models=${sources.models.length} plans=${sources.plans.length} 支付标注=${Object.keys(payments.providers || {}).length}（state/fx 沿用 ${state.generatedAt}）`,
);
