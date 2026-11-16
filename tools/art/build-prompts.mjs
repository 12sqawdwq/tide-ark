// 生成《潮汐方舟》原创线稿提示词清单 → art/prompts.jsonl
// 每行 { id, category, subject, prompt }；所有条目共用同一风格前缀，保证整套风格统一。
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../../art/', import.meta.url));

export const STYLE = [
  'Original line-art illustration for "Tide Ark", a post-apocalyptic flooded-world survival game.',
  'Style: clean technical ink line drawing, uniform 3px black strokes on pure white background,',
  'no fill, no shading, no gradients, no hatching, no text, no logos, no watermark.',
  'Simple bold silhouette readable when shrunk to 96px, slightly rounded hand-made salvage aesthetic,',
  'rope, rivets, corrugated metal, patched planks. Centered subject, generous white margin, square 1:1.',
].join(' ');

const VIEWS = ['three-quarter front view', 'side view', 'top-down view'];

const SHELTER = [
  'a single tilted wooden pallet raft with a tarp lean-to and one barrel float',
  'a lashed raft of three pallets with a tarp tent, rain bucket and rope railing',
  'a raft built on oil drums with a corrugated-metal hut and a small crane arm',
  'a two-room houseboat of scrap planks with a lookout ladder and hanging lantern',
  'a floating platform of shipping-container halves with a wind vane and walkway',
  'a two-deck salvage barge with a water tower, cable winch and patched sail',
  'a fortified floating outpost with wave-breaker spikes, solar panels and a radio mast',
  'a large ark vessel assembled from many scrap modules, tall mast, closed hull, ready to sail',
];

const FILTER = [
  'a plastic bottle sand-and-charcoal drip filter',
  'a bucket stack filter with cloth layers and a spout',
  'a barrel filter with a hand pump and hose',
  'a solar still with a slanted glass panel over a tray',
  'a tank filter with a crank-driven membrane drum',
  'a twin-cylinder pressure filter with gauges and pipes',
];

const EEL = [
  'a mesh cage with one coiled electric eel and copper wires to a car battery',
  'a glass tank with two electric eels and a crude coil transformer',
  'a pipe-ring aquarium where eels swim in a loop past copper plates',
  'a large eel pond enclosure with insulated cables to a capacitor bank',
  'a sealed eel reactor drum with spark gap, gauges and cable spools',
];

const CHESTS = [
  ['wooden crate', 'two rope knots and a rusty hasp'],
  ['iron strongbox', 'three padlocks and riveted straps'],
  ['brass-bound treasure trunk', 'four combination dials and ornate corners'],
];
const CHEST_STATES = ['closed, sealed', 'half-open with lid ajar', 'fully open showing salvaged loot inside'];

const SALVAGE = [
  'a filter cartridge in a sealed bag', 'a coil of nylon rope', 'a bundle of planks tied with wire',
  'a rusty sheet of corrugated metal', 'a dented oil drum', 'a car tire', 'a plastic jerrycan',
  'a tangled fishing net', 'a waterlogged backpack', 'a toolbox with a broken latch',
  'a solar panel with a cracked corner', 'a car battery', 'a spool of copper wire', 'a hand-crank radio',
  'a flashlight', 'a first-aid kit', 'a sealed food tin', 'a glass bottle with a rolled note',
  'a compass', 'a pair of binoculars', 'a life ring', 'an inflatable dinghy, half deflated',
  'a ship steering wheel', 'a small anchor', 'a grappling hook on rope', 'a traffic cone',
  'a shopping cart', 'a broken umbrella', 'a floating door', 'a wooden chair',
  'a rubber duck toy', 'a guitar with two strings', 'a street sign bent in half', 'a bicycle wheel',
  'a ceramic mug', 'a wrench and pliers', 'a roll of duct tape', 'a tarp folded square',
  'a crate of empty bottles', 'a mysterious sealed metal canister with valves',
];

const SEA = [
  'calm sea with gentle ripples under a low sun', 'choppy waves with whitecaps', 'a huge rolling swell',
  'a storm surge wall of water approaching', 'heavy rain falling on the sea', 'thick fog over still water',
  'a lightning storm over dark waves', 'a whirlpool', 'a waterspout tornado', 'night sea under a full moon',
  'starry night sky over a flat sea', 'sunrise over a drowned horizon', 'a rainbow after a storm',
  'floating debris field', 'an oil slick with drifting barrels', 'a cluster of floating ice chunks',
  'seagulls circling above waves', 'wind arrows over a choppy sea with a pennant', 'a tidal gauge pole half submerged',
  'calm water reflecting clouds',
];

