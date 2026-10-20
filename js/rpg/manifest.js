// RPG 冒險模式的美術清單（共 34 張）＋ Kling 生成提示詞。
// 圖片放在 assets/rpg/<id>.webp（角色圖已去背成透明）；缺圖時遊戲會用內建的卡通替代圖。
// 用可靈網頁版生成：1K、每次 1 張；精靈圖 1:1、背景 16:9。
(function (root) {
  'use strict';

  // 《怪獸電力公司》＋《海賊王》混合畫風。
  // 注意：提示詞裡直接寫作品名稱或角色名，可靈會因版權限制拒絕生成，所以改用風格描述。
  const STYLE = 'bold Japanese shonen pirate-adventure anime style with dynamic exaggerated energy, vibrant colors, exaggerated expressions, solid white background, full body view, thick comic line art';
  const BASE = `2D cartoon game sprite of a quirky furry whimsical monster like from a cute 3D animated monster movie, big round eyes, fuzzy fur, odd body shape, ${STYLE}`;
  // 主角：4 階都寫同一個原創長相，才會像同一個人換裝；不寫「海賊」字樣，避免畫成知名角色
  const HERO = '2D cartoon game sprite of an original kid adventurer hero facing right, the same boy with brown spiky hair, a green headband and big brown eyes, cute chubby proportions, energetic anime style with dynamic exaggerated energy, vibrant colors, exaggerated expressions, solid white background, full body view, thick comic line art';
  // 介面圖：只要物件本身，不要角色
  const ITEM = 'thick comic outlines, vibrant colors, solid white background, object only, no characters, no people';
  const SCENE = '2D side-scrolling game background, seamless horizontally tileable, wide panorama, whimsical cartoon adventure style, vibrant colors, bold comic outlines, flat ground strip along the bottom, no characters, no text';
  // Kling 不吃 --no 語法，改放 negative_prompt
  const NEG_SPRITE = 'floor, shadows, background elements, text, watermark';
  const NEG_SCENE = 'characters, people, monsters, text, watermark';

  const sprite = (id, name, extra, base = BASE) => ({ id, name, prompt: `${base}, ${extra}`, negative: NEG_SPRITE, ratio: '1:1' });
  const scene = (id, name, extra) => ({ id, name, prompt: `${SCENE}, ${extra}`, negative: NEG_SCENE, ratio: '16:9' });

  root.RPG_MANIFEST = {
    dir: 'assets/rpg/',

    // 人物造型 4 張：依「冒險關數」換裝，換過就不會退回
    heroes: [
      sprite('hero-1', 'Lv.1 初階冒險者', 'simple tunic, wooden stick sword, small backpack, eager smile', HERO),
      sprite('hero-2', 'Lv.2 見習勇者', 'flowing red cape, leather armor, short steel sword, confident grin', HERO),
      sprite('hero-3', 'Lv.3 精英戰士', 'light shiny metal armor, glowing blue energy sword, heroic pose', HERO),
      sprite('hero-4', 'Lv.4 傳奇大將', 'long dark captain coat with gold trim draped over shoulders, legendary golden sword, overwhelming heroic aura, crackling red energy around the body', HERO),
    ],

    // 背景 4 張：單字星 2、句型星 2（橫向平鋪循環捲動）
    backgrounds: {
      vocab: [
        scene('bg-forest', '單字星・森林', 'bright magical forest with giant mushrooms and round trees, sunny sky'),
        scene('bg-canyon', '單字星・峽谷', 'orange rocky canyon with layered cliffs and wooden bridges, warm sunset sky'),
      ],
      sentence: [
        scene('bg-factory', '句型星・機械工廠', 'whimsical machine factory with pipes, gears and conveyor belts, steam puffs'),
        scene('bg-wasteland', '句型星・紫霧荒野', 'mysterious purple fog wasteland with glowing crystals and twisted dead trees, starry sky'),
      ],
    },

    // 單字星小怪 12 張（對應 12 個一般關卡，依序）
    vocabMonsters: [
      sprite('mon-v01', '水果怪', 'round fruit-themed monster with a leaf on its head, one big eye, juicy colors'),
      sprite('mon-v02', '寵物怪', 'fluffy puppy-like furry monster with three eyes and floppy ears'),
      sprite('mon-v03', '叢林怪', 'striped jungle monster with vine hair and tiger tail, two eyes'),
      sprite('mon-v04', '彩虹怪', 'rainbow-colored gooey slime monster with many tiny eyes'),
      sprite('mon-v05', '文具怪', 'pencil and eraser shaped school supplies monster with googly eyes'),
      sprite('mon-v06', '甜點怪', 'cake and candy monster with frosting fur and sprinkles, sweet tooth'),
      sprite('mon-v07', '大鼻怪', 'monster with a giant nose, huge ears and wiggly arms, silly face'),
      sprite('mon-v08', '圍裙怪', 'chef-hat wearing furry monster holding a ladle, two eyes'),
      sprite('mon-v09', '雲朵怪', 'fluffy cloud monster with tiny lightning bolts and sleepy eyes'),
      sprite('mon-v10', '玩具怪', 'wind-up toy robot monster with a key on its back, spring arms'),
      sprite('mon-v11', '運動怪', 'sporty monster wearing a sweatband, holding a ball, muscular legs'),
      sprite('mon-v12', '心情怪', 'mood monster with two faces, one happy and one grumpy, color-changing fur'),
    ],

    // 單字星魔王 3 張（猙獰度 1 → 3）
    bosses: [
      sprite('boss-1', '落葉魔王', 'autumn leaf theme, slightly angry, small sharp horns, devious smirking expression, bulkier build'),
      sprite('boss-2', '流星魔王', 'meteor and space theme, furious hulking muscular beast, multiple glowing eyes, sharp fangs, aggressive posture, intense shading'),
      sprite('boss-3', '煙火大魔王', 'fireworks theme, extremely grotesque and terrifying monstrous overlord, giant oni warlord menacing aura, dark purple flame aura, jagged giant teeth, fierce glowing red eyes, demonic warlord form'),
    ],

    // 句型星怪獸 9 張（對應 9 關）
    sentenceMonsters: [
      sprite('mon-s01', '招手怪', 'friendly waving monster with a giant hand, big smile, one eye'),
      sprite('mon-s02', '問號怪', 'question-mark shaped curious monster with a magnifying glass'),
      sprite('mon-s03', '愛心怪', 'heart-shaped pink fuzzy monster with sparkly eyes'),
      sprite('mon-s04', '大力怪', 'muscular flexing monster with four arms, cheerful face'),
      sprite('mon-s05', '時鐘怪', 'clock-faced mechanical monster with weather cloud hat, gears'),
      sprite('mon-s06', '地圖怪', 'treasure map monster with a compass belly and pointing arrows'),
      sprite('mon-s07', '面具怪', 'mysterious masked monster with many arms, purple fur'),
      sprite('mon-s08', '電影怪', 'film camera monster with a clapperboard mouth, lens eye'),
      sprite('mon-s09', '購物怪', 'shopping cart monster stuffed with goods, coin eyes, greedy grin'),
    ],

    // UI 2 張
    ui: {
      signpost: sprite('ui-signpost', '雙向路標', 'a single wooden two-way signpost standing alone, one arrow board pointing left and one pointing right, blank boards', `2D cartoon game UI item, ${ITEM}`),
      hit: sprite('ui-hit', '打擊特效', 'comic impact burst explosion effect only, star-shaped spiky flash with sparks, yellow orange and white', `2D cartoon game hit effect, ${ITEM}`),
    },
  };

  // 全部清單（給生成工具用）
  root.RPG_MANIFEST.all = function () {
    const m = root.RPG_MANIFEST;
    return [].concat(m.heroes, m.backgrounds.vocab, m.backgrounds.sentence,
      m.vocabMonsters, m.bosses, m.sentenceMonsters, [m.ui.signpost, m.ui.hit]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
