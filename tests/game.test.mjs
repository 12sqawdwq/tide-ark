import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../agent/core/game.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('new game starts on home with sane resources', () => {
  const s = G.newGame();
  assert.equal(s.day, 1);
  assert.equal(s.ui.screen, 'home');
  const vm = G.view(s);
  assert.equal(vm.menu.length, 4);
  assert.equal(vm.menu[0].focused, true);
});

test('filter produces water slower without power', () => {
  const a = G.newGame(); a.res.water = 0;
  G.tick(a, 10);
  const weak = a.res.water;
  const b = G.newGame(); b.res.water = 0; b.res.power = 10;
  G.tick(b, 10);
  assert.ok(b.res.water > weak * 3, `${b.res.water} vs ${weak}`);
});

test('eel generator produces power up to cap', () => {
  const s = G.newGame(); s.lv.eel = 1; s.lv.shelter = 2; s.lv.filter = 0;
  for (let i = 0; i < 50; i++) G.tick(s, 1); // 50 s < DAY_LEN, 0.25/s → 12.5
  assert.ok(Math.abs(s.res.power - 12.5) < 1e-6);
  s.res.power = 19.9;
  G.tick(s, 1);
  assert.equal(s.res.power, G.caps(s).power);
});

test('day ends with report overlay and pauses time', () => {
  const s = G.newGame();
  G.tick(s, G.DAY_LEN);
  assert.equal(s.day, 2);
  assert.equal(s.ui.overlay.kind, 'report');
  const clock = s.clock;
  G.tick(s, 5);
  assert.equal(s.clock, clock, 'paused while overlay shown');
  G.press(s, 'enter');
  assert.equal(s.ui.overlay, null);
});

test('storm and thirst damage can sink the shelter, enter restarts', () => {
  const s = G.newGame();
  s.day = 20; s.res.water = 0; s.hp = 10;
  G.endDay(s);
  assert.equal(s.over, true);
  assert.equal(s.ui.overlay.kind, 'over');
  G.press(s, 'enter');
  assert.equal(s.over, false);
  assert.equal(s.day, 1);
});

test('salvage: hook hits item under cursor and loot applies', () => {
  const s = G.newGame();
  // rng 0 → every loot pick = scrap, x = slot start
  assert.ok(G.startSalvage(s, () => 0));
  const sv = s.ui.salvage;
  sv.cursor = sv.items[0].x + 1;
  const before = s.res.scrap;
  assert.equal(G.dropHook(s, () => 0), 'scrap');
  assert.ok(s.res.scrap > before);
  sv.cursor = 99.9; // between slots? slot 4 starts at 80, w ~10.7 → miss
  assert.equal(G.dropHook(s, () => 0), null);
  G.dropHook(s, () => 0);
  assert.equal(sv.done, true);
  G.press(s, 'enter');
  assert.equal(s.ui.screen, 'home');
  assert.equal(s.cooldown, G.SALVAGE_COOLDOWN);
  assert.equal(G.startSalvage(s), false, 'cooldown blocks');
});

test('salvage cursor bounces within 0..100', () => {
  const s = G.newGame();
  G.startSalvage(s, Math.random);
  for (let i = 0; i < 500; i++) {
    G.salvageStep(s, 0.05);
    const c = s.ui.salvage.cursor;
    assert.ok(c >= 0 && c <= 100);
  }
});

test('upgrades respect costs and locks', () => {
  const s = G.newGame();
  assert.equal(G.upgrade(s, 'eel'), false, 'eel locked at shelter 1');
  s.res.scrap = 100; s.res.water = 30;
  assert.equal(G.upgrade(s, 'shelter'), true);
  assert.equal(s.lv.shelter, 2);
  assert.equal(G.upgrade(s, 'eel'), false, 'needs an eel');
  s.res.eels = 1;
  assert.equal(G.upgrade(s, 'eel'), true);
  assert.equal(s.lv.eel, 1);
  assert.equal(s.res.eels, 0);
  s.res.parts = 5;
  assert.equal(G.upgrade(s, 'filter'), true);
  assert.equal(G.upgrade(s, 'filter'), true);
  assert.equal(s.lv.filter, 3);
  assert.equal(G.upgrade(s, 'filter'), false, 'filter capped at shelter+1');
});

