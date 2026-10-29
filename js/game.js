(function () {
  'use strict';

  const DATA = window.GAME_DATA;
  const PER_LEVEL = 5;               // 每關題數
  const SAVE_KEY = 'galaxyEnglish.v1';
  const MODES = {
    vocab: { label: '單字星球', icon: '🎈' },
    sentence: { label: '句型星球', icon: '🪁' },
  };
  const CHEERS = ['Great!', 'Super!', 'Awesome!', 'Good job!', 'Wonderful!', 'Excellent!'];
  const HELLOS = ['Hello!', "Let's go!", 'You can do it!', 'Hi, friend!', 'Have fun!'];

  const $ = (s) => document.querySelector(s);
  const app = $('#app');

  // 共用工具（亂數、語音、音效、拼字格子）在 js/core.js
  const { shuffle, pick, esc, speak, stopSpeech, sfx, sound } = window.GE;
  const levels = (mode) => DATA[mode];

  // ---------- 進度記憶 (localStorage) ----------
  function defaultSave() {
    return { vocab: { unlocked: 1, stars: {} }, sentence: { unlocked: 1, stars: {} }, last: null };
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.vocab && s.sentence) return s;
    } catch (e) { /* 讀不到就用新的 */ }
    return defaultSave();
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 無痕模式可能不能存 */ }
  }
  let save = loadSave();

  // ---------- 計時器 (像 NYT Crossword) ----------
  const timerEl = $('#timer');
  let timerId = null;
  let startTime = 0;
  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  function startTimer() {
    stopTimer();
    startTime = Date.now();
    timerEl.textContent = '0:00';
    timerEl.classList.remove('hidden');
    timerId = setInterval(() => { timerEl.textContent = fmtTime(Date.now() - startTime); }, 500);
  }
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    timerEl.classList.add('hidden');
  }

  // ---------- 提示訊息 ----------
  const toastEl = $('#toast');
  let toastT = null;
  function toast(msg, ms = 1100) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.style.animation = 'none';
    void toastEl.offsetWidth;
    toastEl.style.animation = '';
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.add('hidden'), ms);
  }

  function bounceEl(el) {
    el.classList.remove('bounce');
    void el.offsetWidth;
    el.classList.add('bounce');
  }

  function setTitle(t) { $('#top-title').textContent = t; }

  // ---------- 遊戲狀態 ----------
  // pending 用來取消「答對後自動跳下一題」的計時，避免離開關卡後還跳畫面
  const game = { mode: null, level: 0, items: [], idx: 0, mistakes: 0, busy: false, pending: null, spell: null };
  function later(fn, ms) {
    clearTimeout(game.pending);
    game.pending = setTimeout(fn, ms);
  }
  function leaveLevel() {
    clearTimeout(game.pending);
    if (game.rush) rushStop();
    dropSpell();
    document.querySelectorAll('.clear-video').forEach((v) => v.remove());
    game.busy = false;
    stopTimer();
    stopSpeech();
  }

  // =====================================================
  // 首頁
  // =====================================================
  function renderHome() {
    leaveLevel();
    setTitle('銀河英語闖關');
    const last = save.last;
    let cont = '';
    if (last && levels(last.mode)) {
      const lv = Math.min(save[last.mode].unlocked, levels(last.mode).length);
      cont = `<button class="big-btn continue" data-action="continue">▶ 繼續闖關：${MODES[last.mode].label} 第 ${lv} 關</button>`;
    }
    const prog = (m) => {
      const total = levels(m).length;
      const done = Object.keys(save[m].stars).length;
      return `已過 ${done} / ${total} 關`;
    };
    app.innerHTML = `
      <section class="home">
        <button class="sticker s1" data-action="sticker">🍃</button>
        <button class="sticker s2" data-action="sticker">🌻</button>
        <button class="sticker s3" data-action="sticker">🐞</button>
        <button class="sticker s4" data-action="sticker">🍄</button>
        <button class="mascot" data-action="sticker" title="點我打招呼"><img src="assets/img/mascot.webp" alt="小貓吉祥物"></button>
        <h1>銀河英語闖關</h1>
        <p class="sub">點點看可愛的圖示，選一座小島出發吧！</p>
        ${cont}
        <div class="mode-grid">
          <button class="mode-card vocab" data-action="map" data-mode="vocab">
            <img class="mode-img" src="assets/img/balloon.webp" alt=""><b>單字星球</b>
            <small>聽發音・諧音記憶・拼字</small>
            <span class="mode-prog">${prog('vocab')}</span>
          </button>
          <button class="mode-card sentence" data-action="map" data-mode="sentence">
            <img class="mode-img" src="assets/img/kite.webp" alt=""><b>句型星球</b>
            <small>聽句子・選出正確回答</small>
            <span class="mode-prog">${prog('sentence')}</span>
          </button>
        </div>
        <a class="big-btn pink rpg-entry" href="rpg.html">⚔️ 冒險模式：邊跑邊打怪</a>
        <button class="reset-link" data-action="reset">清除闖關紀錄</button>
      </section>`;
  }

  // =====================================================
  // 關卡地圖
  // =====================================================
  function renderMap(mode) {
    leaveLevel();
    setTitle(MODES[mode].icon + ' ' + MODES[mode].label);
    const s = save[mode];
    const cards = levels(mode).map((lv, i) => {
      const n = i + 1;
      const locked = n > s.unlocked;
      const stars = s.stars[n] || 0;
      const current = n === s.unlocked && !s.stars[n];
      return `
        <button class="planet ${locked ? 'locked' : ''} ${current ? 'current' : ''}"
                data-action="${locked ? 'locked' : 'start'}" data-mode="${mode}" data-level="${n}">
          <span class="orb" style="background:${lv.color}">${lv.img ? `<img src="assets/img/${lv.img}.webp" alt="">` : lv.icon}</span>
          <span class="lv">第 ${n} 關</span>
          <span class="nm">${esc(lv.name)}</span>
          <span class="st">${locked ? '' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
        </button>`;
    }).join('');
    app.innerHTML = `
      <div class="map-head">
        <button class="tab ${mode === 'vocab' ? 'on' : ''}" data-action="map" data-mode="vocab">🎈 單字</button>
        <button class="tab ${mode === 'sentence' ? 'on' : ''}" data-action="map" data-mode="sentence">🪁 句型</button>
      </div>
      <div class="planet-grid">${cards}</div>`;
  }

  // =====================================================
  // 開始關卡：每次從題庫隨機抽題，所以每次內容都不一樣
  // =====================================================
  function startLevel(mode, n) {
    leaveLevel();
    const lv = levels(mode)[n - 1];
    const pool = mode === 'sentence' ? lv.items : lv.review ? reviewPool(lv) : lv.words;
    Object.assign(game, {
      mode, level: n, idx: 0, mistakes: 0, busy: false, review: !!lv.review,
      items: shuffle(pool).slice(0, PER_LEVEL),
    });
    save.last = { mode, level: n };
    persist();
    setTitle(`第 ${n} 關・${lv.name}`);
    startTimer();
    if (game.review) startRush();
    else showQuestion();
  }

  function dotsHtml() {
    return '<div class="dots">' + game.items.map((_, i) =>
      `<span class="dot ${i < game.idx ? 'done' : i === game.idx ? 'now' : ''}"></span>`).join('') + '</div>';
  }

  function showQuestion() {
    if (game.idx >= game.items.length) return finishLevel();
    if (game.mode === 'vocab') showWordCard();
    else showSentence();
  }

  function nextQuestion() {
    dropSpell();
    game.idx++;
    game.busy = false;
    showQuestion();
  }

  // =====================================================
  // 單字：1. 學習卡（念一次 + 諧音）
  // =====================================================
  function curWord() {
    const [en, zh, homo, icon] = game.items[game.idx];
    return { en, zh, homo, icon };
  }

  function showWordCard() {
    const w = curWord();
    const color = levels('vocab')[game.level - 1].color;
    app.innerHTML = `
      ${dotsHtml()}
      <div class="panel word-card" style="--accent:${color}">
        <button class="emoji-btn" data-action="say-word" title="點我聽發音">${w.icon}</button>
        <div class="word-en">${esc(w.en)}</div>
        <div class="word-zh">${esc(w.zh)}</div>
        <div class="homo">
          <span class="tag">諧音記憶</span>
          <b>${esc(w.en)}</b> ≈ <b>${esc(w.homo)}</b>
          <button class="mini-btn" data-action="say-homo">🗣️ 聽諧音</button>
        </div>
      </div>
      <div class="actions">
        <button class="big-btn blue" data-action="say-word">🔊 再聽一次</button>
        <button class="big-btn green" data-action="to-spell">✏️ 開始拼字</button>
      </div>`;
    setTimeout(() => speak(w.en), 350);
  }

  // =====================================================
  // 單字：2. 拼字（Crossword 格子 + 打散字母）
  // =====================================================
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

  function showSpell() {
    app.innerHTML = `${dotsHtml()}<div id="spell"></div>`;
    game.spell = GE.SpellGrid($('#spell'), {
      word: curWord(),
      // 第 4 關起多 1 個干擾字母，第 9 關起多 2 個（干擾字母會被打散到隨機位置）
      decoys: game.level >= 9 ? 2 : game.level >= 4 ? 1 : 0,
      onHint: () => { game.mistakes++; },
      onWrong: () => { game.mistakes++; },
      onSolved: () => {
        game.busy = true;
        toast(pick(CHEERS) + ' ⭐');
        setTimeout(() => speak(curWord().en), 300);
        later(nextQuestion, 1700);
      },
    });
  }

  function dropSpell() {
    if (game.spell) game.spell.destroy();
    game.spell = null;
  }

  // =====================================================
  // 複習關：字母慢慢掉下來（像俄羅斯方塊）
  // 依序點出單字的字母；沒點到的字母會在下面堆積。
  // 點錯字母：底部多一排懲罰方塊，掉落速度也變快；
  // 堆到懲罰線就失敗（錯 4 次一定會碰到線）。
  // 每拼完一個單字，掉下來的字母會消掉（懲罰方塊留著）。
  // =====================================================
  const RUSH_COLS = 5;
  const RUSH_ROWS = 9;
  const RUSH_LIMIT = 5;       // 懲罰線高度（排）
  const RUSH_MAX_WRONG = 4;   // 錯 4 次，懲罰方塊剛好堆到懲罰線
  const RUSH_SPEEDUP = 1.25;  // 每錯一次，掉落速度 ×1.25
  const RUSH_COLORS = ['#f4c6b8', '#c6dfe9', '#f5dd9c', '#cfe2c1', '#dcd0e8'];

  function reviewPool(lv) {
    const [from, to] = lv.review;
    return levels('vocab').slice(from - 1, to).filter((l) => !l.review).flatMap((l) => l.words);
  }

  // 這個單字是第幾關學的（失敗時告訴小朋友去哪一關複習）
  function wordLevel(en) {
    return levels('vocab').findIndex((l) => l.words && l.words.some((w) => w[0] === en)) + 1;
  }

  function startRush() {
    const fast = game.level >= 10;
    // 字母方塊盡量大，但整個掉落區要放得進螢幕
    const cell = Math.floor(Math.max(44, Math.min(64,
      (Math.min(window.innerWidth, 760) - 72) / RUSH_COLS,
      (window.innerHeight - 330) / RUSH_ROWS)));
    game.rush = {
      cell,
      speed: cell * (fast ? 0.9 : 0.7),   // 每秒掉多少 px
      every: fast ? 1.4 : 1.7,            // 幾秒出現一個字母
      letters: [], stacks: Array.from({ length: RUSH_COLS }, () => []),
      garbagePx: 0, wrong: 0,
      answer: '', pos: 1, spawnT: 0.5, pauseT: 0, timer: 0, last: 0, nextId: 0, over: false,
    };
    app.innerHTML = `
      <div id="rush-dots"></div>
      <div class="panel rush-top">
        <div class="clue-bar">
          <span class="clue-emoji" id="rush-emoji"></span>
          <b id="rush-zh" class="rush-zh"></b>
          <button class="mini-btn" data-action="say-word" style="margin-left:auto">🔊</button>
        </div>
        <div id="rush-cells"></div>
      </div>
      <div class="rush-board" id="rush-board"
           style="--cell:${cell}px;width:${cell * RUSH_COLS + 6}px;height:${cell * RUSH_ROWS + 6}px">
        <div class="garbage" id="rush-garbage"></div>
        <div class="midline" style="top:${cell * (RUSH_ROWS - RUSH_LIMIT)}px"><span>懲罰線：堆到這裡就失敗</span></div>
      </div>
      <p class="rush-tip" id="rush-tip">照順序點掉下來的字母，拼出上面的單字！點錯會加速喔</p>`;
    $('#rush-board').addEventListener('pointerdown', onRushTap);
    rushSetWord();
    game.rush.last = performance.now();
    game.rush.timer = setInterval(rushLoop, 30);
  }

  function rushStop() {
    const r = game.rush;
    if (!r) return;
    r.over = true;
    clearInterval(r.timer);
    game.rush = null;
  }

  function rushSetWord() {
    const r = game.rush;
    const w = curWord();
    r.answer = w.en.toLowerCase();
    r.pos = 1; // 開頭字母先給
    $('#rush-emoji').textContent = w.icon;
    $('#rush-zh').textContent = w.zh;
    $('#rush-dots').innerHTML = dotsHtml();
    renderRushCells();
    setTimeout(() => speak(w.en), 300);
  }

  function renderRushCells(state) {
    const r = game.rush;
    $('#rush-cells').innerHTML = `<div class="grid" style="--n:${r.answer.length}">` +
      r.answer.split('').map((ch, i) => {
        const cls = ['cell'];
        if (i === 0) cls.push('locked');
        if (state === 'ok') cls.push('ok');
        else if (i === r.pos) cls.push('active');
        return `<span class="${cls.join(' ')}">${i === 0 ? '<span class="num">1</span>' : ''}${i < r.pos ? esc(ch) : ''}</span>`;
      }).join('') + '</div>';
  }

  function placeLetter(L) {
    L.el.style.left = (L.col * game.rush.cell) + 'px';
    L.el.style.top = L.y + 'px';
  }

  // 某一欄目前最上面可以落下的位置
  function rushFloor(col) {
    const r = game.rush;
    return RUSH_ROWS * r.cell - r.garbagePx - (r.stacks[col].length + 1) * r.cell;
  }

  function restack(col) {
    const r = game.rush;
    r.stacks[col].forEach((x, i) => { x.y = RUSH_ROWS * r.cell - r.garbagePx - (i + 1) * r.cell; placeLetter(x); });
  }

  const overLimit = () => {
    const r = game.rush;
    return r.stacks.some((s) => r.garbagePx + s.length * r.cell >= RUSH_LIMIT * r.cell - 1);
  };

  function rushSpawn() {
    const r = game.rush;
    const need = r.answer[r.pos];
    // 畫面上沒有下一個要點的字母時，一定先掉它，避免卡關
    const onBoard = r.letters.some((L) => L.ch === need);
    const x = Math.random();
    const ch = !onBoard || x < 0.4 ? need
      : x < 0.75 ? pick(r.answer.slice(1).split(''))
      : pick(ALPHABET.split(''));
    const free = [...Array(RUSH_COLS).keys()].filter((c) =>
      !r.letters.some((L) => !L.landed && L.col === c && L.y < r.cell * 1.5));
    if (!free.length) return;
    const el = document.createElement('button');
    el.className = 'fall';
    el.textContent = ch;
    el.style.background = RUSH_COLORS[r.nextId % RUSH_COLORS.length];
    const L = { id: r.nextId++, ch, col: pick(free), y: -r.cell, landed: false, el };
    r.letters.push(L);
    $('#rush-board').appendChild(el);
    placeLetter(L);
  }

  function rushLoop() {
    const r = game.rush;
    if (!r || r.over) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - r.last) / 1000);
    r.last = now;
    if (r.pauseT > 0) {
      r.pauseT -= dt;
    } else {
      r.spawnT -= dt;
      if (r.spawnT <= 0) { rushSpawn(); r.spawnT = r.every; }
    }
    for (const L of r.letters) {
      if (L.landed) continue;
      L.y += r.speed * dt;
      const floor = rushFloor(L.col);
      if (L.y >= floor) {
        L.y = floor;
        L.landed = true;
        L.el.classList.add('landed');
        r.stacks[L.col].push(L);
        placeLetter(L);
        if (overLimit()) return rushFail();
      }
      placeLetter(L);
    }
  }

  function removeLetter(L, cls) {
    const r = game.rush;
    r.letters = r.letters.filter((x) => x !== L);
    if (L.landed) {
      // 抽掉堆裡的字母，上面的往下補
      const st = r.stacks[L.col];
      st.splice(st.indexOf(L), 1);
      restack(L.col);
    }
    L.el.classList.add(cls);
    setTimeout(() => L.el.remove(), 350);
  }

  // 點錯：多一排懲罰方塊、掉落加速
  function rushPenalty(L) {
    const r = game.rush;
    game.mistakes++;
    r.wrong++;
    r.garbagePx += RUSH_LIMIT * r.cell / RUSH_MAX_WRONG;
    r.speed *= RUSH_SPEEDUP;
    r.every = Math.max(0.9, r.every / 1.1);
    sfx.bad();
    removeLetter(L, 'nope-out');
    $('#rush-garbage').style.height = r.garbagePx + 'px';
    $('#rush-board').classList.remove('shake');
    void $('#rush-board').offsetWidth;
    $('#rush-board').classList.add('shake');
    for (let c = 0; c < RUSH_COLS; c++) restack(c);
    const left = RUSH_MAX_WRONG - r.wrong;
    $('#rush-tip').textContent = left > 0
      ? `❗ 點錯了！速度變快 ×${(r.speed / (r.cell * (game.level >= 10 ? 0.9 : 0.7))).toFixed(1)}，再錯 ${left} 次就失敗`
      : '❗ 碰到懲罰線了！';
    if (overLimit()) rushFail();
  }

  function onRushTap(e) {
    const r = game.rush;
    const el = e.target.closest('.fall');
    if (!el || !r || r.over || r.pauseT > 0) return;
    e.preventDefault();
    const L = r.letters.find((x) => x.el === el);
    if (!L) return;
    if (L.ch !== r.answer[r.pos]) return rushPenalty(L);
    removeLetter(L, 'got');
    sfx.tap();
    r.pos++;
    if (r.pos >= r.answer.length) rushWordDone();
    else renderRushCells();
  }

  function rushWordDone() {
    const r = game.rush;
    r.pauseT = 1.7;
    renderRushCells('ok');
    sfx.good();
    toast(pick(CHEERS) + ' ⭐');
    setTimeout(() => speak(r.answer), 250);
    // 拼完就把掉下來的字母全部消掉（懲罰方塊留著）
    r.letters.forEach((L) => { L.el.classList.add('pop'); setTimeout(() => L.el.remove(), 350); });
    r.letters = [];
    r.stacks.forEach((s) => { s.length = 0; });
    game.idx++;
    later(() => {
      if (game.idx >= game.items.length) { rushStop(); finishLevel(); }
      else rushSetWord();
    }, 1500);
  }

  function rushFail() {
    const done = game.idx;
    rushStop();
    stopTimer();
    sfx.bad();
    setTimeout(() => speak('Oh no! Try again!'), 300);
    $('#rush-board').classList.add('shake');
    // 這一回合的單字，依「原本在哪一關學」分組，提醒小朋友去複習
    const groups = {};
    game.items.forEach(([en, zh]) => {
      const n = wordLevel(en);
      (groups[n] = groups[n] || []).push(`<b>${esc(en)}</b> ${esc(zh)}`);
    });
    const review = Object.keys(groups).map(Number).sort((a, b) => a - b).map((n) => `
      <li>
        <span>第 ${n} 關「${esc(levels('vocab')[n - 1].name)}」：${groups[n].join('、')}</span>
        <button class="mini-btn" data-action="start" data-mode="vocab" data-level="${n}">去第 ${n} 關複習</button>
      </li>`).join('');
    later(() => {
      app.innerHTML = `
        <div class="panel result">
          <img class="result-img" src="assets/img/tryagain.webp" alt="">
          <h2>碰到懲罰線了！</h2>
          <p>完成了 ${done} / ${game.items.length} 個單字。先去複習這些單字，再回來挑戰吧！</p>
          <ul class="review-list">${review}</ul>
          <div class="actions">
            <button class="big-btn" data-action="start" data-mode="vocab" data-level="${game.level}">🔁 再試一次</button>
            <button class="big-btn blue" data-action="map" data-mode="vocab">🗺️ 關卡地圖</button>
          </div>
        </div>`;
    }, 1000);
  }

  // =====================================================
  // 句型：問句 + 三個選項（中文要按提示才出現）
  // =====================================================
  function showSentence() {
    const [q, qzh, a, azh, wrongs] = game.items[game.idx];
    const lv = levels('sentence')[game.level - 1];
    const opts = shuffle([{ en: a, zh: azh, ok: true }].concat(
      shuffle(wrongs).slice(0, 2).map(([en, zh]) => ({ en, zh, ok: false }))));
    game.opts = opts;
    app.innerHTML = `
      ${dotsHtml()}
      <div class="panel q-card">
        <button class="q-emoji" data-action="say-q" title="點我再聽一次">${lv.icon}</button>
        <div class="q-en">${esc(q)}</div>
        <div class="q-zh" id="q-zh"><button class="mini-btn" data-action="show-zh">👀 看中文</button></div>
        <div class="actions" style="margin-top:12px">
          <button class="big-btn blue" data-action="say-q">🔊 再聽一次</button>
          <button class="big-btn pink" data-action="opt-hint">💡 提示</button>
        </div>
      </div>
      <div class="options">
        ${opts.map((o, i) => `
          <button class="opt" data-action="opt" data-i="${i}">
            <span class="letter">${'ABC'[i]}</span>
            <span class="txt"><span class="en">${esc(o.en)}</span><span class="zh hidden">${esc(o.zh)}</span></span>
          </button>`).join('')}
      </div>`;
    game.qzh = qzh;
    setTimeout(() => speak(q), 350);
  }

  function showOptZh() {
    document.querySelectorAll('.opt .zh').forEach((z) => z.classList.remove('hidden'));
  }

  function chooseOpt(i, el) {
    const o = game.opts[i];
    if (o.ok) {
      game.busy = true;
      el.classList.add('right');
      document.querySelectorAll('.opt').forEach((b) => { b.disabled = true; });
      showOptZh(); // 答對後順便看中文意思
      sfx.good();
      toast(pick(CHEERS) + ' ⭐');
      setTimeout(() => speak(o.en), 300);
      later(nextQuestion, 2000);
    } else {
      game.mistakes++;
      el.classList.add('wrong');
      el.disabled = true;
      sfx.bad();
      setTimeout(() => speak('Try again!'), 200);
    }
  }

  // =====================================================
  // 過關結算
  // =====================================================
  function finishLevel() {
    const elapsed = Date.now() - startTime;
    stopTimer();
    const { mode, level, mistakes } = game;
    // 複習關容易點錯，星星標準放寬一點
    const [three, two] = game.review ? [1, 4] : [0, 2];
    const stars = mistakes <= three ? 3 : mistakes <= two ? 2 : 1;
    const s = save[mode];
    s.stars[level] = Math.max(s.stars[level] || 0, stars);
    const total = levels(mode).length;
    s.unlocked = Math.max(s.unlocked, Math.min(level + 1, total));
    save.last = { mode, level: Math.min(level + 1, total) };
    persist();

    const allDone = Object.keys(s.stars).length >= total;
    const hasNext = level < total;
    playClearVideo(clearVideoName(mode, level), () => showResult({ mode, level, stars, elapsed, mistakes, allDone, hasNext }));
  }

  // ---------- 過關動畫（每關一段 2～3 秒的小影片，魔王關有自己的） ----------
  const CLEAR_VIDEOS = ['fruit', 'pets', 'jungle', 'rainbow', 'school', 'food',
    'body', 'family', 'sky', 'toys', 'sports', 'mood'];

  function clearVideoName(mode, level) {
    if (mode === 'vocab') {
      const lv = levels('vocab')[level - 1];
      if (lv.video) return lv.video;
      const n = levels('vocab').slice(0, level).filter((l) => !l.review).length; // 第幾個一般關
      return CLEAR_VIDEOS[(n - 1) % CLEAR_VIDEOS.length];
    }
    return CLEAR_VIDEOS[(level - 1) % CLEAR_VIDEOS.length]; // 句型關重複使用
  }

  function playClearVideo(name, then) {
    const ov = document.createElement('div');
    ov.className = 'clear-video';
    ov.innerHTML = `
      <div class="clear-video-box">
        <video src="assets/video/${name}.mp4" playsinline preload="auto"></video>
        <button class="skip-btn" type="button">跳過 ⏭</button>
      </div>`;
    document.body.appendChild(ov);
    const v = ov.querySelector('video');
    v.muted = !sound.on;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      // 已經離開關卡（例如按了回首頁）就不再顯示結果
      if (!ov.isConnected) return;
      ov.remove();
      then();
    };
    v.addEventListener('ended', done);
    v.addEventListener('error', done);
    ov.querySelector('.skip-btn').addEventListener('click', done);
    // 有些瀏覽器不讓有聲影片自動播放，就改成靜音播放
    v.play().catch(() => { v.muted = true; v.play().catch(done); });
    setTimeout(done, 8000); // 保險：影片卡住也會繼續
  }

  function showResult({ mode, level, stars, elapsed, mistakes, allDone, hasNext }) {
    sfx.win();
    setTimeout(() => speak(stars === 3 ? 'Perfect! You are a star!' : 'Well done!'), 400);
    app.innerHTML = `
      <div class="panel result">
        <img class="result-img" src="assets/img/win.webp" alt="">
        <h2>${allDone && !hasNext ? '全部星球都征服了！' : '過關成功！'}</h2>
        <div class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
        <p>⏱ 用時 ${fmtTime(elapsed)}　❌ 錯誤 ${mistakes} 次</p>
        <div class="actions">
          <button class="big-btn ghost" data-action="start" data-mode="${mode}" data-level="${level}">🔁 再玩一次</button>
          ${hasNext ? `<button class="big-btn" data-action="start" data-mode="${mode}" data-level="${level + 1}">下一關 ➜</button>` : ''}
          <button class="big-btn blue" data-action="map" data-mode="${mode}">🗺️ 關卡地圖</button>
        </div>
      </div>`;
  }

  // =====================================================
  // 點擊事件
  // =====================================================
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action;
    switch (act) {
      case 'sticker':
        bounceEl(el);
        sfx.tap();
        speak(pick(HELLOS));
        break;
      case 'map':
        sfx.tap();
        renderMap(el.dataset.mode);
        break;
      case 'locked':
        sfx.bad();
        toast('🔒 先完成前一關喔！');
        break;
      case 'start':
        sfx.tap();
        startLevel(el.dataset.mode, Number(el.dataset.level));
        break;
      case 'continue': {
        const m = save.last.mode;
        startLevel(m, Math.min(save[m].unlocked, levels(m).length));
        break;
      }
      case 'reset':
        if (confirm('確定要清除所有闖關紀錄嗎？')) {
          save = defaultSave();
          persist();
          renderHome();
        }
        break;
      case 'say-word':
        if (el.classList.contains('emoji-btn')) bounceEl(el);
        speak(curWord().en);
        break;
      case 'say-homo':
        speak(curWord().homo, 'zh-TW');
        break;
      case 'to-spell':
        sfx.tap();
        showSpell();
        break;
      case 'say-q':
        if (el.classList.contains('q-emoji')) bounceEl(el);
        speak(game.items[game.idx][0]);
        break;
      case 'show-zh':
        $('#q-zh').textContent = game.qzh;
        break;
      case 'opt':
        if (!game.busy) chooseOpt(Number(el.dataset.i), el);
        break;
      case 'opt-hint':
        sfx.tap();
        showOptZh();
        break;
    }
  });

  $('#btn-home').addEventListener('click', () => { sfx.tap(); renderHome(); });

  const soundBtn = $('#btn-sound');
  function syncSoundBtn() { soundBtn.textContent = sound.on ? '🔊' : '🔇'; }
  soundBtn.addEventListener('click', () => {
    sound.set(!sound.on);
    syncSoundBtn();
  });
  syncSoundBtn();

  // 背景慢慢飄的雲
  (function makeClouds() {
    const sc = $('#scenery');
    for (let i = 0; i < 5; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';
      const dur = 60 + Math.random() * 50;
      c.style.top = (40 + Math.random() * 180) + 'px';
      c.style.animationDuration = dur.toFixed(0) + 's';
      c.style.animationDelay = (-Math.random() * dur).toFixed(0) + 's';
      c.style.scale = (0.6 + Math.random() * 0.7).toFixed(2);
      sc.appendChild(c);
    }
  })();

  renderHome();
})();
