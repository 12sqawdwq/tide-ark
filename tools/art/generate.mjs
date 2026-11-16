// 用 Codex CLI（ChatGPT 账号内置的 image_generation 工具）批量生成线稿 → art/lineart/<id>.png
// 用法：
//   node tools/art/generate.mjs --anchors            只生成定调样张
//   node tools/art/generate.mjs --only id1,id2       生成指定条目
//   node tools/art/generate.mjs --category salvage   生成某一类
//   node tools/art/generate.mjs --all [-j 2]         全部（已存在的文件自动跳过）
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANCHORS } from './build-prompts.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = join(ROOT, 'art', 'lineart');
const LOG = join(ROOT, 'art', 'generate.log');
const GEN_DIR = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const all = readFileSync(join(ROOT, 'art', 'prompts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

let todo;
if (args.includes('--anchors')) todo = all.filter((x) => ANCHORS.includes(x.id));
else if (opt('--only')) { const ids = opt('--only').split(','); todo = all.filter((x) => ids.includes(x.id)); }
else if (opt('--category')) todo = all.filter((x) => x.category === opt('--category'));
else if (args.includes('--all')) todo = all;
else { console.log('需要 --anchors / --only / --category / --all'); process.exit(1); }
const jobs = Math.max(1, Number(opt('-j')) || 1);

mkdirSync(OUT, { recursive: true });
todo = todo.filter((x) => !existsSync(join(OUT, `${x.id}.png`)));
console.log(`待生成 ${todo.length} 张，并发 ${jobs}`);

// 某次运行之后 Codex 新写入的 png（兜底：模型没按要求把文件存到目标路径时用）
function newestSince(t0) {
  if (!existsSync(GEN_DIR)) return null;
  let best = null;
  for (const d of readdirSync(GEN_DIR)) {
    const dir = join(GEN_DIR, d);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.png')) continue;
      const p = join(dir, f); const m = statSync(p).mtimeMs;
      if (m >= t0 && (!best || m > best.m)) best = { p, m };
    }
  }
  return best?.p ?? null;
}

function runOne(item) {
  const target = join(OUT, `${item.id}.png`);
  const instruction = [
    'Use your image generation tool to create exactly ONE image from the prompt below.',
    `Save the resulting PNG to this exact path: ${target}`,
    'Do not create, edit or delete any other file. Do not write code. Reply with only the saved path.',
    '', 'PROMPT:', item.prompt,
  ].join('\n');
  const t0 = Date.now();
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-C', ROOT, '-'],
      { shell: process.platform === 'win32', stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.stdin.end(instruction);
    p.on('close', (code) => {
      if (!existsSync(target) && jobs === 1) { const g = newestSince(t0); if (g) copyFileSync(g, target); }
      const ok = existsSync(target);
      const line = `${new Date().toISOString()} ${ok ? 'OK  ' : 'FAIL'} ${item.id} (${((Date.now() - t0) / 1000) | 0}s, exit ${code})`;
      console.log(line);
      appendFileSync(LOG, line + (ok ? '' : `\n${err.slice(-800)}`) + '\n');
      resolve(ok);
    });
  });
}

// 并发 >1 时兜底复制可能串号，所以并发模式只认 Codex 自己存到目标路径的文件
let i = 0, ok = 0;
await Promise.all(Array.from({ length: jobs }, async () => {
  while (i < todo.length) { if (await runOne(todo[i++])) ok++; }
}));
console.log(`完成 ${ok}/${todo.length}`);