const CREATURES = [
  'the survivor protagonist in a raincoat and rubber boots, standing, front view',
  'the survivor casting a grappling hook', 'the survivor hammering a plank', 'the survivor rowing a small boat',
  'the survivor looking through binoculars', 'the survivor drinking from a canteen',
  'the survivor sleeping in a hammock', 'the survivor opening a crate with a crowbar',
  'the survivor turning a filter pump crank', 'the survivor cheering with both arms up',
  'an elderly mechanic survivor with goggles and a tool belt', 'a young scout survivor with a backpack and whistle',
  'a radio operator survivor with headphones', 'a cook survivor stirring a pot',
  'a stray dog on a floating plank', 'a cat sitting on an oil drum', 'a seagull holding a fish',
  'a pelican', 'a sea turtle', 'a jellyfish', 'a school of small fish', 'a curious seal',
  'a crab on a tire', 'a friendly electric eel with a spark around it, mascot pose',
  'a sleeping electric eel coiled', 'a huge shadow of a sea creature under the raft',
  'a shark fin circling', 'an octopus clinging to a barrel', 'a dolphin jumping', 'a heron standing in shallow water',
];

const ICONS = [
  'scrap pile', 'water droplet', 'lightning bolt', 'filter cartridge diamond', 'coiled eel',
  'hammer', 'wrench', 'hook', 'anchor', 'chest', 'padlock', 'unlocked padlock', 'key',
  'heart shield (durability)', 'clock', 'sun', 'moon', 'cloud with rain', 'storm wave', 'warning triangle',
  'check mark in a circle', 'cross in a circle', 'up arrow', 'down arrow', 'plus', 'minus',
  'gear', 'battery level', 'water tank level', 'house raft', 'compass rose', 'map scroll',
  'flag', 'star', 'trophy', 'skull and crossed bones', 'save disk', 'bell', 'radio waves', 'pause',
];

const STORY = [
  'the city skyline swallowed by rising sea, title illustration',
  'the survivor waking on a lone pallet raft in endless water',
  'the first salvage: a filter cartridge caught on a hook',
  'the first clean water dripping from a homemade filter',
  'discovering an electric eel tangled in a net',
  'the eel generator lighting a single bulb at night',
  'a storm surge crashing against the shelter walls',
  'the shelter after a storm, patched and standing',
  'other survivors joining the growing floating outpost',
  'the completed ark sailing toward a distant green island, ending illustration',
];

const RUINS = [
  'a half-submerged skyscraper with broken windows', 'a drowned gas station with only the roof sign above water',
  'a flooded highway overpass', 'a church bell tower poking out of the sea', 'a sunken bus with its roof above water',
  'a radio tower leaning in the water', 'a ferris wheel rising from the sea', 'a drowned lighthouse still standing',
  'a water tower on stilts above the flood', 'a cargo ship run aground and tilted',
  'a flooded subway entrance', 'rooftops of a drowned suburb', 'a stadium rim above the waterline',
  'a crane on a sunken construction site', 'a floating market of lashed boats', 'a wrecked airplane tail fin in the sea',
  'a drowned forest of dead tree tops', 'a bridge broken in the middle', 'a supermarket sign floating', 'a distant green island with palm trees',
];

const EVENTS = [
  'a storm surge warning flag on a pole', 'sandbags stacked against a raft wall', 'a crack splitting a shelter plank',
  'waves washing over a raft deck', 'a broken rope snapping', 'a leak spraying water from a patched hull',
  'a patch being nailed over a hole', 'a lightning strike on a metal mast', 'a capsized barrel floating', 'calm after the storm with dripping eaves',
];

// ---------- 深蓝纪元扩展（原创设施 / 角色 / 地点 / 剧情物件） ----------
const DEVICES = [
  ['octo', 'octopus workshop: a living octopus in a riveted tank works scrap with its tentacles on a small anvil bench', [
    'a single barrel tank and a crude plank workbench',
    'a bigger tank with pipes, two benches and hanging tools',
    'a glass-domed workshop with conveyor belt and tentacles holding many tools']],
  ['crab', 'hermit crab crane: a giant hermit crab living in a rusty oil-drum shell, its claw is a crane hook lifting scrap from the water', [
    'small crab, short wooden boom', 'medium crab, steel boom with pulley', 'huge crab in a ship-funnel shell, tall lattice crane arm']],
  ['lure', 'anglerfish beacon: a deep-sea anglerfish in a cage frame whose glowing lure lamp hangs over the water as a salvage beacon', [
    'small fish in a wire cage on a pole', 'larger fish in a riveted lantern housing with reflector', 'huge fish mounted on a lighthouse-like tower']],
  ['turtle', 'sea turtle tugboat: a huge sea turtle harnessed with ropes and a tow bar pulling a raft', [
    'turtle with a simple rope harness and plank saddle', 'turtle with a steel tow frame, cabin and searchlight on its shell']],
  ['barnacle', 'barnacle armor: barnacle-covered armor plates bolted onto a shelter wall to stop storm waves', [
    'a few patched plates with small barnacle clusters', 'overlapping plates covered in barnacles, wave breakers', 'full hull plating thick with giant barnacles and spikes']],
];
const NPCS = [
  'a sturdy raft survivor with a torn wide-brimmed straw hat, life vest and coiled grappling rope at the waist, half-body portrait',
  'a young woman engineer with a welding mask pushed up on her forehead and a harness full of tools, half-body portrait',
  'an old navigator with a long oilskin raincoat, a brass spyglass and a wooden peg leg, half-body portrait',
  'a marine creature scholar with a belt of sample jars, diving boots and a notebook, half-body portrait',
  'a pirate chief with an anchor-chain shawl and a serrated cutlass, half-body portrait',
  'a city-state water ration officer in a stiff high-collar uniform holding a clipboard of water tickets and a stamp, half-body portrait',
  'a cheerful shelter cook with a head scarf and a long ladle over a pot, half-body portrait',
  'a deep salvage diver in a brass helmet diving suit with air hoses, full body',
  'an old-world researcher in a torn lab coat clutching a waterproof document case, half-body portrait',
  'a travelling trader carrying a tall wooden backpack frame stacked with goods, full body',
  'a shelter builder with a hard hat, measuring tape and a steel beam on the shoulder, half-body portrait',
  'a mutated human with gill slits on the neck and webbed hands, calm expression, half-body portrait',
];
const PLACES = [
  'the exterior of a sunken laboratory dome on the seabed with broken windows and cables',
  'the flooded interior of a sunken laboratory with tanks, consoles and drifting papers',
  'a floating city-state skyline of stacked platforms, cranes and water towers',
  'a pirate fortress built from wrecked ships chained together',
  'a long queue of survivors waiting at a water ration window with a ticket booth',
];
const LORE = [
  'a sealed project dossier folder with a wave emblem stamp, papers spilling out',
  'a rolled-out blueprint of an electric eel generator pinned by a wrench and stones',
  'a mutant giant shark with scarred skin and too many teeth breaching the surface',
  'a mutant giant octopus wrapping its tentacles around a sinking boat',
  'a deep sea trench with glowing jellyfish and strange luminous creatures',
];