test('the ark (Lv8) waits for chapter 8 and needs filter parts', () => {
  const s = G.newGame();
  s.lv.shelter = G.MAX_SHELTER - 1;
  s.res.scrap = 999; s.res.water = 999; s.res.parts = 10;
  assert.equal(G.costOf(s, 'shelter').locked, '方舟 · 第八章');
  s.chapter = G.ENDING_CHAPTER;
  s.res.parts = 0;
  assert.equal(G.upgrade(s, 'shelter'), false, 'the ark also needs filter parts');
  s.res.parts = 10;
  assert.equal(G.upgrade(s, 'shelter'), true);
  assert.equal(G.costOf(s, 'shelter').max, true);
});

test('chest opening needs one press per lock and grants reward', () => {
  const s = G.newGame();
  s.chests = ['iron'];
  s.ui.screen = 'chests';
  G.press(s, 'enter', () => 0.5); // start
  assert.equal(s.ui.chest.need, 3);
  G.press(s, 'enter', () => 0.5);
  G.press(s, 'enter', () => 0.5);
  assert.equal(s.ui.chest.reward, null);
  const scrap = s.res.scrap;
  G.press(s, 'enter', () => 0.5);
  assert.ok(s.ui.chest.reward);
  assert.equal(s.chests.length, 0);
  assert.ok(s.res.scrap > scrap);
  G.press(s, 'enter');
  assert.equal(s.ui.chest, null);
});

test('navigation: focus wraps, back returns home, back on home is unhandled', () => {
  const s = G.newGame();
  G.press(s, 'up');
  assert.equal(s.ui.focus, 3);
  G.press(s, 'down');
  assert.equal(s.ui.focus, 0);
  G.press(s, 'down');
  G.press(s, 'enter');
  assert.equal(s.ui.screen, 'build');
  assert.equal(G.press(s, 'back'), true);
  assert.equal(s.ui.screen, 'home');
  assert.equal(s.ui.focus, 1);
  assert.equal(G.press(s, 'back'), false);
});

test('serialize/restore round trip drops ui and keeps progress', () => {
  const s = G.newGame();
  s.day = 4; s.res.scrap = 33; s.chests = ['gold'];
  const json = JSON.parse(JSON.stringify(G.serialize(s)));
  assert.equal(json.ui, undefined);
  const r = G.restore(json);
  assert.equal(r.day, 4);
  assert.equal(r.res.scrap, 33);
  assert.deepEqual(r.chests, ['gold']);
  assert.equal(r.ui.screen, 'home');
  assert.equal(G.restore(null).day, 1);
  assert.equal(G.restore({ v: 99 }).day, 1);
});

test('view model is JSON-serializable for setData', () => {
  const s = G.newGame();
  G.startSalvage(s, seq(0.1, 0.5, 0.9));
  const vm = G.view(s);
  assert.doesNotThrow(() => JSON.stringify(vm));
  assert.equal(vm.salvage.items.length, 5);
});

// ---------- M1：章节 / 居民 / 风暴季 ----------
const ack = (s) => { const ids = []; while (s.ui.overlay) { ids.push(s.ui.overlay.id || s.ui.overlay.kind); G.press(s, 'enter'); } return ids; };
const sail = (s, kindWanted) => {
  // 出海并直接钩中指定种类的物品
  G.press(s, 'enter'); // 主界面焦点 0 = 出海打捞
  const sv = s.ui.salvage;
  const it = sv.items.find((x) => x.kind === kindWanted);
  if (it) sv.cursor = it.x + it.w / 2;
  G.press(s, 'enter');
  G.press(s, 'back');
  s.cooldown = 0;
  return it;
};

test('prologue plays on first launch; first trip finishes the prologue chapter', () => {
  const s = G.restore(null);
  assert.deepEqual(ack(s), ['prologue1', 'prologue2', 'prologue3']);
  assert.equal(s.chapter, 0);
  assert.equal(G.view(s).goal.text, '出海打捞一次');
  sail(s, 'scrap');
  assert.equal(s.chapter, 1);
  assert.deepEqual(ack(s), ['ch1'], 'chapter card pops after returning, not mid-salvage');
  assert.equal(G.view(s).goal.chapter, '第一章 · 第一口淡水');
});

test('drift survivor always spawns when due and joins with a bonus', () => {
  const s = G.newGame();
  s.chapter = 1; s.day = 1;
  G.startSalvage(s, () => 0.3);
  assert.ok(!s.ui.salvage.items.some((x) => x.kind === 'drift'), 'not before day 2');
  G.finishSalvage(s); s.cooldown = 0;
  s.day = 2;
  const before = G.costOf(s, 'shelter').scrap;
  const it = sail(s, 'drift');
  assert.ok(it, 'container spawned');
  assert.equal(s.npc.rivet, true);
  assert.deepEqual(ack(s), ['rivet_found', 'rivet_join']);
  assert.equal(G.costOf(s, 'shelter').scrap, Math.ceil(before * 0.9));
  assert.equal(G.residents(s), 1);
  G.startSalvage(s, () => 0.3);
  assert.ok(!s.ui.salvage.items.some((x) => x.kind === 'drift'), 'only once');
});

