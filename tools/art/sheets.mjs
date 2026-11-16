// 4×4 拼图模式：一次让 Codex 生成一张含 16 格的线稿拼图，再按网格裁成单张 → art/lineart/<id>.png
// 用法：
//   node tools/art/sheets.mjs plan                 规划：把 lineart 里还没有的条目每 16 个分成一张 → art/sheets/plan.json
//   node tools/art/sheets.mjs gen [sheet-01,...]    生成拼图（默认全部未生成的），已存在的拼图跳过
//   node tools/art/sheets.mjs crop [sheet-01,...]   裁切拼图（默认全部已生成的），已存在的单张不覆盖，加 --force 覆盖
import { spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ART = join(ROOT, 'art');
const OUT = join(ART, 'lineart');
const SHEETS = join(ART, 'sheets');
const PLAN = join(SHEETS, 'plan.json');
const LOG = join(ART, 'generate.log');
const GEN_DIR = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images');
const N = 4; // 4×4

const SHEET_STYLE = [
  'Original line-art for "Tide Ark", a post-apocalyptic flooded-world survival game.',
  'Style: clean technical ink line drawing, uniform bold black strokes on pure white background,',
  'no fill, no shading, no gradients, no hatching, no text, no numbers, no labels, no logos, no watermark.',
  'Hand-made salvage aesthetic: rope, rivets, corrugated metal, patched planks. Simple bold silhouettes.',
].join(' ');

// 卡通线稿风格（深蓝纪元扩展起使用）：plan.json 里条目带 style: 'cartoon' 即采用
const CARTOON_STYLE = [
  'Original line-art for "Tide Ark", a post-apocalyptic flooded-world survival game with a lively adventurous mood.',
  'Style: bold comic cartoon line art. Thick confident black outer contours with thinner interior detail lines,',
  'exaggerated expressive characters with chunky proportions, big hands, big readable facial expressions, rounded playful shapes,',
  'creatures and machines drawn with personality (eyes, grins, rivets, pipes, patched metal).',
  'Clean black ink on pure white background only: no fill, no color, no gray, no shading, no screentone, no gradients,',
  'no text, no numbers, no labels, no logos, no watermark. Simple strong silhouettes that stay readable when shrunk.',
].join(' ');
const STYLES = { tech: SHEET_STYLE, cartoon: CARTOON_STYLE };

const [cmd = '', sel = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');
mkdirSync(SHEETS, { recursive: true });
mkdirSync(OUT, { recursive: true });
const log = (line) => { console.log(line); appendFileSync(LOG, line + '\n'); };

function loadPlan() { return JSON.parse(readFileSync(PLAN, 'utf8')); }
function pick(plan) { const ids = sel ? sel.split(',') : null; return plan.filter((s) => !ids || ids.includes(s.sheet)); }

// ---------- plan ----------
if (cmd === 'plan') {
  const all = readFileSync(join(ART, 'prompts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  // 追加模式：保留已有拼图条目，新条目编号接在后面；已在计划里的 id 不重复规划
  const plan = existsSync(PLAN) ? loadPlan() : [];
  const planned = new Set(plan.flatMap((s) => s.items.map((x) => x.id)));
  const todo = all.filter((x) => !existsSync(join(OUT, `${x.id}.png`)) && !planned.has(x.id));
  const before = plan.length;
  for (let i = 0; i < todo.length; i += N * N) {
    plan.push({ sheet: `sheet-${String(plan.length + 1).padStart(2, '0')}`, style: 'cartoon', items: todo.slice(i, i + N * N).map((x) => ({ id: x.id, subject: x.subject })) });
  }
  writeFileSync(PLAN, JSON.stringify(plan, null, 1));
  console.log(`新增 ${todo.length} 条 → ${plan.length - before} 张拼图（${plan.slice(before).map((s) => s.sheet).join(',') || '无'}）→ art/sheets/plan.json`);
}

// ---------- gen ----------
function sheetPrompt(s) {
  const cells = s.items.map((x, i) => `${i + 1}. ${x.subject}`).join('\n');
  const empty = N * N - s.items.length;
  return [
    STYLES[s.style] || SHEET_STYLE,
    `Create ONE square image: a ${N}x${N} contact sheet of ${N * N} equal square cells, ${N} rows by ${N} columns,`,
    'separated by thin straight black grid lines that run edge to edge, with a thin black border around the whole sheet.',
    'Each cell holds exactly one separate illustration, centered, with clear white margin, never crossing into another cell.',
    'All cells share the same line weight and style. Do not write any numbers or captions.',
    empty ? `The last ${empty} cell(s) stay completely empty white.` : '',
    'Cells in reading order (left to right, then top to bottom):',
    cells,
  ].filter(Boolean).join('\n');
}

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

function codexImage(prompt, target, fallback = true) {
  const instruction = [
    'Use your image generation tool to create exactly ONE image from the prompt below.',
    `Save the resulting PNG to this exact path: ${target}`,
    'Do not create, edit or delete any other file. Do not write code. Reply with only the saved path.',
    '', 'PROMPT:', prompt,
  ].join('\n');
  const t0 = Date.now();
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-C', ROOT, '-'],
      { shell: process.platform === 'win32', stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.stdin.end(instruction);
    p.on('close', (code) => {
      if (!existsSync(target) && fallback) { const g = newestSince(t0); if (g) copyFileSync(g, target); }
      resolve({ ok: existsSync(target), code, secs: ((Date.now() - t0) / 1000) | 0, err });
    });
  });
}

if (cmd === 'gen') {
  const jIdx = process.argv.indexOf('-j');
  const jobs = Math.max(1, Number(jIdx >= 0 ? process.argv[jIdx + 1] : 1) || 1);
  const list = pick(loadPlan()).filter((s) => !existsSync(join(SHEETS, `${s.sheet}.png`)));
  console.log(`待生成拼图 ${list.length} 张，并发 ${jobs}` + (jobs > 1 ? '（并发时不做兜底复制，避免串号）' : ''));
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (next < list.length) {
      const s = list[next++];
      const target = join(SHEETS, `${s.sheet}.png`);
      if (existsSync(target)) continue; // 其他进程可能已经生成
      const r = await codexImage(sheetPrompt(s), target, jobs === 1);
      log(`${new Date().toISOString()} ${r.ok ? 'OK  ' : 'FAIL'} ${s.sheet} (${r.secs}s, exit ${r.code})` + (r.ok ? '' : `\n${r.err.slice(-800)}`));
    }
  }));
}

