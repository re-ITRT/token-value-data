// 直接从官方定价页抽价格表（xAI 与 Gemini 可直连；OpenAI/Anthropic 需浏览器）
// 目的：给调研结果做交叉验证，并作为可重复的抓取源
const TARGETS = {
  xai: 'https://docs.x.ai/docs/models',
  gemini: 'https://ai.google.dev/gemini-api/docs/pricing',
};

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{2,}/g, '\n');

const which = process.argv[2] || 'xai';
const url = TARGETS[which];
const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' } });
const html = await res.text();
const text = strip(html);

console.log(`=== ${which} (${url}) — ${html.length} 字节 → 文本 ${text.length} ===`);

const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
// 找出所有「像价格」的行：数字带 $ 或 每百万 token 字样
const priceLines = lines.filter((l) => /\$\s?[\d.]+|per 1M|1M tokens|每百万/i.test(l));
console.log(`含价格的行 ${priceLines.length} 条，前 40 条：`);
for (const l of priceLines.slice(0, 40)) console.log('  ' + l.slice(0, 160));

// 模型名出现的位置
const names = ['grok-4.6', 'grok-4.5', 'grok-build-0.1', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.1-pro'];
console.log('\n模型名在页面中的上下文：');
for (const n of names) {
  const i = text.indexOf(n);
  if (i < 0) continue;
  console.log(`  [${n}] …${text.slice(i, i + 220).replace(/\n+/g, ' | ')}`);
}