test('chapter advances when all goals are done', () => {
  const s = G.newGame();
  s.chapter = 1; s.seen.ch1 = true;
  s.lv.filter = 2; s.npc.rivet = true; s.lv.shelter = 2;
  G.press(s, 'down');
  assert.equal(s.chapter, 2);
  assert.equal(s.ui.overlay.id, 'ch2');
  assert.ok(G.view(s).menu.length >= 0);
  ack(s);
  s.ui.screen = 'build'; s.ui.focus = 0;
  assert.equal(G.view(s).menu.length, 3, 'eel generator appears in chapter 2');
});

test('storms: none before storm season, then every 3rd night, armor defends', () => {
  const s = G.newGame();
  s.day = 3; s.res.water = 99;
  G.endDay(s);
  assert.equal(s.hp, G.HP_MAX, 'no storm before chapter 3');
  assert.equal(G.view(s).stormText, '风暴季未到');
  ack(s);

  const t = G.newGame();
  t.chapter = 3; t.seen.ch3 = true; t.day = 9; t.res.water = 99; t.lv.shelter = 3;
  assert.equal(G.view(t).stormText, `今晚风暴潮 -${G.tideOf(9) - 36}`);
  G.endDay(t);
  assert.equal(t.hp, G.HP_MAX - (G.tideOf(9) - 36));
  assert.equal(t.flags.storm, true);
  assert.deepEqual(ack(t), ['report', 'storm']);
  assert.equal(G.view(t).stormText, '2 晚后风暴潮 -' + (G.tideOf(12) - 36));
  // 藤壶装甲
  t.res.scrap = 99; t.res.parts = 5;
  assert.equal(G.upgrade(t, 'armor'), true);
  assert.equal(G.defense(t), 46);
  assert.deepEqual(ack(t), ['armor']);
  t.day = 10; G.endDay(t);
  assert.equal(t.ui.overlay.lines[1], '平静的一夜');
});

test('residents drink water; the cook offsets one share', () => {
  const s = G.newGame();
  s.res.water = 50; s.npc = { rivet: true, coral: true };
  G.endDay(s);
  assert.equal(s.res.water, 50 - (3 + 0 + 2));
  const t = G.newGame();
  t.res.water = 50; t.npc = { rivet: true, coral: true, pot: true };
  G.endDay(t);
  assert.equal(t.res.water, 50 - (3 + 3 - 1));
  assert.ok(G.rates(t).gen === 0, 'no eels, no power even with coral');
});

test('v0.1 saves migrate into chapter 1 without replaying the prologue', () => {
  const old = G.newGame();
  delete old.chapter; delete old.npc; delete old.flags; delete old.seen; delete old.queue;
  delete old.lv.armor; delete old.ui;
  const s = G.restore(old);
  assert.equal(s.chapter, 1);
  assert.equal(s.lv.armor, 0);
  assert.equal(s.ui.overlay, null);
});

// ---------- M2：第四–六章 ----------
const atChapter = (n, extra = {}) => {
  const s = G.newGame();
  s.chapter = n;
  for (let i = 0; i <= n; i++) s.seen[`ch${i}`] = true;
  Object.assign(s.flags, { storm: true, ch4Day: 1, ch6Day: 1 }, extra);
  return s;
};

test('shelter Lv5 brings the builder: +5 defense, one more resident', () => {
  const s = G.newGame();
  s.lv.shelter = 4; s.res.scrap = 999; s.res.water = 999;
  const d = G.defense(s);
  G.upgrade(s, 'shelter');
  assert.equal(s.npc.beam, true);
  assert.equal(G.defense(s), d + 12 + 5);
  assert.deepEqual(ack(s), ['outpost', 'beam_join']);
});

