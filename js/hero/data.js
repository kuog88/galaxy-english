// 單字勇者 題庫與設定（一個年級一座宮殿）
// 擴充題目：在 GRADES 裡對應年級加 stages（單字）、talk（文法對話）、cloze（句型填空）即可。
//   單字：['apple', '蘋果']（一律小寫）
//   文法對話：[問句, 問句中文, 正確回答, 回答中文, [[錯誤回答, 中文], ...至少 2 個]]
//   句型填空：[有 ___ 的句子, 整句中文, 正確答案, [錯誤選項, 錯誤選項]]
window.HERO_DATA = (function () {
  'use strict';

  const GRADES = [
    {
      grade: 1, name: '🌳 小一・晨曦森林', sheet: 'forest', bg: 'assets/rpg/bg-forest.webp', boss: 1,
      stages: [
        { name: '數字', words: [['one', '一'], ['two', '二'], ['three', '三'], ['four', '四'], ['five', '五'], ['six', '六'], ['seven', '七']] },
        { name: '顏色', words: [['red', '紅色'], ['blue', '藍色'], ['green', '綠色'], ['yellow', '黃色'], ['black', '黑色'], ['white', '白色'], ['pink', '粉紅色']] },
        { name: '動物', words: [['cat', '貓'], ['dog', '狗'], ['pig', '豬'], ['bird', '鳥'], ['fish', '魚'], ['duck', '鴨子'], ['bear', '熊']] },
        { name: '家人與東西', words: [['dad', '爸爸'], ['mom', '媽媽'], ['boy', '男孩'], ['girl', '女孩'], ['book', '書'], ['pen', '原子筆'], ['bag', '書包'], ['hat', '帽子']] },
      ],
      talk: [
        ['How are you?', '你好嗎？', "I'm fine, thank you.", '我很好，謝謝你。', [["It's a cat.", '牠是一隻貓。'], ["I'm six.", '我六歲。'], ['Yes, it is.', '是的，它是。']]],
        ["What's your name?", '你叫什麼名字？', 'My name is Amy.', '我的名字是 Amy。', [["I'm fine.", '我很好。'], ["It's red.", '它是紅色的。'], ['I like cats.', '我喜歡貓。']]],
        ['Hello!', '哈囉！', 'Hi!', '嗨！', [["It's a pen.", '它是一枝原子筆。'], ["I'm seven.", '我七歲。'], ['Thank you.', '謝謝你。']]],
        ['Good morning.', '早安。', 'Good morning.', '早安。', [["It's blue.", '它是藍色的。'], ["I'm a boy.", '我是男孩。'], ['Yes, it is.', '是的，它是。']]],
        ['Thank you.', '謝謝你。', "You're welcome.", '不客氣。', [["It's a dog.", '牠是一隻狗。'], ["I'm fine.", '我很好。'], ["It's green.", '它是綠色的。']]],
        ['How old are you?', '你幾歲？', "I'm seven.", '我七歲。', [["I'm fine.", '我很好。'], ["It's yellow.", '它是黃色的。'], ['My name is Tom.', '我的名字是 Tom。']]],
        ["What's this?", '這是什麼？', "It's a book.", '它是一本書。', [["I'm Tom.", '我是 Tom。'], ["I'm fine.", '我很好。'], ['Good morning.', '早安。']]],
        ['What color is it?', '它是什麼顏色？', "It's red.", '它是紅色的。', [["It's a pen.", '它是一枝原子筆。'], ["I'm eight.", '我八歲。'], ['Thank you.', '謝謝你。']]],
        ['Is it a cat?', '牠是一隻貓嗎？', 'Yes, it is.', '是的，牠是。', [['Yes, I am.', '是的，我是。'], ["It's red.", '它是紅色的。'], ['My name is Amy.', '我的名字是 Amy。']]],
        ['Goodbye.', '再見。', 'Bye!', '掰掰！', [["It's a bag.", '它是一個書包。'], ["I'm six.", '我六歲。'], ['Thank you.', '謝謝你。']]],
        ['Who is he?', '他是誰？', 'He is my dad.', '他是我的爸爸。', [["It's a hat.", '它是一頂帽子。'], ["I'm fine.", '我很好。'], ["It's blue.", '它是藍色的。']]],
        ['How many cats?', '有幾隻貓？', 'Three cats.', '三隻貓。', [['Red cats.', '紅色的貓。'], ["It's a cat.", '牠是一隻貓。'], ['Yes, it is.', '是的，牠是。']]],
      ],
      cloze: [
        ['I ___ Amy.', '我是 Amy。', 'am', ['is', 'are']],
        ['It ___ a cat.', '牠是一隻貓。', 'is', ['am', 'are']],
        ['This is ___ pen.', '這是一枝原子筆。', 'a', ['two', 'an']],
        ['I have two ___.', '我有兩隻貓。', 'cats', ['cat', 'a cat']],
        ['___ name is Tom.', '我的名字是 Tom。', 'My', ['I', 'Me']],
        ['How ___ you?', '你好嗎？', 'are', ['is', 'am']],
        ['I ___ fine.', '我很好。', 'am', ['is', 'are']],
        ['___ is this?', '這是什麼？', 'What', ['Who', 'How']],
        ['It is ___.', '它是藍色的。', 'blue', ['bird', 'one']],
        ['She is my ___.', '她是我的媽媽。', 'mom', ['dad', 'boy']],
        ['He ___ my dad.', '他是我的爸爸。', 'is', ['am', 'are']],
        ['I like ___.', '我喜歡狗。', 'dogs', ['red', 'six']],
      ],
    },
    {
      grade: 2, name: '🌊 小二・珊瑚秘境', sheet: 'coral', bg: 'assets/hero/bg-coral.webp', boss: 2,
      stages: [
        { name: '食物', words: [['apple', '蘋果'], ['banana', '香蕉'], ['egg', '蛋'], ['milk', '牛奶'], ['cake', '蛋糕'], ['juice', '果汁'], ['rice', '米飯']] },
        { name: '身體', words: [['eye', '眼睛'], ['ear', '耳朵'], ['nose', '鼻子'], ['mouth', '嘴巴'], ['hand', '手'], ['head', '頭'], ['foot', '腳']] },
        { name: '學校', words: [['desk', '書桌'], ['chair', '椅子'], ['ruler', '尺'], ['eraser', '橡皮擦'], ['pencil', '鉛筆'], ['school', '學校'], ['teacher', '老師']] },
        { name: '數字與玩具', words: [['eight', '八'], ['nine', '九'], ['ten', '十'], ['ball', '球'], ['kite', '風箏'], ['robot', '機器人'], ['doll', '洋娃娃'], ['car', '汽車']] },
      ],
      talk: [
        ['What do you like?', '你喜歡什麼？', 'I like apples.', '我喜歡蘋果。', [["I'm eight.", '我八歲。'], ["It's a desk.", '它是一張書桌。'], ['Yes, I am.', '是的，我是。']]],
        ['Do you like milk?', '你喜歡牛奶嗎？', 'Yes, I do.', '是的，我喜歡。', [['Yes, I am.', '是的，我是。'], ['Yes, it is.', '是的，它是。'], ["It's white.", '它是白色的。']]],
        ['Do you like cake?', '你喜歡蛋糕嗎？', "No, I don't.", '不，我不喜歡。', [["No, it isn't.", '不，它不是。'], ["No, I'm not.", '不，我不是。'], ["It's a cake.", '它是一個蛋糕。']]],
        ['How many apples?', '有幾顆蘋果？', 'Five apples.', '五顆蘋果。', [['Red apples.', '紅色的蘋果。'], ['I like apples.', '我喜歡蘋果。'], ["It's an apple.", '它是一顆蘋果。']]],
        ["What's that?", '那是什麼？', "It's a robot.", '那是一個機器人。', [["I'm Tom.", '我是 Tom。'], ["I'm nine.", '我九歲。'], ['Yes, I do.', '是的，我喜歡。']]],
        ['Is this your bag?', '這是你的書包嗎？', 'Yes, it is.', '是的，它是。', [['Yes, I am.', '是的，我是。'], ['I like bags.', '我喜歡書包。'], ["It's ten.", '它是十。']]],
        ['Who is she?', '她是誰？', 'She is my teacher.', '她是我的老師。', [['He is my dad.', '他是我的爸爸。'], ["It's a doll.", '它是一個洋娃娃。'], ["I'm fine.", '我很好。']]],
        ['What color do you like?', '你喜歡什麼顏色？', 'I like pink.', '我喜歡粉紅色。', [['I like cake.', '我喜歡蛋糕。'], ["It's a kite.", '它是一個風箏。'], ["I'm ten.", '我十歲。']]],
        ['Are you hungry?', '你餓了嗎？', 'Yes, I am.', '是的，我餓了。', [['Yes, I do.', '是的，我喜歡。'], ['Yes, it is.', '是的，它是。'], ['I like rice.', '我喜歡米飯。']]],
        ['Is it a ball?', '它是一顆球嗎？', "No, it isn't.", '不，它不是。', [["No, I don't.", '不，我不喜歡。'], ["No, I'm not.", '不，我不是。'], ["It's a ball.", '它是一顆球。']]],
        ['How old is she?', '她幾歲？', 'She is eight.', '她八歲。', [['She is fine.', '她很好。'], ['She is my mom.', '她是我的媽媽。'], ["It's a doll.", '它是一個洋娃娃。']]],
        ['What do you want?', '你想要什麼？', 'I want some juice.', '我想要一些果汁。', [["I'm a girl.", '我是女孩。'], ["It's a chair.", '它是一張椅子。'], ['Yes, I am.', '是的，我是。']]],
      ],
      cloze: [
        ['This is my ___.', '這是我的眼睛。', 'eye', ['egg', 'ten']],
        ['I ___ two hands.', '我有兩隻手。', 'have', ['has', 'am']],
        ['She ___ eight.', '她八歲。', 'is', ['am', 'are']],
        ['We ___ students.', '我們是學生。', 'are', ['is', 'am']],
        ['I like ___.', '我喜歡香蕉。', 'bananas', ['nine', 'nose']],
        ['Do you like cake? Yes, I ___.', '你喜歡蛋糕嗎？是的，我喜歡。', 'do', ['am', 'is']],
        ['Is it a robot? No, it ___.', '它是機器人嗎？不，它不是。', "isn't", ["don't", "aren't"]],
        ['___ many dolls?', '有幾個洋娃娃？', 'How', ['What', 'Who']],
        ['___ is she? She is my mom.', '她是誰？她是我的媽媽。', 'Who', ['What', 'How']],
        ['I have ___ apple.', '我有一顆蘋果。', 'an', ['a', 'two']],
        ['I want ___ juice.', '我想要一些果汁。', 'some', ['a', 'an']],
        ['Touch your ___.', '摸你的鼻子。', 'nose', ['nine', 'kite']],
      ],
    },
    // 小三～小六：第二階段補上題目（先保留宮殿外觀與怪物）
    { grade: 3, name: '🏫 小三・校園工坊', sheet: 'school', bg: 'assets/hero/bg-school.webp', boss: 3, stages: [], talk: [], cloze: [] },
    { grade: 4, name: '🌋 小四・熾熱山脈', sheet: 'volcano', bg: 'assets/rpg/bg-canyon.webp', boss: 4, stages: [], talk: [], cloze: [] },
    { grade: 5, name: '❄️ 小五・冰雪王國', sheet: 'ice', bg: 'assets/rpg/bg-wasteland.webp', boss: 5, stages: [], talk: [], cloze: [] },
    { grade: 6, name: '🏰 小六・暗影城堡', sheet: 'castle', bg: 'assets/rpg/bg-factory.webp', boss: 6, stages: [], talk: [], cloze: [] },
  ];

  // 角色：type = spell（拼單字）／talk（文法對話）／cloze（句型填空）
  // tiers = 換外觀的等級；img(t) = 第 t 階圖片
  const CHARS = {
    hero: {
      name: '勇者', type: 'spell', unlock: 0, hp: 40, hpUp: 6, atk: 14, atkUp: 2, aoe: false,
      tiers: [1, 4, 8, 12], img: (t) => `assets/rpg/hero-${t}.webp`, weapon: 'sword',
      desc: '拼出怪物的單字，單體攻擊力高',
    },
    mage: {
      name: '魔法使', type: 'talk', unlock: 40, hp: 30, hpUp: 4, atk: 7, atkUp: 1, aoe: true,
      tiers: [1, 3, 5, 8, 11, 14], img: (t) => `assets/hero/c-mage-${t}.webp`, weapon: 'staff',
      desc: '答對文法對話題，魔法攻擊全部怪物（起始傷害較低）',
    },
    shield: {
      name: '盾戰士', type: 'cloze', unlock: 200, hp: 60, hpUp: 8, atk: 9, atkUp: 1.5, aoe: false, guard: true,
      tiers: [1, 3, 5, 7, 9, 11, 13], img: (t) => `assets/hero/c-shield-${t}.webp`, weapon: 'shield',
      desc: '答對句型填空題攻擊；會挺身替隊友擋下攻擊，受到的傷害較少',
    },
    angel: {
      name: '墮天使', type: 'cloze', unlock: 300, hp: 45, hpUp: 6, atk: 14, atkUp: 2, aoe: true, noFalloff: true,
      tiers: [1, 3, 6, 9, 12, 15], img: (t) => `assets/hero/c-angel-${t}.webp`, weapon: 'greatsword',
      desc: '答對句型填空題，巨劍攻擊全部怪物，傷害不減弱（2 翼 → 12 翼）',
    },
  };

  // 每位角色 10 把武器：atk 加在角色攻擊力上；def = 盾戰士減傷 %
  // recipe：要拼出的單字（grade = 從哪個年級的單字裡出題）、gold = 金字母（魔王金寶箱才會掉）
  const W = (name, atk, grade, words, gold, def) => ({ name, atk, grade, words, gold: gold || 0, def: def || 0 });
  const WEAPONS = {
    sword: [
      W('木劍', 6, 1, ['red']), W('短鐵劍', 10, 1, ['seven']), W('鋼鐵騎士劍', 16, 2, ['apple']),
      W('寶石銀劍', 22, 2, ['robot', 'green']), W('火焰劍', 30, 3, null), W('冰晶劍', 38, 4, null),
      W('雷霆劍', 48, 5, null, 1), W('龍骨符文劍', 58, 5, null, 2), W('彩虹聖劍', 70, 6, null, 3), W('光之鳳凰劍', 82, 6, null, 5),
    ],
    staff: [
      W('樹枝法杖', 3, 1, ['pink']), W('藍寶石法杖', 5, 1, ['three']), W('星星魔杖', 8, 2, ['juice']),
      W('水晶法杖', 11, 2, ['teacher', 'blue']), W('火焰法杖', 15, 3, null), W('冰雪法杖', 19, 4, null),
      W('雷光法杖', 24, 5, null, 1), W('星月法杖', 29, 5, null, 2), W('銀河法杖', 35, 6, null, 3), W('宇宙神杖', 41, 6, null, 5),
    ],
    shield: [
      W('木盾＋皮背心', 4, 1, ['bag'], 0, 10), W('鐵盾＋鎖子甲', 7, 1, ['black'], 0, 14), W('鋼鐵盾甲', 11, 2, ['chair'], 0, 18),
      W('銀色塔盾甲', 15, 2, ['eraser', 'pen'], 0, 22), W('火焰盾甲', 20, 3, null, 0, 26), W('冰晶盾甲', 26, 4, null, 0, 30),
      W('雷霆盾甲', 33, 5, null, 1, 34), W('龍鱗盾甲', 40, 5, null, 2, 38), W('黃金聖盾甲', 48, 6, null, 3, 42), W('太陽神盾甲', 56, 6, null, 5, 46),
    ],
    greatsword: [
      W('鐵寬劍', 6, 1, ['white']), W('鋼寬劍', 10, 1, ['four']), W('暗金寬劍', 16, 2, ['school']),
      W('黑曜石寬劍', 22, 2, ['banana', 'girl']), W('獄火寬劍', 30, 3, null), W('冰霜寬劍', 38, 4, null),
      W('風暴寬劍', 48, 5, null, 1), W('墮天羽劍', 58, 5, null, 2), W('天界寬劍', 70, 6, null, 3), W('十二翼天使巨劍', 82, 6, null, 5),
    ],
  };
  // 武器圖：assets/hero/w-<種類>-<1~10>.webp
  const weaponImg = (kind, i) => `assets/hero/w-${kind}-${i + 1}.webp`;

  return { GRADES, CHARS, WEAPONS, weaponImg, UNLOCK_NOTE: '第一次就答對 +1、每鍛造一把武器 +1' };
})();
