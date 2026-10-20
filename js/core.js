// 兩種玩法共用的工具：亂數、語音、音效、拼字格子（田字組件）。
// 一般闖關 (js/game.js) 和 RPG 冒險 (js/rpg/*.js) 都透過 window.GE 使用。
(function () {
  'use strict';

  const SOUND_KEY = 'galaxyEnglish.v1.sound';

  // ---------- 小工具 ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 聲音開關（兩種玩法共用同一個設定） ----------
  const sound = {
    on: true,
    set(v) {
      this.on = v;
      try { localStorage.setItem(SOUND_KEY, v ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (!v) stopSpeech();
    },
  };
  try { sound.on = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { /* ignore */ }

  // ---------- 語音 (瀏覽器內建朗讀) ----------
  let voices = [];
  const hasTTS = 'speechSynthesis' in window;
  function loadVoices() { voices = speechSynthesis.getVoices(); }
  if (hasTTS) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

  function pickVoice(lang) {
    const prefs = lang.startsWith('en') ? ['en-US', 'en-GB', 'en'] : ['zh-TW', 'zh-HK', 'zh-CN', 'zh'];
    for (const p of prefs) {
      const list = voices.filter((v) => v.lang.replace('_', '-').startsWith(p));
      if (list.length) return list.find((v) => /Google|Natural|Online/i.test(v.name)) || list[0];
    }
    return null;
  }
  function speak(text, lang = 'en-US', rate = 0.7) {
    if (!sound.on || !hasTTS) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function stopSpeech() { if (hasTTS) speechSynthesis.cancel(); }

  // ---------- 音效 ----------
  let actx = null;
  function beep(freqs, dur = 0.12, type = 'sine') {
    if (!sound.on) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      freqs.forEach((f) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur);
        t += dur * 0.8;
      });
    } catch (e) { /* 不支援就安靜 */ }
  }
  const sfx = {
    tap: () => beep([660], 0.06, 'triangle'),
    good: () => beep([523, 659, 784], 0.12),
    bad: () => beep([240, 180], 0.15, 'square'),
    win: () => beep([523, 659, 784, 1046], 0.16),
    hint: () => beep([880, 990], 0.08, 'triangle'),
  };

  // =====================================================
  // 拼字格子（Crossword 格子 + 打散字母）＝「田字組件」
  // GE.SpellGrid(host, {
  //   word: { en, zh, icon }, decoys: 干擾字母數,
  //   onSolved(), onWrong(), onHint()   // 由外部決定加分、扣血或跳題
  // }) → { lock(bool), destroy() }
  // =====================================================
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

  function SpellGrid(host, opts) {
    const word = opts.word;
    const answer = word.en.toLowerCase();
    const cells = Array(answer.length).fill(null);
    // 隨機先給一個字母（不固定在開頭，才不會太好猜）
    const given = Math.floor(Math.random() * answer.length);
    cells[given] = { ch: answer[given], locked: true };
    const correct = answer.slice(0, given) + answer.slice(given + 1);
    const letters = correct.split('');
    for (let i = 0; i < (opts.decoys || 0); i++) letters.push(pick(ALPHABET.split('')));
    let order = shuffle(letters);
    for (let t = 0; t < 10 && letters.length > 1 && order.join('').startsWith(correct); t++) order = shuffle(letters);
    const tiles = order.map((ch, id) => ({ id, ch, used: false }));
    let busy = false;     // 自己在播答對/答錯動畫
    let locked = false;   // 外部鎖住（例如戰鬥動畫中）
    let pending = null;

    function render(state) {
      const firstEmpty = cells.findIndex((c) => !c);
      const cellsHtml = cells.map((c, i) => {
        const cls = ['cell'];
        if (c && c.locked) cls.push(c.hint ? 'hinted' : 'locked');
        if (state === 'ok') cls.push('ok');
        else if (state === 'bad') cls.push('bad');
        else if (i === firstEmpty) cls.push('active');
        return `<button class="${cls.join(' ')}" data-sg="cell" data-i="${i}">
          ${i === 0 ? '<span class="num">1</span>' : ''}${c ? esc(c.ch) : ''}</button>`;
      }).join('');
      const tilesHtml = tiles.map((t) =>
        `<button class="tile ${t.used ? 'used' : ''}" data-sg="tile" data-id="${t.id}">${esc(t.ch)}</button>`).join('');
      host.innerHTML = `
        <div class="panel">
          <div class="clue-bar">
            <span class="clue-num">1A</span>
            <span class="clue-emoji">${word.icon}</span>
            <b>${esc(word.zh)}</b>
            <small>${answer.length} 個字母</small>
          </div>
          <div class="grid ${state === 'bad' ? 'shake' : ''}" style="--n:${answer.length}">${cellsHtml}</div>
          <div class="tiles">${tilesHtml}</div>
        </div>
        <div class="actions">
          <button class="big-btn blue" data-sg="say">🔊 聽發音</button>
          <button class="big-btn pink" data-sg="hint">💡 提示</button>
          <button class="big-btn ghost" data-sg="clear">↺ 重來</button>
        </div>`;
    }

    function clearCells() {
      cells.forEach((c, i) => {
        if (c && !c.locked) {
          tiles.find((t) => t.id === c.tileId).used = false;
          cells[i] = null;
        }
      });
    }

    function placeTile(id) {
      const tile = tiles.find((t) => t.id === id);
      const slot = cells.findIndex((c) => !c);
      if (!tile || tile.used || slot < 0) return;
      tile.used = true;
      cells[slot] = { ch: tile.ch, tileId: tile.id };
      sfx.tap();
      afterChange();
    }

    function removeCell(i) {
      const c = cells[i];
      if (!c || c.locked) return;
      tiles.find((t) => t.id === c.tileId).used = false;
      cells[i] = null;
      sfx.tap();
      render();
    }

    function giveHint() {
      // 找到第一個「空的或放錯」的格子
      const target = cells.findIndex((c, k) => !c || (!c.locked && c.ch !== answer[k]));
      if (target < 0) return;
      const need = answer[target];
      // 先把該格清空
      const cur = cells[target];
      if (cur && !cur.locked) {
        tiles.find((t) => t.id === cur.tileId).used = false;
        cells[target] = null;
      }
      // 找一個沒用過的正確字母；沒有就從後面格子借回來
      let tile = tiles.find((t) => !t.used && t.ch === need);
      if (!tile) {
        const j = cells.findIndex((c, k) => k > target && c && !c.locked && c.ch === need);
        if (j < 0) return;
        tile = tiles.find((t) => t.id === cells[j].tileId);
        cells[j] = null;
      }
      tile.used = true;
      cells[target] = { ch: need, tileId: tile.id, locked: true, hint: true };
      sfx.hint();
      if (opts.onHint) opts.onHint();
      afterChange();
    }

    function afterChange() {
      if (cells.some((c) => !c)) return render();
      const guess = cells.map((c) => c.ch).join('');
      busy = true;
      if (guess === answer) {
        render('ok');
        sfx.good();
        if (opts.onSolved) opts.onSolved();
      } else {
        render('bad');
        sfx.bad();
        if (opts.onWrong) opts.onWrong();
        pending = setTimeout(() => { clearCells(); busy = false; render(); }, 800);
      }
    }

    function onClick(e) {
      const el = e.target.closest('[data-sg]');
      if (!el) return;
      const act = el.dataset.sg;
      if (act === 'say') return speak(word.en);
      if (busy || locked) return;
      if (act === 'tile') placeTile(Number(el.dataset.id));
      else if (act === 'cell') removeCell(Number(el.dataset.i));
      else if (act === 'hint') giveHint();
      else if (act === 'clear') { clearCells(); render(); }
    }

    host.addEventListener('click', onClick);
    render();

    return {
      lock(v) { locked = v; host.classList.toggle('sg-locked', v); },
      destroy() { clearTimeout(pending); host.removeEventListener('click', onClick); },
    };
  }

  window.GE = { shuffle, pick, esc, sound, hasTTS, speak, stopSpeech, beep, sfx, SpellGrid };
})();