test('chapter 4 unlocks workshop and crane; night work runs at day end', () => {
  const s = atChapter(4);
  s.ui.screen = 'build';
  const v = G.view(s);
  assert.deepEqual(v.menu.map((m) => m.label), ['庇护所', '海水过滤器', '电鳗发电机', '藤壶装甲']);
  assert.equal(v.moreDown, true, '6 rows scroll');
  s.ui.focus = 5;
  assert.equal(G.view(s).menu.at(-1).label, '寄居蟹吊机');
  assert.equal(G.view(s).moreUp, true);
  s.lv.octo = 2; s.lv.crab = 1; s.res.scrap = 10; s.res.water = 99; s.day = 2;
  G.endDay(s);
  // 吊机 +3 → 13，工坊两次：13-8=5，第二次不够
  assert.equal(s.res.scrap, 5);
  assert.equal(s.res.parts, 1);
  assert.match(s.ui.overlay.lines[1], /吊机 #\+3  工坊 ◇\+1/);
});

test('trader visits every 3 days from the day after chapter 4 starts', () => {
  const s = atChapter(4, { ch4Day: 10 });
  const days = [10, 11, 12, 13, 14, 15, 16, 17].filter((d) => G.traderDay(s, d));
  assert.deepEqual(days, [11, 14, 17]);
  s.day = 11; s.res.scrap = 50; s.res.water = 30; s.res.parts = 5;
  G.press(s, 'down'); // 触发 progress → 商人剧情
  assert.equal(s.ui.overlay.id, 'trader');
  ack(s);
  assert.equal(G.view(s).menu.length, 5);
  s.ui.focus = 4; G.press(s, 'enter');
  assert.equal(s.ui.screen, 'trade');
  assert.equal(G.view(s).menu.length, 3);
  const before = { ...s.res };
  assert.equal(G.trade(s, 0), true);
  assert.notDeepEqual(s.res, before);
  assert.equal(G.trade(s, 0), false, 'once per visit');
  assert.equal(s.flags.traded, true);
  G.press(s, 'back');
  assert.equal(s.ui.focus, 4, 'focus returns to the trader row');
  s.day = 12;
  assert.equal(G.view(s).menu.length, 4, 'trader is gone');
});

test('chapter 5: lighthouse uncle joins, turtle unlocks the wreck zone', () => {
  const s = atChapter(4);
  s.lv.shelter = 5; s.flags.traded = true; s.lv.octo = 1; s.lv.crab = 1;
  G.press(s, 'down');
  assert.equal(s.chapter, 5);
  assert.equal(s.npc.hawk, true);
  assert.deepEqual(ack(s), ['ch5', 'hawk_found', 'hawk_join']);
  assert.equal(G.view(s).goal.text, '建海龟拖船');
  s.res.scrap = 99; s.res.water = 50;
  assert.equal(G.upgrade(s, 'turtle'), true);
  assert.equal(G.costOf(s, 'turtle').locked, '沉城 · 第七章');
  ack(s);
  s.ui.screen = 'home'; s.ui.focus = 0;
  G.press(s, 'enter');
  assert.equal(s.ui.screen, 'zones');
  assert.deepEqual(G.view(s).menu.map((m) => m.label), ['近海', '残骸带']);
  G.press(s, 'down'); G.press(s, 'enter');
  assert.equal(s.ui.salvage.zone, 'wreck');
  assert.equal(s.flags.wreck, true);
  assert.equal(G.view(s).goal, null);
});

test('blueprints: guaranteed from the 3rd wreck trip, 3 pieces finish chapter 5', () => {
  const s = atChapter(5);
  s.npc.hawk = true; s.lv.turtle = 1;
  const noBp = () => 0.01; // 永远抽到废料
  for (let trip = 1; trip <= 2; trip++) {
    G.startSalvage(s, noBp, 'wreck');
    assert.ok(!s.ui.salvage.items.some((x) => x.kind === 'blueprint'));
    G.finishSalvage(s); s.cooldown = 0;
  }
  for (let n = 1; n <= 3; n++) {
    G.startSalvage(s, noBp, 'wreck');
    const bp = s.ui.salvage.items.find((x) => x.kind === 'blueprint');
    assert.ok(bp, `trip ${n + 2} has a blueprint`);
    s.ui.salvage.cursor = bp.x + bp.w / 2;
    G.dropHook(s);
    G.finishSalvage(s); s.cooldown = 0;
  }
  assert.equal(s.flags.blueprint, 3);
  G.startSalvage(s, noBp, 'wreck');
  assert.ok(!s.ui.salvage.items.some((x) => x.kind === 'blueprint'), 'none once collected');
  G.finishSalvage(s);
  s.flags.wreck = true;
  G.press(s, 'down');
  assert.equal(s.chapter, 6);
});

test('shark snaps an extra hook and costs 5 durability', () => {
  const s = atChapter(5);
  s.lv.turtle = 1;
  G.startSalvage(s, () => 0.99, 'wreck'); // 权重表最后一项 = 巨鲨
  const sh = s.ui.salvage.items.find((x) => x.kind === 'shark');
  assert.ok(sh);
  s.ui.salvage.cursor = sh.x + 0.1;
  G.dropHook(s);
  assert.equal(s.ui.salvage.hooks, G.HOOKS_PER_TRIP - 2);
  assert.equal(s.hp, G.HP_MAX - 5);
});

test('lantern beacon slows the cursor', () => {
  const s = G.newGame();
  G.startSalvage(s, () => 0.3);
  const base = s.ui.salvage.speed;
  G.finishSalvage(s); s.cooldown = 0;
  s.lv.lure = 2;
  G.startSalvage(s, () => 0.3);
  assert.ok(Math.abs(s.ui.salvage.speed - base * 0.8) < 1e-9);
});

test('pirates: night after a storm, fight or pay, win recruits the captain', () => {
  const s = atChapter(6, { ch6Day: 5 });
  s.res.water = 99;
  assert.equal(G.pirateNight(s, 7), true);
  assert.equal(G.pirateNight(s, 4), false, 'needs 2 days of warning');
  s.day = 6;
  assert.match(G.view(s).stormText, /^今晚风暴潮/);
  s.day = 7;
  assert.equal(G.view(s).stormText, `今晚海盗 · 战力 ${G.pirateForce(s, 7)}`);
  assert.equal(G.view(s).stormDanger, true);
  // 交：-50% 废料，下次战力 +10%
  s.res.scrap = 100;
  G.endDay(s);
  assert.equal(s.ui.overlay.kind, 'raid');
  G.press(s, 'back');
  assert.equal(s.res.scrap, 50);
  assert.equal(s.ui.overlay.kind, 'report');
  assert.match(s.ui.overlay.lines.join('|'), /交了保护费/);
  assert.equal(G.pirateForce(s, 10), Math.round((30 + 30) * 1.1));
  ack(s);
  // 打输：-20 耐久、-30% 废料
  s.day = 10; s.hp = 100; s.res.scrap = 100;
  G.endDay(s);
  G.press(s, 'enter');
  assert.equal(s.hp, 80);
  assert.equal(s.res.scrap, 70);
  ack(s);
  // 打赢：锈锚入住，海盗不再来
  s.day = 13; s.lv.shelter = 6; s.lv.armor = 3;
  assert.ok(G.defense(s) >= G.pirateForce(s, 13));
  G.endDay(s);
  G.press(s, 'enter');
  assert.equal(s.npc.rust, true);
  assert.deepEqual(ack(s), ['report', 'raid_win', 'rust_talk']);
  assert.equal(G.pirateNight(s, 16), false);
});

test('chapter 6 finishes into chapter 7, which unlocks turtle Lv2', () => {
  const s = atChapter(6);
  s.lv.lure = 1; s.npc.rust = true; s.lv.shelter = 6; s.lv.turtle = 1;
  G.press(s, 'down');
  assert.equal(s.chapter, 7);
  assert.equal(G.view(s).goal.text, '海龟拖船升到 Lv2');
  assert.equal(G.costOf(s, 'turtle').scrap, Math.ceil(90 * 1)); // 无铆钉
});

test('saves from the old chapter-4 placeholder pick up chapter 4 timers', () => {
  const old = G.newGame();
  old.chapter = 4; old.day = 20;
  const s = G.restore(JSON.parse(JSON.stringify(G.serialize(old))));
  assert.equal(s.flags.ch4Day, 20);
  assert.equal(s.lv.octo, 0);
});

// ---------- M3：第七–八章 / 结局 / 自由模式 / 存档 v2 ----------
const ALL_BEFORE_7 = { rivet: true, coral: true, pot: true, beam: true, hawk: true, rust: true };
const clearStory = (s) => { s.queue = []; s.ui.overlay = null; };

test('chapter 7: sunken city, the diver, a guaranteed keycard, then the lab', () => {
  const s = atChapter(7); Object.assign(s.npc, ALL_BEFORE_7);
  s.lv.turtle = 1; s.res.scrap = 999; s.res.water = 999; s.res.parts = 99;
  assert.equal(G.upgrade(s, 'turtle'), true);
  assert.deepEqual(ack(s), ['sunken_zone']);
  assert.deepEqual(G.zonesOf(s), ['near', 'wreck', 'sunken']);
  const scrapOnly = () => 0.01;
  // 第 1 趟：气泡的断气管必出；救起后沉城多 1 钩
  G.startSalvage(s, scrapOnly, 'sunken');
  const drift = s.ui.salvage.items.find((x) => x.kind === 'drift');
  assert.equal(drift && drift.npc, 'bubble');
  s.ui.salvage.cursor = drift.x + drift.w / 2;
  G.dropHook(s);
  assert.equal(s.npc.bubble, true);
  assert.ok(s.seen.bubble_found);
  G.finishSalvage(s); s.cooldown = 0;
  // 第 2 趟：4 钩，还没有门禁卡
  G.startSalvage(s, scrapOnly, 'sunken');
  assert.equal(s.ui.salvage.hooks, G.HOOKS_PER_TRIP + 1);
  assert.equal(G.view(s).salvage.hooks.length, G.HOOKS_PER_TRIP + 1);
  assert.ok(!s.ui.salvage.items.some((x) => x.kind === 'keycard'));
  G.finishSalvage(s); s.cooldown = 0;
  // 第 3 趟：门禁卡必出
  G.startSalvage(s, scrapOnly, 'sunken');
  const card = s.ui.salvage.items.find((x) => x.kind === 'keycard');
  assert.ok(card, 'keycard forced on the 3rd trip');
  s.ui.salvage.cursor = card.x + card.w / 2;
  G.dropHook(s);
  assert.equal(s.flags.keycard, true);
  G.finishSalvage(s); s.cooldown = 0;
  clearStory(s);
  // 海域列表多出实验室；下潜后进入第八章
  assert.deepEqual(G.zonesOf(s), ['near', 'wreck', 'sunken', 'lab']);
  G.press(s, 'enter');
  assert.equal(s.ui.screen, 'zones');
  G.press(s, 'up'); // 回绕到最后一项：实验室
  assert.equal(G.view(s).menu.at(-1).label, '沉没实验室');
  G.press(s, 'enter');
  assert.equal(s.flags.lab, true);
  assert.equal(s.ui.screen, 'home');
  assert.equal(s.chapter, 8);
  assert.deepEqual(ack(s), ['lab', 'lin', 'tidesong', 'truth', 'ch8', 'engine']);
  assert.ok(!G.zonesOf(s).includes('lab'), 'one dive only');
  assert.equal(G.residents(s), Object.keys(s.npc).length);
  assert.ok(!s.npc.lin, 'lab survivors do not drink from the shelter');
});

test('jellyfish slows the cursor by 30% for the trip', () => {
  const s = G.newGame();
  s.lv.turtle = 2;
  G.startSalvage(s, () => 0.999, 'sunken'); // 权重表最后一项 = 水母
  const sv = s.ui.salvage;
  const base = sv.speed;
  const j = sv.items.find((x) => x.kind === 'jelly');
  assert.ok(j);
  sv.cursor = j.x + 0.1;
  G.dropHook(s);
  assert.ok(Math.abs(sv.speed - base * 0.7) < 1e-9);
});

test('octopus nights: after the sunken city opens, storms hit 20% harder', () => {
  const s = G.newGame();
  s.chapter = 7; s.seen.ch3 = true; s.seen.ch7 = true; s.day = 30; s.res.water = 99;
  s.lv.shelter = 7; s.lv.armor = 3; // 防 114，潮 130
  const base = G.tideOf(30) - G.defense(s);
  assert.ok(base > 0);
  assert.equal(G.stormDamage(s, 30), base);
  s.lv.turtle = 2;
  assert.equal(G.stormDamage(s, 30), Math.round(base * 1.2));
  const hp = s.hp;
  G.endDay(s);
  assert.equal(s.hp, Math.max(0, hp - Math.round(base * 1.2)));
  assert.match(s.ui.overlay.lines.join(' '), /风暴潮\+章鱼 -/);
  const order = ack(s);
  assert.ok(order.includes('octopus_night'));
  assert.ok(order.indexOf('octopus_night') > order.indexOf('report'));
});

test('bottle letters: a line from another drifter, rotating through 10', () => {
  const s = G.newGame();
  s.seen.prologue = true;
  for (let i = 0; i < 11; i++) {
    G.startSalvage(s, () => 0.999, 'near'); // 近海权重表最后一项 = 漂流瓶
    const sv = s.ui.salvage;
    const b = sv.items.find((x) => x.kind === 'letter');
    assert.ok(b, 'letter spawned');
    sv.cursor = b.x + 0.1;
    G.dropHook(s);
    assert.equal(sv.last, `漂流瓶：「${G.LETTERS[i % 10]}」`);
    assert.deepEqual(sv.haul, ['漂流瓶']);
    G.finishSalvage(s, true);
    s.cooldown = 0;
  }
  assert.equal(s.flags.letters, 11);
});

const toArk = () => {
  const s = atChapter(8);
  Object.assign(s.npc, ALL_BEFORE_7, { bubble: true });
  s.lv.shelter = 7; s.res.scrap = 999; s.res.water = 50; s.res.parts = 99;
  assert.equal(G.upgrade(s, 'shelter'), true);
  G.press(s, 'down'); // progress → 方舟建成
  return s;
};

test('ending: the ark, Baisha, broadcast → free mode with daily scrap and no sinking', () => {
  const s = toArk();
  assert.deepEqual(ack(s), ['ark', 'confront', 'choice', 'end_broadcast', 'hook']);
  assert.equal(s.ending, 'broadcast');
  assert.equal(s.chapter, G.CHAPTER_COUNT - 1);
  assert.equal(G.view(s).goal.text, '广播结局 · 每天 #+10');
  s.day = 30; s.hp = 5; s.res.water = 0; s.res.scrap = 0;
  G.endDay(s);
  assert.equal(s.over, false);
  assert.equal(s.hp, 1);
  assert.equal(s.res.scrap, 10);
});

test('ending: handing over the plans means no more drinking water cost', () => {
  const s = toArk();
  assert.equal(s.ui.overlay.id, 'ark'); G.press(s, 'enter');
  assert.equal(s.ui.overlay.id, 'confront'); G.press(s, 'enter');
  assert.equal(s.ui.overlay.kind, 'choice');
  assert.equal(G.press(s, 'back'), true, 'back answers the choice, does not exit');
  assert.equal(s.ending, 'deal');
  assert.deepEqual(ack(s), ['end_deal', 'hook']);
  const w = s.res.water;
  G.endDay(s);
  assert.equal(s.res.water, w);
});

test('a choice lost to a save is asked again after loading', () => {
  const s = toArk();
  G.press(s, 'enter'); G.press(s, 'enter');
  assert.equal(s.ui.overlay.kind, 'choice');
  const r = G.restore(JSON.parse(JSON.stringify(G.serialize(s))));
  assert.equal(r.ui.overlay.kind, 'choice');
  assert.equal(r.ending, null);
});

test('saves are v2; v0.1 saves infer the chapter from levels', () => {
  assert.equal(G.newGame().v, 2);
  const old = G.newGame();
  delete old.chapter; delete old.npc; delete old.flags; delete old.seen; delete old.queue; delete old.ui; delete old.ending;
  old.v = 1; old.won = true; old.arkSeen = true;
  Object.assign(old.lv, { shelter: 4, filter: 3, eel: 2 });
  const s = G.restore(JSON.parse(JSON.stringify(old)));
  assert.equal(s.v, 2);
  assert.equal(s.chapter, 4);
  assert.deepEqual(Object.keys(s.npc).sort(), ['coral', 'pot', 'rivet']);
  assert.equal(s.flags.ch4Day, s.day);
  assert.equal(s.ui.overlay, null, 'nothing replays');
  assert.equal('won' in s, false);
});

// ---------- 居民派遣与聊天 ----------
const crewGame = () => { const s = G.newGame(); s.npc.rivet = true; s.res.water = 10; return s; };

test('crew: home shows 居民 once someone lives aboard; enter → list → resident page', () => {
  const s = G.newGame();
  assert.ok(!G.view(s).menu.some((m) => m.label === '居民'));
  s.npc.rivet = true;
  const idx = G.view(s).menu.findIndex((m) => m.label === '居民');
  assert.equal(idx, 3, 'before 修补');
  s.ui.focus = idx;
  G.press(s, 'enter');
  assert.equal(s.ui.screen, 'crew');
  assert.equal(G.view(s).menu[0].label, '铆钉');
  G.press(s, 'enter');
  assert.equal(s.ui.screen, 'mate');
  const vm = G.view(s);
  assert.deepEqual(vm.menu.map((m) => m.label), ['派遣 · 近海', '聊聊']);
  G.press(s, 'back');
  assert.equal(s.ui.screen, 'crew');
  G.press(s, 'back');
  assert.equal(s.ui.screen, 'home');
  assert.equal(s.ui.focus, idx, 'focus returns to 居民');
});

test('crew: dispatch costs water, returns after DISPATCH_SECS with loot and a report', () => {
  const s = crewGame();
  s.ui.screen = 'mate'; s.ui.mate = 'rivet'; s.ui.focus = 0;
  G.press(s, 'enter');
  assert.equal(s.res.water, 10 - G.DISPATCH_WATER);
  assert.ok(s.crew.rivet);
  assert.equal(s.ui.screen, 'crew');
  assert.equal(G.dispatch(s, 'rivet', 'near'), false, 'already away');
  const scrap = s.res.scrap;
  G.tick(s, G.DISPATCH_SECS - 1, () => 0);
  assert.ok(s.crew.rivet, 'not back yet');
  G.tick(s, 1, () => 0); // rng 0 → scrap
  assert.ok(!s.crew.rivet);
  assert.ok(s.res.scrap > scrap);
  assert.equal(s.ui.overlay.kind, 'crew');
  assert.equal(s.ui.overlay.haul.length, 2);
  assert.equal(s.bond.rivet, 1);
});

test('crew: no water, no dispatch', () => {
  const s = crewGame(); s.res.water = 1;
  assert.equal(G.dispatch(s, 'rivet', 'near'), false);
  assert.match(s.ui.msg, /口粮不够/);
});

test('crew: specialty zone and bond ≥3 each add one item', () => {
  const s = crewGame();
  assert.equal(G.dispatchSize(s, 'rivet', 'near'), 2);
  assert.equal(G.dispatchSize(s, 'rivet', 'wreck'), 3);
  s.bond.rivet = 3;
  assert.equal(G.dispatchSize(s, 'rivet', 'wreck'), 4);
});

test('crew: a shark costs one item', () => {
  const s = crewGame(); s.lv.turtle = 1; s.chapter = 5;
  assert.ok(G.zonesOf(s).includes('wreck'));
  G.dispatch(s, 'rivet', 'wreck');
  G.tick(s, G.DISPATCH_SECS, () => 0.999); // last entry in the wreck table → shark
  const o = s.ui.overlay;
  assert.equal(o.kind, 'crew');
  assert.ok(o.lines[0].includes('巨鲨'));
  assert.ok(o.haul.length < G.dispatchSize(s, 'rivet', 'wreck'));
});

test('crew: return report waits for salvage and story overlays', () => {
  const s = crewGame();
  G.dispatch(s, 'rivet', 'near');
  assert.ok(G.startSalvage(s, () => 0));
  s.crew.rivet.left = 0.01;
  G.tick(s, 1, () => 0);
  assert.equal(s.ui.overlay, null, 'not mid-salvage');
  assert.equal(s.returns.length, 1);
  while (s.ui.salvage) G.press(s, s.ui.salvage.done ? 'enter' : 'back');
  while (s.ui.overlay && s.ui.overlay.kind !== 'crew') G.press(s, 'enter');
  assert.equal(s.ui.overlay.kind, 'crew');
  G.press(s, 'enter');
  assert.equal(s.ui.overlay, null);
});

test('crew: talk rotates lines, bond +1 once per day, warns on a dangerous night', () => {
  const s = crewGame();
  G.talk(s, 'rivet');
  assert.equal(s.ui.overlay.kind, 'talk');
  assert.equal(s.ui.overlay.lines[0], `「${G.CREW.rivet.lines[0]}」`);
  assert.equal(s.bond.rivet, 1);
  s.ui.overlay = null;
  G.talk(s, 'rivet');
  assert.equal(s.ui.overlay.lines[0], `「${G.CREW.rivet.lines[1]}」`);
  assert.equal(s.bond.rivet, 1, 'same day');
  s.ui.overlay = null;
  s.chapter = G.STORM_CHAPTER; s.day = 3; s.lv.shelter = 1;
  G.talk(s, 'rivet');
  assert.equal(s.ui.overlay.lines[0], `「${G.CREW.rivet.warn}」`);
  assert.equal(s.bond.rivet, 2, 'new day');
});

test('crew: away residents cannot talk', () => {
  const s = crewGame();
  G.dispatch(s, 'rivet', 'near');
  assert.equal(G.talk(s, 'rivet'), false);
});

test('crew: save round trip keeps crew, bond and pending returns', () => {
  const s = crewGame();
  G.dispatch(s, 'rivet', 'near');
  s.bond.rivet = 2;
  s.returns.push({ npc: 'rivet', zone: 'near', haul: ['废料+3'], shark: false });
  const r = G.restore(JSON.parse(JSON.stringify(G.serialize(s))));
  assert.equal(r.crew.rivet.zone, 'near');
  assert.equal(r.bond.rivet, 2);
  assert.equal(r.ui.overlay.kind, 'crew', 'pending report shows on load');
  assert.equal(r.returns.length, 0);
});

test('crew: LLM prompt carries persona and state, the model only supplies words', () => {
  const s = crewGame();
  G.talk(s, 'rivet');
  const p = G.talkPrompt(s, s.ui.overlay);
  assert.ok(p.system.includes(G.CREW.rivet.persona));
  assert.ok(p.user.includes('第1天'));
  assert.equal(p.voice, 'male-qn-qingse');
  assert.equal(p.fallback, s.ui.overlay.lines[0]);
  assert.equal(G.clipLine('「一二三四五六七八九十一二三四五六七」'), '一二三四五六七八九十一二三四五…');
});
