// 规范化模型厂商：OpenCode Zen 同步时用「显示名第一个词」当厂商，产生了 GPT / Claude / Gemini / Grok / Big / Nemotron 这类脏分组。
// 这里按模型 id 前缀统一到真正的厂商（与国产厂商的中文口径保持一致）。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'sources.json');
const s = JSON.parse(await readFile(FILE, 'utf8'));

const RULES = [
  [/^gpt-/, 'OpenAI'],
  [/^o[1-9](-|$)/, 'OpenAI'],
  [/^claude-/, 'Anthropic'],
  [/^gemini-/, 'Google'],
  [/^grok-/, 'xAI'],
  [/^qwen/, '阿里'],
  [/^glm-/, '智谱'],
  [/^kimi-/, '月之暗面'],
  [/^minimax-/, 'MiniMax'],
  [/^muse-spark-/, 'Meta'],
  [/^nemotron-/, 'NVIDIA'],
  [/^hunyuan-|^hy[0-9]/, '腾讯'],
  [/^doubao-/, '字节'],
  [/^ernie-/, '百度'],
  [/^step-/, '阶跃星辰'],
  [/^mimo-/, '小米'],
  [/^longcat-/, '美团'],
  [/^xing/, '讯飞'],
  [/^inkling/, 'Thinking Machines'],
  [/^fugu-/, 'Sakana'],
  [/^deepseek-/, 'DeepSeek'],
  [/^laguna-|^north-|^big-pickle|^ling-/, '其他'],
];

const UNKNOWN = new Set(['GPT', 'Claude', 'Gemini', 'Grok', 'Qwen', 'Qwen3.5', 'GLM', 'Kimi', 'MiniMax', 'Muse', 'Nemotron', 'Hy3', 'Hy4', 'LongCat', 'MiMo', 'Big', 'Ling', 'Laguna', 'North', 'OpenCode']);

let fixed = 0;
const changes = [];
for (const m of s.models) {
  const hit = RULES.find(([re]) => re.test(m.id));
  const want = hit ? hit[1] : m.vendor;
  if (UNKNOWN.has(m.vendor) && hit) {
    changes.push(`${m.id}: ${m.vendor} → ${want}`);
    m.vendor = want;
    fixed++;
  } else if (hit && m.vendor !== want && m.vendor !== '其他') {
    // 已经有正经厂商名但与规则不一致（比如被写成 OpenCode）也纠正
    changes.push(`${m.id}: ${m.vendor} → ${want}`);
    m.vendor = want;
    fixed++;
  }
}

await writeFile(FILE, JSON.stringify(s, null, 2), 'utf8');
console.log(`规范化厂商 ${fixed} 处：`);
for (const c of changes.slice(0, 30)) console.log('  ' + c);

const g = {};
for (const m of s.models) (g[m.vendor] = g[m.vendor] || []).push(m.id);
console.log(`\n现在 ${Object.keys(g).length} 组：`);
console.log(Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([v, ids]) => `${v}(${ids.length})`).join('  '));
