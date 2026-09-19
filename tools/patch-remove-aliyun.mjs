// 下架阿里百炼：用户核实后认为其用量口径不透明（Token Plan 的 Credits 系数官方未公开、
// Coding Plan 限量抢购且禁非交互式调用），与火山 Coding Plan 同样处理。
// 保留记录在 sources.json 的 removedProviders / removedPlans，防止脚本重新加回来。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const PROVIDER = '阿里百炼';
const API_PROVIDER = '阿里百炼 API';

const plansBefore = s.plans.length;
const apiBefore = s.apiPrices.length;
const removedPlans = s.plans.filter((p) => p.provider === PROVIDER).map((p) => p.id);
const removedApi = s.apiPrices.filter((a) => a.provider === API_PROVIDER).map((a) => a.id);

s.plans = s.plans.filter((p) => p.provider !== PROVIDER);
s.apiPrices = s.apiPrices.filter((a) => a.provider !== API_PROVIDER);

// 记录已下架，避免其它脚本（patch-*）把它加回来
s.removedProviders = [...new Set([...(s.removedProviders || []), PROVIDER, API_PROVIDER])];
s.removedPlans = [...new Set([...(s.removedPlans || []), ...removedPlans])];
s.removedApiPrices = [...new Set([...(s.removedApiPrices || []), ...removedApi])];

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');

console.log(`已下架 ${PROVIDER}`);
console.log(`  套餐 -${plansBefore - s.plans.length}：${removedPlans.join(', ') || '无'}`);
console.log(`  按量价 -${apiBefore - s.apiPrices.length}：${removedApi.join(', ') || '无'}`);
console.log(`剩余：模型 ${s.models.length}｜按量价 ${s.apiPrices.length}｜套餐 ${s.plans.length}`);
const stillQwen = s.apiPrices.filter((a) => /qwen/i.test(a.modelId)).map((a) => `${a.provider} ${a.modelId}`);
console.log('Qwen 系模型还剩这些按量来源：' + (stillQwen.join(' | ') || '无'));
