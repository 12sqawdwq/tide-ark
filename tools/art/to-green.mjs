// 把 art/lineart 里游戏界面要用的线稿转成眼镜素材：
//   黑线白底 → #40ff5e 线条 + 透明底，缩到最长边 SIZE 像素 → agent/assets/art/<id>.png
// 并生成 agent/core/art.js（已就绪素材清单），game.js 据此决定显示图片还是退回字符画。
// 用法：node tools/art/to-green.mjs        （只转换缺失的；--force 全部重转）
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'art', 'lineart');
const DST = join(ROOT, 'agent', 'assets', 'art');
const MANIFEST = join(ROOT, 'agent', 'core', 'art.js');
const SIZE = 192;
const GREEN = [0x40, 0xff, 0x5e];
const force = process.argv.includes('--force');

// 游戏界面用到的素材（其余线稿留作后续界面/剧情使用）
export const USED = [
  ...Array.from({ length: 8 }, (_, i) => `shelter-lv${i + 1}-front`),
  ...Array.from({ length: 6 }, (_, i) => `filter-lv${i + 1}-front`),
  ...Array.from({ length: 5 }, (_, i) => `eel-lv${i + 1}-front`),
  ...['wood', 'iron', 'gold'].flatMap((k) => ['closed', 'ajar', 'open'].map((s) => `chest-${k}-${s}`)),
  'salvage-01', 'salvage-04', 'salvage-07', 'salvage-08', 'char-24',
  // 主菜单图标：钩子 / 锤子 / 宝箱 / 扳手
  'icon-08', 'icon-06', 'icon-10', 'icon-07',
  // 弹窗插画：风暴冲击 / 平安夜 / 沉没 / 方舟
  'event-04', 'event-10', 'story-07', 'story-10',
  // 剧情节点插画
  'story-01', 'story-02', 'story-03', 'story-04', 'story-05', 'story-06', 'story-08', 'story-09',
  // M1：藤壶装甲、角色立绘（未生成的角色先跳过，弹窗自动退回剧情插画）
  'barnacle-lv1-front', 'barnacle-lv2-front', 'barnacle-lv3-front',
  'npc-02', 'npc-04', 'npc-06', 'npc-07',
  // M2：第四–六章设施、角色（灯塔叔/锈锚/秤砣/铁梁）、残骸带插画
  ...['octo', 'crab', 'lure'].flatMap((k) => [1, 2, 3].map((l) => `${k}-lv${l}-front`)),
  'turtle-lv1-front', 'turtle-lv2-front',
  'npc-03', 'npc-05', 'npc-10', 'npc-11',
  'place-03', 'place-04', 'lore-02', 'lore-03',
  // M3：气泡 / 林博士 / 潮生、沉城与实验室、来信、档案、发光水母
  'npc-08', 'npc-09', 'npc-12', 'place-01', 'place-02', 'place-05', 'lore-01', 'lore-05',
  // 章鱼夜 / 漂流瓶
  'lore-04', 'salvage-18',
];

function convert(src) {
  const img = PNG.sync.read(readFileSync(src));
  const { width: W, height: H, data } = img;
  const k = Math.max(W, H) / SIZE;
  const w = Math.max(1, Math.round(W / k)), h = Math.max(1, Math.round(H / k));
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // 区域平均：墨量 = 1 - 亮度
    const x0 = Math.floor(x * k), x1 = Math.min(W, Math.ceil((x + 1) * k));
    const y0 = Math.floor(y * k), y1 = Math.min(H, Math.ceil((y + 1) * k));
    let ink = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      const a = data[i + 3] / 255;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      ink += (1 - lum) * a; n++;
    }
    // 缩小后细线会变淡，提升一点不透明度
    const alpha = Math.min(255, Math.round(Math.pow(ink / n, 0.7) * 255 * 1.3));
    const o = (y * w + x) * 4;
    out.data[o] = GREEN[0]; out.data[o + 1] = GREEN[1]; out.data[o + 2] = GREEN[2];
    out.data[o + 3] = alpha < 12 ? 0 : alpha;
  }
  return PNG.sync.write(out);
}

mkdirSync(DST, { recursive: true });
let made = 0; const missing = [];
for (const id of USED) {
  const src = join(SRC, `${id}.png`), dst = join(DST, `${id}.png`);
  if (!existsSync(src)) { missing.push(id); continue; }
  if (existsSync(dst) && !force) continue;
  writeFileSync(dst, convert(src)); made++;
}
const ready = readdirSync(DST).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
writeFileSync(MANIFEST,
  '// 由 tools/art/to-green.mjs 生成，勿手改：已就绪的眼镜素材 id\n' +
  `export const ART = ${JSON.stringify(ready, null, 1)};\n`);
console.log(`转换 ${made} 张，就绪 ${ready.length} 张` + (missing.length ? `；缺线稿：${missing.join(', ')}` : ''));
