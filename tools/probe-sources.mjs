// 探测候选来源页是否可被原始抓取（用于给 12 小时监控选一个抓得到的官方页）
import { createHash } from 'node:crypto';

const urls = [
  'https://open.bigmodel.cn/pricing',
  'https://docs.bigmodel.cn/cn/coding-plan/overview',
  'https://docs.bigmodel.cn/cn/coding-plan/faq',
  'https://docs.bigmodel.cn/cn/guide/start/model-overview',
  'https://bigmodel.cn/glm-coding',
  'https://docs.z.ai/guides/overview/pricing',
  'https://platform.kimi.com/docs/pricing/chat',
  'https://www.kimi.com/code/docs/kimi-code/membership.html',
  'https://platform.minimaxi.com/document/price',
  'https://platform.minimaxi.com/docs/guides/pricing-token-plan',
  'https://platform.minimaxi.com/docs/guides/pricing-paygo',
  'https://platform.minimaxi.com/subscribe/token-plan',
];

function normalizeHtml(raw) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const url of urls) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36', 'accept-language': 'zh-CN,zh;q=0.9' },
    });
    const text = await res.text();
    clearTimeout(t);
    const n = normalizeHtml(text).length;
    console.log(`${String(res.status).padEnd(4)} ${String(n).padStart(8)} chars  ${n >= 300 ? '✅可监控' : '❌空壳'}  ${url}`);
  } catch (err) {
    console.log(`ERR  ${' '.repeat(8)}          ❌       ${url} — ${err.message}`);
  }
}