// ---------- crop ----------
const lum = (d, i) => (d[i + 3] < 128 ? 255 : 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);

// 找贯穿全图的网格线：某列/行暗像素占比 > 50%；在 1/4、2/4、3/4 附近取最近的线中心，找不到就均分
function boundaries(img, axis) {
  const { width: W, height: H, data } = img;
  const len = axis === 'x' ? W : H, other = axis === 'x' ? H : W;
  const dark = new Float32Array(len);
  for (let a = 0; a < len; a++) {
    let c = 0;
    for (let b = 0; b < other; b += 2) {
      const [x, y] = axis === 'x' ? [a, b] : [b, a];
      if (lum(data, (y * W + x) * 4) < 128) c++;
    }
    dark[a] = c / (other / 2);
  }
  const lines = []; // [start, end]
  for (let a = 0; a < len; a++) {
    if (dark[a] > 0.5) { if (lines.length && lines.at(-1)[1] >= a - 2) lines.at(-1)[1] = a; else lines.push([a, a]); }
  }
  const cuts = [0];
  for (let k = 1; k < N; k++) {
    const want = (len * k) / N;
    const near = lines.filter(([s, e]) => Math.abs((s + e) / 2 - want) < len * 0.08)
      .sort((p, q) => Math.abs((p[0] + p[1]) / 2 - want) - Math.abs((q[0] + q[1]) / 2 - want))[0];
    cuts.push(near ? [near[0], near[1]] : [Math.round(want), Math.round(want)]);
  }
  cuts.push(len - 1);
  // 返回每格的 [起, 止]（去掉网格线本身）
  const spans = [];
  for (let k = 0; k < N; k++) {
    const s = k === 0 ? 0 : cuts[k][1] + 1, e = k === N - 1 ? len - 1 : cuts[k + 1][0] - 1;
    spans.push([s, e]);
  }
  return { spans, found: cuts.slice(1, N).filter((c) => c[0] !== c[1] || lines.some(([s]) => s === c[0])).length };
}

function cropCell(img, [x0, x1], [y0, y1]) {
  const { width: W, data } = img;
  // 内缩 3%，避开网格线残边与外框
  const ix = Math.round((x1 - x0) * 0.03), iy = Math.round((y1 - y0) * 0.03);
  x0 += ix; x1 -= ix; y0 += iy; y1 -= iy;
  // 边缘连续暗线（外框/网格残留）再往里剥
  const rowDark = (y) => { let c = 0; for (let x = x0; x <= x1; x++) if (lum(data, (y * W + x) * 4) < 128) c++; return c / (x1 - x0 + 1); };
  const colDark = (x) => { let c = 0; for (let y = y0; y <= y1; y++) if (lum(data, (y * W + x) * 4) < 128) c++; return c / (y1 - y0 + 1); };
  while (y1 > y0 && rowDark(y0) > 0.6) y0++;
  while (y1 > y0 && rowDark(y1) > 0.6) y1--;
  while (x1 > x0 && colDark(x0) > 0.6) x0++;
  while (x1 > x0 && colDark(x1) > 0.6) x1--;
  let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1, ink = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (lum(data, (y * W + x) * 4) < 160) { ink++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  }
  if (ink < 200) return null; // 空格
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1, side = Math.round(Math.max(w, h) * 1.15);
  const out = new PNG({ width: side, height: side });
  out.data.fill(255);
  const ox = ((side - w) / 2) | 0, oy = ((side - h) / 2) | 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((by0 + y) * W + (bx0 + x)) * 4, di = ((oy + y) * side + (ox + x)) * 4;
    const v = lum(data, si) | 0;
    out.data[di] = out.data[di + 1] = out.data[di + 2] = v; out.data[di + 3] = 255;
  }
  return out;
}

if (cmd === 'crop') {
  for (const s of pick(loadPlan())) {
    const file = join(SHEETS, `${s.sheet}.png`);
    if (!existsSync(file)) continue;
    const img = PNG.sync.read(readFileSync(file));
    const bx = boundaries(img, 'x'), by = boundaries(img, 'y');
    let made = 0; const missing = [];
    s.items.forEach((item, i) => {
      const target = join(OUT, `${item.id}.png`);
      if (existsSync(target) && !force) return;
      const cell = cropCell(img, bx.spans[i % N], by.spans[(i / N) | 0]);
      if (!cell) { missing.push(item.id); return; }
      writeFileSync(target, PNG.sync.write(cell)); made++;
    });
    log(`${new Date().toISOString()} CROP ${s.sheet} ${img.width}x${img.height} 网格线 x${bx.found}/y${by.found} → ${made} 张` + (missing.length ? `，空格: ${missing.join(',')}` : ''));
  }
}

if (!['plan', 'gen', 'crop'].includes(cmd)) console.log('用法：node tools/art/sheets.mjs plan | gen [ids] | crop [ids] [--force]');
