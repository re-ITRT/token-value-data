// 通过 GitHub API（api.github.com 通道）把当前目录内容推成一个提交
// 用途：本机 git-over-https 到 github.com 不稳定时（连接被重置）照样能推送
// 用法： node tools/gh-push.mjs <目录> <owner/repo> [分支] [提交信息]
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

// execFile 不支持 input 选项，必须用 spawn 往 stdin 写（否则 git credential fill 会一直等输入）
function gitCredentialFill() {
  return new Promise((resolve, reject) => {
    const p = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`git credential fill 退出码 ${code}`))));
    p.stdin.end('protocol=https\nhost=github.com\n\n');
  });
}

async function token() {
  const stdout = await gitCredentialFill();
  const line = stdout.split('\n').find((l) => l.startsWith('password='));
  if (!line) throw new Error('git credential 里没有 github.com 的密码/token');
  return line.slice('password='.length).trim();
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '.preview', '__pycache__']);
async function walk(dir, base = dir, out = []) {
  for (const name of await readdir(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full, base, out);
    else out.push({ full, rel: path.relative(base, full).split(path.sep).join('/') });
  }
  return out;
}

const [dir, repo, branchArg, message] = process.argv.slice(2);
if (!dir || !repo) {
  console.error('用法: node gh-push.mjs <目录> <owner/repo> [分支] [提交信息]');
  process.exit(1);
}
const branch = branchArg || 'main';
const msg = message || `update: ${new Date().toISOString()}`;
const tok = await token();
const API = 'https://api.github.com';
const headers = {
  Authorization: `token ${tok}`,
  'User-Agent': 'gh-push',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

async function api(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${url} → HTTP ${res.status} ${json?.message || ''}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

const files = await walk(dir);
console.log(`目录 ${dir}：${files.length} 个文件`);

// 1) blobs（并发 6）
const entries = [];
for (let i = 0; i < files.length; i += 6) {
  const chunk = files.slice(i, i + 6);
  const blobs = await Promise.all(
    chunk.map(async (f) => {
      const content = await readFile(f.full);
      const blob = await api('POST', `/repos/${repo}/git/blobs`, {
        content: content.toString('base64'),
        encoding: 'base64',
      });
      return { path: f.rel, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );
  entries.push(...blobs);
  process.stdout.write(`\r  已上传 ${entries.length}/${files.length} 个 blob`);
}
console.log();

// 2) tree
const tree = await api('POST', `/repos/${repo}/git/trees`, { tree: entries });

// 3) 找已有分支作为父提交
let parents = [];
try {
  const ref = await api('GET', `/repos/${repo}/git/ref/heads/${branch}`);
  parents = [ref.object.sha];
} catch (err) {
  if (err.status !== 404) throw err;
}

// 4) commit + 创建/更新分支
const commit = await api('POST', `/repos/${repo}/git/commits`, {
  message: msg,
  tree: tree.sha,
  parents,
});
if (parents.length) {
  await api('PATCH', `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });
} else {
  await api('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
}
console.log(`✅ ${repo}@${branch} → ${commit.sha.slice(0, 7)}（${entries.length} 个文件）`);
console.log(`   https://github.com/${repo}/commit/${commit.sha}`);
