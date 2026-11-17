// 角色立绘（图鉴用）：2.5D 仿真风格的彩色全身立绘，每个角色单独生成一张 → art/portraits/<id>.png
// 与眼镜里的绿色线稿是两套素材：立绘只用于图鉴文档 / 宣传，不进 agent/assets。
// 用法：
//   node tools/art/portraits.mjs                 生成全部缺失的立绘
//   node tools/art/portraits.mjs hero,rivet      只生成指定角色
//   node tools/art/portraits.mjs --force -j 3    覆盖重画，3 个并发
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = join(ROOT, 'art', 'portraits');
const LOG = join(ROOT, 'art', 'generate.log');

const STYLE = [
  'Original character art for "Tide Ark", a post-apocalyptic flooded-world survival game (year 183 of the Deep Blue Era, cities drowned, people live on salvaged rafts).',
  'Style: 2.5D semi-realistic full-body character standing illustration (character splash art):',
  'stylized anime-influenced proportions and faces, but rendered with realistic painterly 3D-like shading, volumetric soft lighting, cool rim light from behind,',
  'detailed believable materials: wet oilskin, sun-faded canvas, rusted riveted metal, rope, brass, worn leather, salt stains.',
  'Muted ocean palette: deep teal, sea green, rust orange, sand, with one accent color per character.',
  'Composition: ONE character only, the WHOLE body from head to feet inside the frame with some margin, standing in a confident readable pose, centered, vertical 2:3 portrait image.',
  'Background: plain soft gradient (pale gray-blue fading to white) with only a faint water ripple under the feet, no scenery, so the figure can be cut out.',
  'No text, no letters, no numbers, no logos, no watermark, no UI frame, no extra characters.',
].join(' ');

// 外形以 docs/故事.md「二、人物」为准（性别、身份、标志物）
export const PORTRAITS = [
  ['hero', '你（老潮）', 'a quiet weathered male salvager in his thirties, torn wide-brimmed straw hat, sun-tanned stubbled face with a calm stubborn look, patched orange life vest over a faded shirt, coiled grappling rope and a rusty hook over one shoulder, rolled trousers, barefoot, salt-crusted skin'],
  ['rivet', '铆钉', 'a quick-witted young woman mechanic in her twenties, welding mask pushed up on her forehead, short messy hair, cocky grin, rolled-up grease-stained overalls with one strap down, tool harness full of wrenches and screwdrivers, a big adjustable wrench resting on her shoulder, work boots'],
  ['coral', '珊瑚', 'a gentle determined young woman marine biologist, long dark braid, round glasses, field vest with a belt of glass sample jars holding seaweed and tiny creatures, rubber diving boots, hugging a damp notebook, a small electric eel with faint blue sparks curled around her forearm'],
  ['pot', '小锅', 'a skinny cheerful young man cook around twenty, head scarf, stained apron over a kitchen shirt, holding a big dented soup pot with a ladle sticking out, nervous happy grin, a bundle of seaweed tied at his belt'],
  ['beam', '铁梁', 'a tall silent broad-shouldered man builder in his forties, scratched yellow hard hat, short beard, serious straight mouth, heavy work jacket, measuring tape and carpenter pencil at the belt, carrying a rusted steel I-beam on one shoulder'],
  ['trader', '秤砣', 'a shrewd middle-aged man traveling trader, thin mustache, sly polite smile, layered coat with many pockets, tall wooden backpack frame stacked with crates, bottles and filters, old brass balance-scale weights hanging from the frame, holding a small brass hand scale'],
  ['hawk', '灯塔叔', 'a grumpy old man former long-haul truck driver turned navigator, big white beard, faded trucker cap, long oilskin raincoat, wooden peg leg, brass spyglass in hand, an old road sign tucked under his arm'],
  ['rust', '锈锚', 'a fierce male pirate captain in his forties, scar across the face, black tricorn hat, rusted anchor chain draped over his shoulders like a shawl, long dark coat, iron hook on one hand, serrated cutlass in the other, cold confident stare, black sail fabric as a sash'],
  ['bubble', '气泡', 'a quiet male deep-sea salvage diver in a heavy brass-helmet diving suit, air hoses looping to a tank on his back, helmet port showing wary young eyes, holding a small lantern close to his chest, slightly hunched, patched canvas suit, lead boots'],
  ['lin', '林博士', 'a tired old man scientist, messy white hair, round cracked glasses, torn stained lab coat with a faded wave-shaped project badge, thin and stooped, clutching a waterproof document case to his chest, guilty sad eyes'],
  ['tide', '潮生', 'a calm slender androgynous young mutant, gill slits on the side of the neck, small translucent fins behind the ears, faint blue-green scales on the forearms, webbed hands, simple sleeveless sea-worn tunic, barefoot, serene half-closed eyes, wet hair'],
  ['sand', '白砂', 'a stern composed young man water ration officer of the sea city-states, neat short pale hair, stiff white high-collar uniform with a water-drop insignia, gloves, holding a clipboard of water ration tickets and a rubber stamp, expressionless cold eyes'],
];

const args = process.argv.slice(2);
const force = args.includes('--force');
const jIdx = args.indexOf('-j');
const jobs = Math.max(1, Number(jIdx >= 0 ? args[jIdx + 1] : 2) || 2);
const sel = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-j')[0];
const ids = sel ? sel.split(',') : null;

mkdirSync(OUT, { recursive: true });
const todo = PORTRAITS.filter(([id]) => (!ids || ids.includes(id)) && (force || !existsSync(join(OUT, `${id}.png`))));
const log = (line) => { console.log(line); appendFileSync(LOG, line + '\n'); };
console.log(`待生成立绘 ${todo.length} 张，并发 ${jobs}`);

function codexImage(prompt, target) {
  const instruction = [
    'Use your image generation tool to create exactly ONE image from the prompt below. Use a tall portrait (2:3) size.',
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
    p.on('close', (code) => resolve({ ok: existsSync(target), code, secs: ((Date.now() - t0) / 1000) | 0, err }));
  });
}

let next = 0;
await Promise.all(Array.from({ length: jobs }, async () => {
  while (next < todo.length) {
    const [id, name, subject] = todo[next++];
    const target = join(OUT, `${id}.png`);
    if (force && existsSync(target)) rmSync(target);
    const r = await codexImage(`${STYLE}\nCharacter: ${subject}.`, target);
    log(`${new Date().toISOString()} ${r.ok ? 'OK  ' : 'FAIL'} portrait ${id} ${name} (${r.secs}s, exit ${r.code})` + (r.ok ? '' : `\n${r.err.slice(-600)}`));
  }
}));