const items = [];
const add = (category, id, subject) => items.push({ id, category, subject, prompt: `${STYLE} Subject: ${subject}.` });
const pad = (n) => String(n).padStart(2, '0');

SHELTER.forEach((s, i) => VIEWS.forEach((v, j) =>
  add('shelter', `shelter-lv${i + 1}-${['front', 'side', 'top'][j]}`, `shelter level ${i + 1} of 8: ${s}, ${v}`)));
FILTER.forEach((s, i) => ['front', 'side'].forEach((v) =>
  add('filter', `filter-lv${i + 1}-${v}`, `seawater filter level ${i + 1}: ${s}, ${v} view`)));
EEL.forEach((s, i) => ['front', 'side'].forEach((v) =>
  add('eel-generator', `eel-lv${i + 1}-${v}`, `electric eel generator level ${i + 1}: ${s}, ${v} view`)));
CHESTS.forEach(([name, locks], i) => CHEST_STATES.forEach((st, j) =>
  add('chest', `chest-${['wood', 'iron', 'gold'][i]}-${['closed', 'ajar', 'open'][j]}`, `a ${name} with ${locks}, ${st}`)));
SALVAGE.forEach((s, i) => add('salvage', `salvage-${pad(i + 1)}`, `floating salvage item: ${s}, bobbing on a small water line`));
SEA.forEach((s, i) => add('sea', `sea-${pad(i + 1)}`, `wide landscape vignette: ${s}`));
CREATURES.forEach((s, i) => add('character', `char-${pad(i + 1)}`, s));
ICONS.forEach((s, i) => add('icon', `icon-${pad(i + 1)}`, `a single minimal UI pictogram icon: ${s}, thick simple strokes, fits a circle`));
STORY.forEach((s, i) => add('story', `story-${pad(i + 1)}`, `cinematic story illustration: ${s}`));
RUINS.forEach((s, i) => add('ruins', `ruins-${pad(i + 1)}`, `wide landscape vignette of the drowned world: ${s}`));
EVENTS.forEach((s, i) => add('event', `event-${pad(i + 1)}`, `storm event vignette: ${s}`));
DEVICES.forEach(([key, base, lvls]) => lvls.forEach((l, i) =>
  add('device', `${key}-lv${i + 1}-front`, `bio-mechanical shelter device, ${base}; level ${i + 1} of ${lvls.length}: ${l}, three-quarter front view`)));
NPCS.forEach((s, i) => add('npc', `npc-${pad(i + 1)}`, `character design, original drowned-world survivor: ${s}`));
PLACES.forEach((s, i) => add('place', `place-${pad(i + 1)}`, `wide landscape vignette of the drowned world: ${s}`));
LORE.forEach((s, i) => add('lore', `lore-${pad(i + 1)}`, `cinematic story illustration: ${s}`));

// 定调样张：每个大类挑一张，先出这批确认风格
export const ANCHORS = [
  'shelter-lv1-front', 'shelter-lv5-front', 'filter-lv3-front', 'eel-lv2-front', 'chest-iron-closed',
  'salvage-01', 'char-01', 'char-24', 'icon-03', 'ruins-01',
];

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_DIR + 'prompts.jsonl', items.map((x) => JSON.stringify(x)).join('\n') + '\n');
const ids = new Set(items.map((x) => x.id));
if (ids.size !== items.length) throw new Error('duplicate ids');
for (const a of ANCHORS) if (!ids.has(a)) throw new Error('missing anchor ' + a);
console.log(`wrote ${items.length} prompts → art/prompts.jsonl`);
