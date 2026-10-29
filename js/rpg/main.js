// RPG 冒險模式：跑動 → 遇敵 → 答題打怪 → 過關 / 死亡回退 → 岔路選擇
// 上半部是冒險舞台，下半部沿用原本的拼字格子（GE.SpellGrid）和句型選擇題。
(function () {
  'use strict';

  const { shuffle, pick, esc, speak, stopSpeech, sfx, beep, sound, SpellGrid } = window.GE;
  const { FSM, assets, juice } = window.RPG;
  const DATA = window.GAME_DATA;
  const M = window.RPG_MANIFEST;
  const $ = (s) => document.querySelector(s);

  // ---------- 遊戲參數 ----------
  const SAVE_KEY = 'galaxyEnglish.rpg.v1';
  const HERO_MAX_HP = 100;
  const MON_MAX_HP = 100;
  const MON_ATK = { normal: 20, boss: 25 };       // 一般怪錯 5 次倒下、魔王錯 4 次
  const PER_STAGE = { vocab: 8, boss: 8, sentence: 6 };
  const RUN_MS = 1800;                            // 每關先跑一段路才遇到怪
  const SCROLL_SPEED = 260;                       // 背景捲動 px/秒
  const TRACKS = {
    vocab: { label: '單字星', icon: '🔤', sub: '森林・峽谷' },
    sentence: { label: '句型星', icon: '💬', sub: '機械工廠・紫霧荒野' },
  };
  const CHEERS = ['Great!', 'Super!', 'Awesome!', 'Nice hit!', 'Excellent!'];

  // ---------- 存檔 ----------
  // stage：目前在第幾關（死亡會回退）；best：曾經打過的最高關（不會回退）
  function defaultSave() {
    return { track: null, stage: { vocab: 1, sentence: 1 }, best: { vocab: 0, sentence: 0 }, heroTier: 1 };
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.stage && s.best) return s;
    } catch (e) { /* 讀不到就用新的 */ }
    return defaultSave();
  }
  let save = loadSave();
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 無痕模式可能不能存 */ }
  }

  const total = (track) => DATA[track].length;
  const trackDone = (track) => save.best[track] >= total(track);

  // ---------- 人物造型：每 5 關換一套，第 16 關以上定住；只升不降 ----------
  const adventureStage = () => save.best.vocab + save.best.sentence + 1;
  const tierFor = (adv) => (adv <= 5 ? 1 : adv <= 10 ? 2 : adv <= 15 ? 3 : 4);

  // ---------- 岔路：魔王關打完、句型每 3 關、或整條路打完時停下來選路 ----------
  function isCrossroadNode(track, n) {
    if (n >= total(track)) return true;
    if (track === 'vocab') return DATA.vocab[n - 1].review != null;
    return n % 3 === 0;
  }

  // =====================================================
  // 關卡定義＋快取：同一關只建一次（題庫、怪物、背景圖都存著），
  // 死亡回退回來時直接拿快取，不重新載圖、也不會重新呼叫生成 API。
  // =====================================================
  const stageCache = new Map();
  function stageDef(track, n) {
    const key = `${track}:${n}`;
    if (stageCache.has(key)) return stageCache.get(key);
    const lv = DATA[track][n - 1];
    let def;
    if (track === 'vocab') {
      if (lv.review) {
        // 魔王關：從指定範圍的一般關卡單字裡隨機抽
        const tier = DATA.vocab.slice(0, n).filter((l) => l.review).length;
        const [from, to] = lv.review;
        const pool = DATA.vocab.slice(from - 1, to).filter((l) => !l.review).flatMap((l) => l.words);
        def = { boss: tier, pool, count: PER_STAGE.boss, monster: M.bosses[tier - 1] };
      } else {
        const idx = DATA.vocab.slice(0, n).filter((l) => !l.review).length - 1;
        def = { boss: 0, pool: lv.words, count: PER_STAGE.vocab, monster: M.vocabMonsters[idx] };
      }
      def.bg = M.backgrounds.vocab[n <= 8 ? 0 : 1];
      // 跟一般闖關一樣：第 4 關起多 1 個干擾字母，第 9 關起多 2 個
      def.decoys = n >= 9 ? 2 : n >= 4 ? 1 : 0;
    } else {
      def = { boss: 0, pool: lv.items, count: PER_STAGE.sentence, monster: M.sentenceMonsters[n - 1] };
      def.bg = M.backgrounds.sentence[n <= 4 ? 0 : 1];
    }
    Object.assign(def, { track, n, name: lv.name, icon: lv.icon, color: lv.color });
    def.images = Promise.all([assets.load(def.monster.id), assets.load(def.bg.id)]);
    stageCache.set(key, def);
    return def;
  }

  // ---------- 畫面元素 ----------
  const el = {
    stage: $('#stage'), bg: $('#bg'), hero: $('#hero'), monster: $('#monster'), fx: $('#fx'),
    overlay: $('#overlay'), panel: $('#panel'), label: $('#stage-label'),
    heroBar: $('#hero-hp'), heroName: $('#hero-name'), monBar: $('#mon-hp'), monName: $('#mon-name'), monHud: $('#hud-mon'),
    toast: $('#toast'),
  };

  // 目前這一關的狀態
  const G = { track: null, n: 0, def: null, items: [], idx: 0, heroHp: HERO_MAX_HP, monHp: MON_MAX_HP, spell: null, opts: null, hitImg: null };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let toastT = null;
  function toast(msg, ms = 1000) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    el.toast.style.animation = 'none';
    void el.toast.offsetWidth;
    el.toast.style.animation = '';
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.add('hidden'), ms);
  }
  function center(node) {
    const b = node.getBoundingClientRect();
    const s = el.fx.getBoundingClientRect();
    return { x: b.left - s.left + b.width / 2, y: b.top - s.top + b.height * 0.4 };
  }

  // ---------- 背景捲動（requestAnimationFrame，任何寬度的圖都能無縫循環） ----------
  const scroller = { x: 0, on: false, last: 0 };
  function scrollTick(t) {
    if (!scroller.on) return;
    const dt = Math.min(0.05, (t - scroller.last) / 1000);
    scroller.last = t;
    scroller.x += SCROLL_SPEED * dt;
    el.bg.style.backgroundPositionX = -scroller.x + 'px';
    requestAnimationFrame(scrollTick);
  }
  function setScrolling(on) {
    if (on === scroller.on) return;
    scroller.on = on;
    if (on) { scroller.last = performance.now(); requestAnimationFrame(scrollTick); }
  }

  async function setScene(def) {
    const [, bgUrl] = await def.images;
    el.bg.className = 'bg scene-' + def.bg.id + (bgUrl ? ' has-img' : '');
    el.bg.style.backgroundImage = bgUrl ? `url("${bgUrl}")` : '';
    el.stage.dataset.track = def.track;
  }

  // ---------- 人物 ----------
  const WEAPONS = ['🗡️', '⚔️', '🔱', '🔥'];
  async function renderHero() {
    const tier = save.heroTier;
    const info = M.heroes[tier - 1];
    const url = await assets.load(info.id);
    el.hero.innerHTML = url
      ? `<img class="body" src="${url}" alt="${esc(info.name)}">`
      : `<div class="body ph-hero tier-${tier}"><span class="cape"></span><span class="face">🧒</span><span class="weapon">${WEAPONS[tier - 1]}</span></div>`;
    el.heroName.textContent = info.name;
  }
  function heroPose(pose) { el.hero.dataset.pose = pose; }

  // ---------- 怪物（有圖用圖，沒圖用 CSS 畫的毛怪） ----------
  async function renderMonster(def) {
    const [monUrl] = await def.images;
    const eyes = def.boss ? 2 + def.boss : 1 + (def.n % 3);
    el.monster.className = 'actor monster' + (def.boss ? ' boss boss-' + def.boss : '');
    el.monster.innerHTML = monUrl
      ? `<img class="body" src="${monUrl}" alt="${esc(def.monster.name)}">`
      : `<div class="body ph-mon" style="--c:${def.color}">
           <span class="eyes">${'<i class="eye"></i>'.repeat(eyes)}</span>
           <span class="mouth"></span>
           <span class="badge">${def.icon}</span>
         </div>`;
    el.monster.classList.remove('hidden');
    el.monName.textContent = (def.boss ? '👑 ' : '') + def.monster.name;
    el.monHud.classList.remove('hidden');
  }
  function hideMonster() {
    el.monster.getAnimations().forEach((a) => a.cancel());
    el.monster.classList.add('hidden');
    el.monster.innerHTML = '';
    el.monHud.classList.add('hidden');
  }

  function updateHud() {
    el.heroBar.style.setProperty('--v', G.heroHp / HERO_MAX_HP);
    el.heroBar.dataset.low = G.heroHp <= HERO_MAX_HP * 0.3 ? '1' : '';
    el.monBar.style.setProperty('--v', G.monHp / MON_MAX_HP);
    if (G.def) {
      const t = TRACKS[G.track];
      el.label.textContent = `${t.icon} ${t.label} 第 ${G.n} 關・${G.def.name}${G.def.boss ? '（魔王）' : ''}`;
    }
  }

  // =====================================================
  // 下半部操作面板：沿用原本的拼字格子與句型選擇題
  // =====================================================
  function dropSpell() {
    if (G.spell) G.spell.destroy();
    G.spell = null;
  }
  function lockPanel(v) {
    el.panel.classList.toggle('locked', v);
    if (G.spell) G.spell.lock(v);
  }
  function panelMessage(html) {
    dropSpell();
    el.panel.innerHTML = `<div class="panel panel-wait">${html}</div>`;
    lockPanel(true);
  }
  const qCounter = () => `<div class="q-count">⚔️ 第 ${G.idx + 1} / ${G.items.length} 擊</div>`;

  function curWord() {
    const [en, zh, homo, icon] = G.items[G.idx];
    return { en, zh, homo, icon };
  }

  function loadQuestion() {
    dropSpell();
    if (G.track === 'sentence') showSentence();
    else if (G.def.boss) showSpell();        // 魔王關直接考拼字
    else showWordCard();                     // 一般關先看單字卡（學習）再拼字（攻擊）
    lockPanel(false);
  }

  function showWordCard() {
    const w = curWord();
    el.panel.innerHTML = `
      ${qCounter()}
      <div class="panel word-card" style="--accent:${G.def.color}">
        <button class="emoji-btn" data-act="say">${w.icon}</button>
        <div class="word-en">${esc(w.en)}</div>
        <div class="word-zh">${esc(w.zh)}</div>
        <div class="homo">
          <span class="tag">諧音記憶</span>
          <b>${esc(w.en)}</b> ≈ <b>${esc(w.homo)}</b>
          <button class="mini-btn" data-act="homo">🗣️ 聽諧音</button>
        </div>
      </div>
      <div class="actions">
        <button class="big-btn blue" data-act="say">🔊 再聽一次</button>
        <button class="big-btn green" data-act="to-spell">⚔️ 拼字攻擊！</button>
      </div>`;
    setTimeout(() => speak(w.en), 300);
  }

  function showSpell() {
    el.panel.innerHTML = `${qCounter()}<div id="spell"></div>`;
    G.spell = SpellGrid($('#spell'), {
      word: curWord(),
      decoys: G.def.decoys,
      onSolved: () => fsm.go('BATTLE', { hit: true, say: curWord().en }),
      onWrong: () => fsm.go('BATTLE', { hit: false }),
    });
    if (G.def.boss) setTimeout(() => speak(curWord().en), 300);
  }

  function showSentence() {
    const [q, qzh, a, azh, wrongs] = G.items[G.idx];
    G.opts = shuffle([{ en: a, zh: azh, ok: true }].concat(
      shuffle(wrongs).slice(0, 2).map(([en, zh]) => ({ en, zh, ok: false }))));
    el.panel.innerHTML = `
      ${qCounter()}
      <div class="panel q-card">
        <div class="q-en">${esc(q)}</div>
        <div class="q-zh" id="q-zh"><button class="mini-btn" data-act="show-zh">👀 看中文</button></div>
        <div class="actions" style="margin-top:12px">
          <button class="big-btn blue" data-act="say-q">🔊 再聽一次</button>
          <button class="big-btn pink" data-act="opt-hint">💡 提示</button>
        </div>
      </div>
      <div class="options">
        ${G.opts.map((o, i) => `
          <button class="opt" data-act="opt" data-i="${i}">
            <span class="letter">${'ABC'[i]}</span>
            <span class="txt"><span class="en">${esc(o.en)}</span><span class="zh hidden">${esc(o.zh)}</span></span>
          </button>`).join('')}
      </div>`;
    G.qzh = qzh;
    setTimeout(() => speak(q), 300);
  }

  function chooseOpt(i, btn) {
    const o = G.opts[i];
    if (o.ok) {
      btn.classList.add('right');
      el.panel.querySelectorAll('.opt').forEach((b) => { b.disabled = true; });
      el.panel.querySelectorAll('.opt .zh').forEach((z) => z.classList.remove('hidden'));
      sfx.good();
      fsm.go('BATTLE', { hit: true, say: o.en });
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      sfx.bad();
      fsm.go('BATTLE', { hit: false });
    }
  }

  el.panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || el.panel.classList.contains('locked')) return;
    switch (b.dataset.act) {
      case 'say': speak(curWord().en); break;
      case 'homo': speak(curWord().homo, 'zh-TW'); break;
      case 'to-spell': sfx.tap(); showSpell(); break;
      case 'say-q': speak(G.items[G.idx][0]); break;
      case 'show-zh': $('#q-zh').textContent = G.qzh; break;
      case 'opt-hint':
        sfx.tap();
        el.panel.querySelectorAll('.opt .zh').forEach((z) => z.classList.remove('hidden'));
        break;
      case 'opt': chooseOpt(Number(b.dataset.i), b); break;
    }
  });

  // =====================================================
  // 舞台上的大彈窗（岔路、過關、死亡、全破）
  // =====================================================
  function showOverlay(html, onClick) {
    el.overlay.innerHTML = `<div class="ov-box">${html}</div>`;
    el.overlay.classList.remove('hidden');
    el.overlay.onclick = (e) => {
      const b = e.target.closest('[data-ov]');
      if (b && !b.disabled) onClick(b.dataset.ov, b);
    };
  }
  function hideOverlay() {
    el.overlay.classList.add('hidden');
    el.overlay.innerHTML = '';
    el.overlay.onclick = null;
  }

  // =====================================================
  // 有限狀態機
  // =====================================================
  const fsm = new FSM({
    // 岔路：選「單字星」或「句型星」
    CROSSROAD: {
      to: ['RUNNING'],
      async enter() {
        setScrolling(false);
        heroPose('idle');
        hideMonster();
        G.def = null;
        // 岔路口沿用剛剛走的那條路的背景（第一次來就用森林）
        const track = save.track || 'vocab';
        const bg = M.backgrounds[track][track === 'vocab' ? (save.stage.vocab <= 8 ? 0 : 1) : (save.stage.sentence <= 4 ? 0 : 1)];
        setScene({ track, bg, images: Promise.all([null, assets.load(bg.id)]) });
        el.label.textContent = '🪧 岔路口';
        panelMessage('🪧 選一條路出發吧！<small>左邊練單字、右邊練句型</small>');
        const sign = await assets.load(M.ui.signpost.id);
        const board = (track, side) => {
          const t = TRACKS[track];
          const done = trackDone(track);
          const n = save.stage[track];
          return `<button class="sign-board ${side}" data-ov="${track}" ${done ? 'disabled' : ''}>
            <span class="arrow">${side === 'left' ? '◀' : '▶'}</span>
            <b>${t.icon} ${t.label}</b>
            <small>${done ? '🏆 已征服' : `第 ${n} / ${total(track)} 關`}</small>
            <small class="scene">${t.sub}</small>
          </button>`;
        };
        showOverlay(`
          <div class="crossroad ${sign ? 'has-img' : ''}">
            ${sign ? `<img class="sign-img" src="${sign}" alt="">` : '<div class="sign-post"></div>'}
            ${board('vocab', 'left')}
            ${board('sentence', 'right')}
          </div>`, (track) => {
          sfx.tap();
          save.track = track;
          persist();
          hideOverlay();
          fsm.go('RUNNING');
        });
      },
    },

    // 跑動探索：背景捲動、人物跑步、面板鎖住；同時預載這關的圖
    RUNNING: {
      to: ['ENCOUNTER'],
      async enter(p, tok) {
        hideOverlay();
        hideMonster();
        G.track = save.track;
        G.n = save.stage[G.track];
        G.def = stageDef(G.track, G.n);
        G.items = shuffle(G.def.pool).slice(0, G.def.count);
        G.idx = 0;
        G.heroHp = HERO_MAX_HP;
        G.monHp = MON_MAX_HP;
        updateHud();
        await Promise.all([setScene(G.def), renderHero()]);
        if (!fsm.alive(tok)) return;
        heroPose('running');
        setScrolling(true);
        panelMessage(`🏃 冒險中……<small>${G.def.boss ? '⚠️ 前方有強大的魔王氣息！' : '前方好像有怪物！'}</small>`);
        await Promise.all([G.def.images, wait(RUN_MS)]);
        if (!fsm.alive(tok)) return;
        fsm.go('ENCOUNTER', { fresh: true });
      },
    },

    // 遇敵：背景停、怪物登場、面板解鎖並載入第 N 題
    ENCOUNTER: {
      to: ['BATTLE'],
      async enter(p, tok) {
        setScrolling(false);
        heroPose('idle');
        if (p.fresh) {
          await renderMonster(G.def);
          updateHud();
          if (!fsm.alive(tok)) return;
          if (G.def.boss) { juice.shake(el.stage, 2); beep([110, 98, 82], 0.25, 'sawtooth'); }
          await juice.enter(el.monster);
          if (!fsm.alive(tok)) return;
        }
        if (p.retry) lockPanel(false);     // 答錯：同一題再試一次（拼字格子會自己清空）
        else loadQuestion();
      },
    },

    // 戰鬥：答對 → 主角攻擊、怪物受擊；答錯 → 怪物攻擊、主角扣血
    BATTLE: {
      to: ['ENCOUNTER', 'STAGE_CLEAR', 'GAME_OVER'],
      async enter(p, tok) {
        lockPanel(true);
        return p.hit ? heroAttack(p, tok) : monsterAttack(tok);
      },
    },

    STAGE_CLEAR: {
      to: ['RUNNING', 'CROSSROAD', 'VICTORY'],
      enter(p, tok) {
        const { track, n } = G;
        sfx.win();
        setTimeout(() => speak('Stage clear!'), 200);
        save.best[track] = Math.max(save.best[track], n);
        if (n < total(track)) save.stage[track] = n + 1;
        const oldTier = save.heroTier;
        save.heroTier = Math.max(save.heroTier, tierFor(adventureStage()));
        persist();
        const upgraded = save.heroTier > oldTier;
        const next = trackDone('vocab') && trackDone('sentence') ? 'VICTORY'
          : isCrossroadNode(track, n) ? 'CROSSROAD' : 'RUNNING';
        panelMessage('🎉 打倒怪物了！');
        const showClear = async () => {
          const up = upgraded ? await assets.load(M.heroes[save.heroTier - 1].id) : null;
          if (!fsm.alive(tok)) return;
          if (upgraded) renderHero();
          showOverlay(`
            <h2>第 ${n} 關過關！</h2>
            <p>打倒了 ${esc(G.def.monster.name)}，學會 ${G.items.length} 題</p>
            ${upgraded ? `
              <div class="upgrade">
                ${up ? `<img src="${up}" alt="">` : `<div class="ph-hero tier-${save.heroTier}"><span class="cape"></span><span class="face">🧒</span><span class="weapon">${WEAPONS[save.heroTier - 1]}</span></div>`}
                <b>✨ 造型升級：${esc(M.heroes[save.heroTier - 1].name)}</b>
              </div>` : ''}
            <button class="big-btn" data-ov="go">${next === 'CROSSROAD' ? '🪧 前往岔路口' : next === 'VICTORY' ? '🏆 看結局' : '繼續前進 ➜'}</button>`,
          () => { sfx.tap(); hideOverlay(); fsm.go(next); });
        };
        showClear();
      },
    },

    // 死亡：回退兩關、補滿血，從退回的關卡重新跑
    GAME_OVER: {
      to: ['RUNNING'],
      enter() {
        const { track, n } = G;
        const back = Math.max(1, n - 2);
        save.stage[track] = back;
        persist();
        heroPose('down');
        sfx.bad();
        setTimeout(() => speak('Oh no! Try again!'), 300);
        panelMessage('💫 倒下了……');
        const words = G.items.map((it) => `<li><b>${esc(it[0])}</b> ${esc(it[1])}</li>`).join('');
        showOverlay(`
          <h2>💫 被打倒了！</h2>
          <p>${back < n ? `退回 <b>第 ${back} 關</b> 重新修練（造型保留，不用擔心）` : '回到第 1 關重新出發'}</p>
          <details><summary>這關的題目</summary><ul class="ov-words">${words}</ul></details>
          <button class="big-btn" data-ov="go">🔁 重新出發</button>`,
        () => { sfx.tap(); hideOverlay(); fsm.go('RUNNING'); });
      },
    },

    VICTORY: {
      to: ['CROSSROAD'],
      enter() {
        sfx.win();
        setTimeout(() => speak('You are a legend!'), 300);
        panelMessage('🏆 全部星球都征服了！');
        showOverlay(`
          <h2>🏆 你是傳奇大將！</h2>
          <p>單字星 ${total('vocab')} 關、句型星 ${total('sentence')} 關全部征服！</p>
          <button class="big-btn" data-ov="again">🔁 再冒險一次</button>`,
        () => {
          // 關卡從頭來，但造型與最高紀錄保留
          save.stage = { vocab: 1, sentence: 1 };
          save.best = { vocab: 0, sentence: 0 };
          persist();
          hideOverlay();
          fsm.go('CROSSROAD');
        });
      },
    },
  });

  // ---------- 戰鬥動畫 ----------
  async function heroAttack(p, tok) {
    toast(pick(CHEERS) + ' ⚔️');
    if (p.say) setTimeout(() => speak(p.say), 250);
    const h = el.hero.getBoundingClientRect();
    const m = el.monster.getBoundingClientRect();
    heroPose('attack');
    const lunge = juice.lunge(el.hero, Math.max(40, m.left - h.right + 10));
    await wait(230);                                   // 衝到怪物面前的瞬間命中
    if (!fsm.alive(tok)) return;
    const last = G.idx === G.items.length - 1;
    const dmg = last ? G.monHp : Math.ceil(MON_MAX_HP / G.items.length);
    G.monHp = Math.max(0, G.monHp - dmg);
    const body = el.monster.querySelector('.body');
    const c = center(el.monster);
    juice.knockback(body, 1, G.def.boss ? 0.8 : 1);
    juice.flash(body);
    juice.sparks(el.fx, c.x, c.y, G.hitImg);
    juice.floatText(el.fx, c.x, c.y - 20, `Hit -${dmg}!`, last ? 'dmg crit' : 'dmg');
    juice.shake(el.stage, G.def.boss ? 1.6 : 1);
    beep([180, 120], 0.08, 'square');
    updateHud();
    await lunge;
    G.idx++;
    await wait(500);
    if (!fsm.alive(tok)) return;
    heroPose('idle');
    if (G.monHp <= 0) {
      await juice.defeat(el.monster, el.fx);
      if (!fsm.alive(tok)) return;
      hideMonster();
      fsm.go('STAGE_CLEAR');
    } else {
      fsm.go('ENCOUNTER');
    }
  }

  async function monsterAttack(tok) {
    const h = el.hero.getBoundingClientRect();
    const m = el.monster.getBoundingClientRect();
    const lunge = juice.lunge(el.monster, -Math.max(40, m.left - h.right + 10));
    await wait(230);
    if (!fsm.alive(tok)) return;
    const atk = G.def.boss ? MON_ATK.boss : MON_ATK.normal;
    G.heroHp = Math.max(0, G.heroHp - atk);
    const body = el.hero.querySelector('.body');
    const c = center(el.hero);
    heroPose('hurt');
    juice.knockback(body, -1);
    juice.flash(body);
    juice.floatText(el.fx, c.x, c.y - 20, `-${atk}`, 'ouch');
    juice.shake(el.stage, 1.2);
    updateHud();
    await lunge;
    await wait(450);
    if (!fsm.alive(tok)) return;
    if (G.heroHp <= 0) return fsm.go('GAME_OVER');
    heroPose('idle');
    fsm.go('ENCOUNTER', { retry: true });
  }

  // ---------- 上方列 ----------
  const soundBtn = $('#btn-sound');
  const syncSoundBtn = () => { soundBtn.textContent = sound.on ? '🔊' : '🔇'; };
  soundBtn.addEventListener('click', () => { sound.set(!sound.on); syncSoundBtn(); });
  syncSoundBtn();
  $('#btn-home').addEventListener('click', () => { stopSpeech(); location.href = 'classic.html'; });

  // ---------- 開始 ----------
  assets.load(M.ui.hit.id).then((u) => { G.hitImg = u; });
  renderHero();
  updateHud();
  fsm.go('CROSSROAD');

  // 給除錯用：在 console 輸入 RPG.debug 可以看狀態
  window.RPG.debug = { fsm, G, get save() { return save; } };
})();
