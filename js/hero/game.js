// 單字勇者：戰鬥、寶箱、鍛造屋、夥伴
(function () {
  'use strict';
  const D = window.HERO_DATA, J = window.RPG.juice;
  const GR = D.GRADES, CH = D.CHARS, WP = D.WEAPONS;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TYPE_NAME = { spell: '單字', talk: '文法', cloze: '句型填空' };
  const MON_HP = [40, 60, 85, 115, 150, 190];
  const MON_ATK = [6, 8, 11, 14, 18, 22];
  const HIT_CAP = 0.8;                      // 一下最多打掉怪物最大血量的 80%（不會一擊秒殺）
  const FX_COLOR = ['#fff3a0', '#fff3a0', '#cfe7ff', '#9fd0ff', '#ffe08a', '#ff7a2f', '#7fe3ff', '#ffe14a', '#c77dff', '#ff8af0', '#ffd700'];

  /* ---------- 聲音（可關） ---------- */
  let soundOn = true;
  try { soundOn = localStorage.getItem('word_hero_sound') !== 'off'; } catch (e) {}
  let actx = null;
  function beep(freq, wave = 'sine', dur = 0.12, vol = 0.12) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = wave; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  function speak(text) {
    if (!soundOn || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.7;
    speechSynthesis.speak(u);
  }

  /* ---------- 存檔 ---------- */
  const SAVE = 'word_hero_v3';
  let S = {
    grade: 1, cleared: {}, letters: {}, gold: 0, points: 0, forged: 0,
    unlocked: ['hero'], chars: { hero: { lv: 1, exp: 0 } },
    owned: { sword: [], staff: [], shield: [], greatsword: [] }, equip: {}, clozePick: 'shield',
  };
  function load() {
    try {
      const v3 = localStorage.getItem(SAVE);
      if (v3) { S = Object.assign(S, JSON.parse(v3)); return; }
      // 上一版的字母搬過來（改成小寫）
      const v2 = JSON.parse(localStorage.getItem('word_hero_v2') || 'null');
      if (v2 && v2.letters) Object.entries(v2.letters).forEach(([k, n]) => { const c = k.toLowerCase(); S.letters[c] = (S.letters[c] || 0) + n; });
    } catch (e) {}
  }
  const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} };

  /* ---------- 角色數值 ---------- */
  const lvOf = (id) => (S.chars[id] || { lv: 1 }).lv;
  function tierOf(id, lv = lvOf(id)) { let k = 0; CH[id].tiers.forEach((need, i) => { if (lv >= need) k = i; }); return k + 1; }
  const imgOf = (id, t = tierOf(id)) => CH[id].img(t);
  const weaponOf = (id) => { const i = S.equip[id]; return i == null ? null : WP[CH[id].weapon][i]; };
  const statAtk = (id) => Math.round(CH[id].atk + CH[id].atkUp * (lvOf(id) - 1) + ((weaponOf(id) || {}).atk || 0));
  const statHp = (id) => Math.round(CH[id].hp + CH[id].hpUp * (lvOf(id) - 1));
  const defPct = (id) => (CH[id].guard ? Math.min(70, 20 + ((weaponOf(id) || {}).def || 0)) : 0);
  const expNeed = (lv) => 20 + lv * 15;
  const G = () => GR[S.grade - 1];
  const stageKey = (g, i) => `g${g}-${i + 1}`;
  // 打倒某年級魔王，下一個年級才開放
  function reachedGrade() {
    let g = 1;
    while (g < GR.length && GR[g - 1].stages.length && S.cleared[stageKey(g, GR[g - 1].stages.length - 1)]) g++;
    return g;
  }
  function partyIds() {
    const p = ['hero'];
    if (S.unlocked.includes('mage')) p.push('mage');
    const cl = S.unlocked.includes(S.clozePick) ? S.clozePick : ['shield', 'angel'].find((x) => S.unlocked.includes(x));
    if (cl) p.push(cl);
    return p;
  }
  function addPoint() {
    S.points++;
    const fresh = [];
    Object.keys(CH).forEach((id) => {
      if (!S.unlocked.includes(id) && S.points >= CH[id].unlock) { S.unlocked.push(id); S.chars[id] = { lv: 1, exp: 0 }; fresh.push(id); }
    });
    persist();
    $('#points').innerText = S.points;
    return fresh;
  }

  /* ========================================================
     戰鬥
     ======================================================== */
  let B = null;
  const field = $('#field'), fx = $('#fx'), con = $('#console');
  const say = (html) => { con.innerHTML = `<div class="msg">${html}</div>`; };
  function note(html) { const m = B && B.mode && con.querySelector('.msg'); if (m) m.innerHTML = html; else say(html); }
  const alive = () => B.mons.filter((m) => m.hp > 0);
  const partyAlive = () => B.party.filter((m) => m.hp > 0);
  function point(el) {
    const a = field.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height * 0.5 };
  }

  function startStage(si, msg) {
    const g = G(), gi = S.grade - 1;
    if (!g.stages.length) return say('這個年級的題目還在準備中（第二階段開放）。');
    si = Math.max(0, Math.min(si, g.stages.length - 1));
    const stage = g.stages[si], boss = si === g.stages.length - 1;
    const words = shuffle(stage.words);
    const n = 1 + Math.floor(Math.random() * 3);
    const mons = [];
    for (let k = 0; k < n; k++) {
      const isBoss = boss && k === 0;
      const w = words[k % words.length];
      const max = isBoss ? MON_HP[gi] * 3 : MON_HP[gi];
      mons.push({
        word: w[0], ch: w[1], hp: max, max, boss: isBoss,
        atk: Math.round(MON_ATK[gi] * (isBoss ? 1.6 : 1)),
        img: isBoss ? `assets/hero/m-boss-${g.boss}.webp` : `assets/hero/m-${g.sheet}-${1 + Math.floor(Math.random() * 8)}.webp`,
      });
    }
    if (boss && mons.length > 1) mons.splice(1, 0, mons.shift()); // 魔王站中間
    B = {
      si, stage, boss, mons, key: stageKey(S.grade, si), first: !S.cleared[stageKey(S.grade, si)],
      party: partyIds().map((id) => ({ id, hp: statHp(id), max: statHp(id), def: false })),
      turn: 0, target: 0, busy: true, over: false, mode: null, unlocks: [],
    };
    $('#field-bg').style.backgroundImage = `url("${g.bg}")`;
    $('#stage-tag').innerText = `${boss ? '👑 魔王 ' : ''}小${'一二三四五六'[gi]} 第 ${si + 1} 關・${stage.name}${B.first ? '' : '（複習）'}`;
    $('#stage-tag').classList.toggle('boss', boss);
    $('#stage-num').innerText = `${S.grade}-${si + 1}`;
    renderMonsters(true);
    renderParty();
    say(msg || `${boss ? '👑 ' : ''}<b>${esc(mons.map((m) => m.ch + '怪').join('、'))}</b> 出現了！`);
    const b = B;
    setTimeout(() => { if (B === b) { b.busy = false; beginTurn(); } }, 900);
  }

  /* ---------- 畫面 ---------- */
  function renderMonsters(enter) {
    const box = $('#monsters');
    box.innerHTML = '';
    B.mons.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'mon' + (m.boss ? ' boss' : '') + (m.chest ? ' chest' : '') + (m.opened ? ' opened' : '')
        + (!m.chest && i === B.target && !B.over ? ' target' : '');
      const src = m.chest ? `assets/hero/p-chest-${m.boss ? 'gold' : 'wood'}${m.opened ? '-open' : ''}.webp` : m.img;
      el.innerHTML = `<img src="${src}" alt=""><span class="tag">${m.chest ? (m.opened ? '已打開' : (m.boss ? '✨ 金寶箱' : '寶箱')) : esc(m.ch) + '怪'}</span>`
        + (m.chest ? '' : `<span class="bar"><i style="width:${(m.hp / m.max) * 100}%"></i></span>`);
      el.onclick = () => (m.chest ? openChest(m) : chooseTarget(i));
      box.appendChild(el);
      m.el = el;
      if (enter) J.enter(el);
    });
  }
  function renderParty() {
    const box = $('#partyrow');
    box.innerHTML = '';
    B.party.forEach((p, i) => {
      const c = CH[p.id], w = weaponOf(p.id);
      const el = document.createElement('div');
      el.className = 'pm' + (p.id === 'hero' ? ' hero-src' : '') + (i === B.turn && !B.over ? ' active' : '') + (p.hp <= 0 ? ' down' : '') + (p.hp < p.max * 0.3 ? ' low' : '');
      el.innerHTML = `<div class="sprite"><img class="body" src="${imgOf(p.id)}" alt="">${w ? `<img class="wpn" src="${D.weaponImg(c.weapon, S.equip[p.id])}" alt="">` : ''}</div>
        <div class="plate win"><div class="nm">${c.name}<small>Lv.${lvOf(p.id)}</small>${p.def ? ' 🛡️' : ''}</div>
        <div class="hpbar"><i style="width:${Math.max(0, p.hp / p.max) * 100}%"></i></div></div>`;
      box.appendChild(el);
      p.el = el;
    });
  }

  /* ---------- 回合 ---------- */
  function beginTurn() {
    if (B.over) return;
    let guard = 0;
    while (B.party[B.turn].hp <= 0 && guard++ < 5) B.turn = (B.turn + 1) % B.party.length;
    B.party[B.turn].def = false;
    if (!B.mons[B.target] || B.mons[B.target].hp <= 0) B.target = B.mons.findIndex((x) => x.hp > 0);
    B.mode = null;
    renderParty();
    renderMonsters(false);
    showCommands();
  }
  const nextTurn = () => { B.turn = (B.turn + 1) % B.party.length; beginTurn(); };

  function showCommands() {
    const p = B.party[B.turn], c = CH[p.id];
    const atk = { spell: '⚔️ 攻擊<small>拼出怪物的單字</small>', talk: '✨ 咒文<small>答對文法對話</small>', cloze: '📜 填空<small>答對句型填空</small>' }[c.type];
    con.innerHTML = `<div class="msg"><b>${c.name}</b> 要怎麼做？</div>
      <div class="cmds">
        <button class="cmd" data-cmd="attack">${atk}</button>
        <button class="cmd" data-cmd="defend">🛡️ 防禦<small>傷害減半</small></button>
        <button class="cmd" data-cmd="run">🏃 逃跑<small>重新遇敵</small></button>
      </div>`;
    con.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => onCommand(b.dataset.cmd));
  }

  function onCommand(cmd) {
    if (B.busy || B.over) return;
    beep(660, 'triangle', 0.05, 0.08);
    const p = B.party[B.turn], c = CH[p.id];
    if (cmd === 'attack') ({ spell: askSpell, talk: askTalk, cloze: askCloze })[c.type]();
    else if (cmd === 'defend') {
      p.def = true;
      say(`<b>${c.name}</b> 擺出防禦的姿勢！`);
      renderParty();
      B.busy = true; const b = B;
      setTimeout(() => { if (B === b) { b.busy = false; nextTurn(); } }, 700);
    } else if (cmd === 'run') {
      B.busy = true; const b = B;
      if (Math.random() < 0.6) { say('成功逃走了！又遇到新的怪物…'); setTimeout(() => { if (B === b) startStage(b.si); }, 900); }
      else { say('沒能逃掉！'); setTimeout(async () => { if (B !== b) return; await monsterAttack(); if (B === b && !b.over) { b.busy = false; nextTurn(); } }, 600); }
    }
  }
  function chooseTarget(i) {
    if (!B || B.over || B.busy || B.mons[i].hp <= 0) return;
    B.target = i;
    renderMonsters(false);
    if (B.mode === 'spell') askSpell();
  }
  const backRow = '<div class="row"><button class="small-btn" id="back">↩️ 回到指令</button><span></span></div>';
  function bindBack() { $('#back').onclick = () => { if (!B.busy) { B.mode = null; showCommands(); } }; }

  /* ---------- 題目 1：拼單字 ---------- */
  function askSpell() {
    const p = B.party[B.turn], mon = B.mons[B.target];
    B.mode = 'spell';
    B.q = { word: mon.word, pos: 0, wrong: 0, tries: 0 };
    const tiles = shuffle(mon.word.split('').concat([pick('bcdfghklmnprstw'), pick('aeiou')]));
    con.innerHTML = `<div class="row"><div class="msg"><b>${CH[p.id].name}</b>：拼出「<b>${esc(mon.ch)}</b>」攻擊！</div><button class="small-btn" id="say">🔊</button></div>
      <div class="slots">${mon.word.split('').map((_, i) => `<span class="slot${i ? '' : ' active'}"></span>`).join('')}</div>
      <div class="hint" id="hint">${alive().length > 1 ? '點上面的怪物可以換攻擊目標' : ''}</div>
      <div class="keys">${tiles.map((ch) => `<button class="key">${ch}</button>`).join('')}</div>${backRow}`;
    $('#say').onclick = () => speak(mon.word);
    bindBack();
    con.querySelectorAll('.key').forEach((k) => k.onclick = () => pressKey(k));
  }
  async function pressKey(k) {
    if (B.busy || B.over || B.mode !== 'spell') return;
    const q = B.q, ch = k.innerText, need = q.word[q.pos], slots = con.querySelectorAll('.slot');
    if (ch === need) {
      beep(420 + q.pos * 80, 'sine', 0.08);
      k.classList.add('used');
      slots[q.pos].innerText = ch; slots[q.pos].classList.add('filled'); slots[q.pos].classList.remove('active');
      q.pos++; q.wrong = 0; $('#hint').innerText = '';
      if (q.pos < q.word.length) slots[q.pos].classList.add('active');
      else { B.busy = true; speak(q.word); await answered(q.tries === 0); }
    } else {
      q.wrong++; q.tries++;
      if (q.wrong === 1) { $('#hint').innerText = '💡 提示：聽聽看發音，再想想下一個字母'; speak(q.word); }
      else {
        $('#hint').innerText = `💡 提示：下一個字母是「${need}」`;
        const key = [...con.querySelectorAll('.key:not(.used)')].find((x) => x.innerText === need);
        if (key) { key.classList.remove('glow'); void key.offsetWidth; key.classList.add('glow'); }
      }
      await wrongAnswer();
    }
  }

  /* ---------- 題目 2、3：文法對話、句型填空（三選一） ---------- */
  function poolOf(kind) {
    const cur = G()[kind], all = GR.slice(0, S.grade).flatMap((g) => g[kind]);
    return Math.random() < 0.7 && cur.length ? cur : all;
  }
  function askTalk() {
    const [q, qzh, a, azh, wrongs] = pick(poolOf('talk'));
    const opts = shuffle([{ en: a, zh: azh, ok: true }].concat(shuffle(wrongs).slice(0, 2).map(([en, zh]) => ({ en, zh, ok: false }))));
    askChoice('talk', `<div class="q">${esc(q)}</div>`, opts, q, `題目的意思是「${qzh}」`, a);
  }
  function askCloze() {
    const [s, zh, a, wrongs] = pick(poolOf('cloze'));
    const opts = shuffle([{ en: a, ok: true }].concat(wrongs.slice(0, 2).map((w) => ({ en: w, ok: false }))));
    const html = `<div class="q">${esc(s).replace('___', '<span class="blank"></span>')}</div>`;
    askChoice('cloze', html, opts, null, `這句的意思是「${zh}」`, s.replace('___', a));
  }
  function askChoice(mode, qHtml, opts, readQ, hint, readAfter) {
    const p = B.party[B.turn];
    B.mode = mode;
    B.q = { opts, tries: 0, readAfter };
    con.innerHTML = `<div class="row"><div class="msg"><b>${CH[p.id].name}</b>：${mode === 'talk' ? '選出正確的回答' : '選出空格裡的字'}！</div>${readQ ? '<button class="small-btn" id="say">🔊</button>' : ''}</div>
      ${qHtml}<div class="hint" id="hint"></div>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="l">${'ABC'[i]}</span><span><span class="en">${esc(o.en)}</span>${o.zh ? `<span class="zh" hidden>${esc(o.zh)}</span>` : ''}</span></button>`).join('')}</div>${backRow}`;
    if (readQ) { $('#say').onclick = () => speak(readQ); speak(readQ); }
    bindBack();
    con.querySelectorAll('.opt').forEach((b) => b.onclick = async () => {
      if (B.busy || B.over || b.disabled) return;
      const o = opts[+b.dataset.i];
      const reveal = () => con.querySelectorAll('.opt .zh').forEach((z) => z.hidden = false);
      if (o.ok) {
        B.busy = true;
        b.classList.add('right'); con.querySelectorAll('.opt').forEach((x) => x.disabled = true); reveal();
        beep(660, 'sine', 0.12); speak(readAfter);
        if (mode === 'cloze') con.querySelector('.blank').innerText = o.en;
        await answered(B.q.tries === 0);
      } else {
        B.q.tries++;
        b.classList.add('wrong'); b.disabled = true;
        $('#hint').innerText = '💡 提示：' + hint;
        reveal();
        await wrongAnswer();
      }
    });
  }

  async function answered(firstTry) {
    if (firstTry) B.unlocks.push(...addPoint());
    await sleep(350);
    await doAttack(B.party[B.turn].id);
  }
  async function wrongAnswer() {
    beep(150, 'sawtooth', 0.25, 0.18);
    B.busy = true;
    const b = B;
    await monsterAttack(B.mons[B.target]);
    if (B !== b || b.over) return;
    b.busy = false;
    if (b.party[b.turn].hp <= 0) { await sleep(600); if (B === b) nextTurn(); }
  }

  /* ---------- 攻擊與特效（武器越強越浮誇） ---------- */
  async function doAttack(id) {
    const b = B, c = CH[id], p = b.party[b.turn];
    const wi = S.equip[id], tier = wi == null ? 0 : wi + 1, lvl = Math.ceil(tier / 2), color = FX_COLOR[tier];
    fx.style.setProperty('--c', color);
    const main = b.mons[b.target] && b.mons[b.target].hp > 0 ? b.mons[b.target] : alive()[0];
    const targets = c.aoe ? alive() : [main];
    say(`<b>${c.name}</b> 的攻擊！${tier ? `（${esc(WP[c.weapon][wi].name)}）` : ''}`);
    if (lvl >= 5) await cutIn(D.weaponImg(c.weapon, wi), WP[c.weapon][wi].name, color);
    if (B !== b) return;
    p.el.animate([{ transform: 'translateY(-6px)' }, { transform: 'translateY(-40px) scale(1.08)' }, { transform: 'translateY(-6px)' }], { duration: 420, easing: 'ease-in-out' });
    await sleep(200);
    if (lvl >= 3) flashTint(color, lvl >= 4 ? 0.55 : 0.3);
    const base = statAtk(id);
    await Promise.all(targets.map((m) => {
      let d = base * (0.9 + Math.random() * 0.2);
      if (c.aoe && !c.noFalloff && m !== main) d *= 0.7;       // 魔法使：其他怪物傷害 70%
      d = Math.max(1, Math.min(Math.round(d), Math.floor(m.max * HIT_CAP)));
      return hitMon(m, d, lvl, color);
    }));
    if (B !== b) return;
    renderParty();
    if (!alive().length) return victory();
    await sleep(350);
    if (B !== b) return;
    b.busy = false;
    nextTurn();
  }

  async function hitMon(m, dmg, lvl, color) {
    if (!m || m.hp <= 0) return;
    const pt = point(m.el), img = m.el.querySelector('img');
    beep(lvl >= 4 ? 900 : 600, 'square', 0.12, 0.16);
    J.sparks(fx, pt.x, pt.y, lvl >= 1 ? 'assets/hero/p-sparkle.webp' : 'assets/rpg/ui-hit.webp');
    if (lvl >= 2) slash(pt, color);
    if (lvl >= 4) ring(pt, color);
    J.floatText(fx, pt.x, pt.y - 20, String(dmg), lvl >= 4 ? 'crit' : 'dmg');
    J.flash(img, 'white');
    J.knockback(m.el, 1, lvl >= 4 ? 1.5 : 1);
    J.shake(field, lvl >= 4 ? 1.5 : 0.8);
    if (lvl >= 4) await sleep(160);                              // 慢動作停頓
    m.hp = Math.max(0, m.hp - dmg);
    const bar = m.el.querySelector('.bar i'); if (bar) bar.style.width = (m.hp / m.max) * 100 + '%';
    await sleep(320);
    if (m.hp <= 0) await toChest(m);
  }
  function slash(pt, color) {
    const s = document.createElement('div'); s.className = 'slash'; s.style.setProperty('--c', color);
    s.style.left = pt.x - 100 + 'px'; s.style.top = pt.y - 100 + 'px'; fx.appendChild(s);
    s.animate([{ transform: 'rotate(-120deg) scale(.6)', opacity: 1 }, { transform: 'rotate(80deg) scale(1.1)', opacity: 0 }], { duration: 350, easing: 'ease-out' }).finished.then(() => s.remove(), () => s.remove());
  }
  function ring(pt, color) {
    const r = document.createElement('div'); r.className = 'ring'; r.style.setProperty('--c', color);
    r.style.left = pt.x - 20 + 'px'; r.style.top = pt.y - 20 + 'px'; fx.appendChild(r);
    r.animate([{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(7)', opacity: 0 }], { duration: 600, easing: 'ease-out' }).finished.then(() => r.remove(), () => r.remove());
  }
  function flashTint(color, op) {
    const t = document.createElement('div'); t.className = 'tint'; t.style.setProperty('--c', color); fx.appendChild(t);
    t.animate([{ opacity: 0 }, { opacity: op }, { opacity: 0 }], { duration: 450 }).finished.then(() => t.remove(), () => t.remove());
  }
  async function cutIn(src, name, color) {
    const el = document.createElement('div'); el.className = 'cutin'; el.style.setProperty('--c', color);
    el.innerHTML = `<img src="${src}" alt=""><b>${esc(name)}！</b>`;
    $('#game').appendChild(el);
    beep(1200, 'triangle', 0.3, 0.15);
    await el.animate([{ opacity: 0, transform: 'translateX(-40%)' }, { opacity: 1, transform: 'translateX(0)', offset: 0.25 }, { opacity: 1, transform: 'translateX(4%)', offset: 0.8 }, { opacity: 0, transform: 'translateX(40%)' }], { duration: 1100, easing: 'ease-out' }).finished.catch(() => {});
    el.remove();
  }

  // 怪物倒下 → 原地變成寶箱（魔王是金寶箱）
  async function toChest(m) {
    const pt = point(m.el);
    J.smoke(fx, pt.x, pt.y);
    beep(520, 'triangle', 0.2, 0.15);
    m.chest = true;
    m.el.classList.add('chest'); m.el.classList.remove('target');
    m.el.querySelector('img').src = `assets/hero/p-chest-${m.boss ? 'gold' : 'wood'}.webp`;
    m.el.querySelector('.tag').innerText = m.boss ? '✨ 金寶箱' : '寶箱';
    const bar = m.el.querySelector('.bar'); if (bar) bar.remove();
    m.el.querySelector('img').animate([{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
    await sleep(300);
  }

  async function monsterAttack(prefer) {
    const list = alive();
    if (!list.length) return;
    const mon = prefer && prefer.hp > 0 ? prefer : pick(list);
    let victim = B.party[B.turn];
    const shield = B.party.find((x) => CH[x.id].guard && x.hp > 0);
    let guarded = false;
    if (shield && victim !== shield && Math.random() < 0.5) { victim = shield; guarded = true; }
    const dmg = Math.max(1, Math.round((mon.atk + Math.floor(Math.random() * 4)) * (victim.def ? 0.5 : 1) * (1 - defPct(victim.id) / 100)));
    mon.el.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(30px) scale(1.18)' }, { transform: 'translateY(0) scale(1)' }], { duration: 320, easing: 'ease-in-out' });
    await sleep(180);
    victim.hp = Math.max(0, victim.hp - dmg);
    beep(200, 'sawtooth', 0.2, 0.2);
    note(`<b>${esc(mon.ch)}怪</b> 的攻擊！${guarded ? '<b>盾戰士</b> 挺身擋下！' : ''}<b>${CH[victim.id].name}</b> 受到 ${dmg} 點傷害${victim.hp <= 0 ? '，倒下了…' : '。再試一次！'}`);
    renderParty();
    const pt = point(victim.el);
    J.floatText(fx, pt.x, pt.y - 30, '-' + dmg, 'ouch');
    victim.el.animate([{ transform: 'translateX(0)', filter: 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(6)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)', filter: 'none' }], 320);
    J.shake($('#game'), 0.6);
    await sleep(450);
    if (!partyAlive().length) await wipeOut();
  }

  /* ---------- 勝利：開寶箱 → 經驗、升級 ---------- */
  function victory() {
    B.over = true; B.mode = 'loot'; B.busy = false;
    beep(523, 'triangle', 0.15, 0.2); setTimeout(() => beep(659, 'triangle', 0.15, 0.2), 150); setTimeout(() => beep(784, 'triangle', 0.3, 0.2), 300);
    renderParty();
    con.innerHTML = `<div class="msg">🎉 怪物全滅，都變成<b>寶箱</b>了！點上面的寶箱打開，收集英文字母。</div>
      <div class="row"><span></span><button class="btn" id="open-all">全部打開</button></div>`;
    $('#open-all').onclick = async () => { for (const m of B.mons) if (!m.opened) { openChest(m); await sleep(350); } };
  }
  function openChest(m) {
    if (!B || !B.over || m.opened || B.mode !== 'loot') return;
    m.opened = true;
    m.el.classList.add('opened');
    m.el.querySelector('img').src = `assets/hero/p-chest-${m.boss ? 'gold' : 'wood'}-open.webp`;
    m.el.querySelector('.tag').innerText = '已打開';
    const got = m.word.split('');
    if (m.boss) for (let i = 0; i < 3; i++) got.push(pick('abcdefghiklmnoprstuwy'));
    got.forEach((c) => { S.letters[c] = (S.letters[c] || 0) + 1; });
    if (m.boss) S.gold++;
    persist();
    beep(880, 'triangle', 0.3, 0.18);
    const pt = point(m.el);
    J.floatText(fx, pt.x, pt.y - 20, '+ ' + got.join(' ') + (m.boss ? '  ★1' : ''), 'loot');
    if (B.mons.every((x) => x.opened)) setTimeout(finishBattle, 900);
  }

  function finishBattle() {
    const b = B, gi = S.grade - 1;
    if (!b || b.mode !== 'loot') return;
    b.mode = 'done';
    const exp = b.mons.reduce((s, m) => s + (m.boss ? 50 : 10) * (gi + 1), 0);
    const ups = [];
    b.party.forEach((p) => {
      const st = S.chars[p.id];
      const t0 = tierOf(p.id);
      st.exp += exp;
      let up = false;
      while (st.exp >= expNeed(st.lv)) { st.exp -= expNeed(st.lv); st.lv++; up = true; }
      if (up) ups.push({ id: p.id, lv: st.lv, evolved: tierOf(p.id) > t0 });
    });
    if (b.first) S.cleared[b.key] = true;
    persist();
    const g = G(), last = b.si === g.stages.length - 1;
    let html = `<h2>${b.boss ? '👑 擊敗魔王！' : '🎉 勝利！'}</h2><p class="note">隊伍獲得 ${exp} 點經驗值</p>`;
    ups.forEach((u) => {
      html += u.evolved
        ? `<div style="margin:10px 0"><img class="pop-img" src="${imgOf(u.id)}" alt=""><div style="color:var(--gold);font-weight:900">✨ ${CH[u.id].name} 升到 Lv.${u.lv}，外觀進化了！</div></div>`
        : `<p>⬆️ ${CH[u.id].name} 升到 <b style="color:var(--gold)">Lv.${u.lv}</b>！</p>`;
    });
    b.unlocks.forEach((id) => {
      html += `<div style="margin:10px 0"><img class="pop-img" src="${imgOf(id)}" alt=""><div style="color:#7fe3ff;font-weight:900">🎊 新夥伴 ${CH[id].name} 加入了！</div><p class="note">${esc(CH[id].desc)}</p></div>`;
    });
    let next = b.si + 1 < g.stages.length ? b.si + 1 : 0, nextLabel = '下一關 ▶';
    if (last && b.first && S.grade < GR.length && GR[S.grade].stages.length) nextLabel = `前往小${'一二三四五六'[S.grade]} ▶`;
    else if (last && b.first) nextLabel = '回到第 1 關複習 ▶';
    html += `<button class="btn" id="go-next" style="margin-top:12px">${nextLabel}</button>`;
    showModal(html);
    $('#go-next').onclick = () => {
      closeModal();
      if (last && b.first && S.grade < GR.length && GR[S.grade].stages.length) { S.grade++; persist(); setupGrades(); next = 0; }
      startStage(next);
    };
  }

  async function wipeOut() {
    const b = B;
    b.over = true; b.mode = 'wipe';
    await sleep(400);
    if (B !== b) return;
    showModal(`<h2 style="color:var(--red)">💀 全滅了…</h2><p class="note" style="margin:6px 0 12px">別灰心！收集到的字母都還在。<br>回到營火休息，HP 全滿再挑戰一次吧！</p><button class="btn" id="retry">🔥 重新挑戰</button>`);
    $('#retry').onclick = () => { closeModal(); startStage(b.si); };
  }

  /* ========================================================
     鍛造屋：用字母拼出配方單字 → 丟進鐵爐 → 武器
     ======================================================== */
  let forgeChar = 'hero', forging = null;
  const letterCount = () => Object.values(S.letters).reduce((a, n) => a + n, 0);
  function recipeState(w) {
    if (!w.words) return { ready: false, reason: `小${'一二三四五六'[w.grade - 1]}題庫開放後可以製作` };
    if (w.grade > reachedGrade()) return { ready: false, reason: `打倒小${'一二三四五六'[w.grade - 2]}的魔王後開放` };
    const need = {};
    w.words.join('').split('').forEach((c) => { need[c] = (need[c] || 0) + 1; });
    const miss = Object.keys(need).filter((c) => (S.letters[c] || 0) < need[c]);
    const goldOk = S.gold >= w.gold;
    return { ready: !miss.length && goldOk, miss, goldOk, need };
  }
  function wordCh(word) {
    for (const g of GR) for (const st of g.stages) for (const w of st.words) if (w[0] === word) return w[1];
    return word;
  }

  function renderForge() {
    const page = $('#forge-page');
    const letters = Object.keys(S.letters).filter((c) => S.letters[c] > 0).sort();
    const c = CH[forgeChar], list = WP[c.weapon];
    page.innerHTML = `<div class="forge-top win">
        <img class="furnace" id="furnace" src="assets/hero/p-furnace.webp" alt="鐵爐">
        <div class="inv"><h3>🔥 鍛造屋</h3>
          <p class="note">打倒怪物開寶箱收集字母，拼出配方上的單字，丟進鐵爐就能打造武器！</p>
          <div class="letters">${letters.length ? letters.map((ch) => `<span>${ch}<small>×${S.letters[ch]}</small></span>`).join('') : '<span class="empty">還沒有字母，先去冒險開寶箱吧！</span>'}</div>
          <div class="note">字母共 ${letterCount()} 個・<img src="assets/hero/p-gold.webp" alt="" style="width:16px;vertical-align:middle"> 金字母 ${S.gold} 個（魔王金寶箱才會掉）</div>
        </div></div>
      <div class="tabs">${Object.keys(CH).map((id) => `<button class="tab ${id === forgeChar ? 'on' : ''} ${S.unlocked.includes(id) ? '' : 'locked'}" data-c="${id}"><img src="${imgOf(id)}" alt="">${CH[id].name}${S.unlocked.includes(id) ? '' : ' 🔒'}</button>`).join('')}</div>
      <div id="forge-area"></div>`;
    page.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { forgeChar = b.dataset.c; forging = null; renderForge(); });
    forging ? renderForgePanel() : renderWeaponList();
  }

  function renderWeaponList() {
    const c = CH[forgeChar], list = WP[c.weapon], have = S.unlocked.includes(forgeChar);
    const area = $('#forge-area');
    area.innerHTML = `<div class="wlist">${list.map((w, i) => {
      const owned = S.owned[c.weapon].includes(i), eq = S.equip[forgeChar] === i, st = recipeState(w);
      const stat = `攻擊 +${w.atk}${w.def ? `・減傷 ${w.def}%` : ''}`;
      let recipe = '';
      if (w.words) {
        const pool = Object.assign({}, S.letters);
        recipe = w.words.map((word) => {
          const ok = word.split('').every((ch) => { if ((pool[ch] || 0) > 0) { pool[ch]--; return true; } return false; });
          return `<span class="${ok ? 'ok' : 'no'}">${esc(wordCh(word))}（${word.length} 個字母）</span>`;
        }).join('') + (w.gold ? `<span class="gold">★ 金字母 ×${w.gold}</span>` : '');
      } else recipe = `<span class="no">${st.reason}</span>`;
      let act = '';
      if (owned) act = eq ? `<button class="btn" data-unequip="${i}">裝備中（卸下）</button>` : `<button class="btn blue" data-equip="${i}" ${have ? '' : 'disabled'}>裝備</button>`;
      else if (st.ready && have) act = `<button class="btn fire" data-forge="${i}">🔥 鍛造</button>`;
      else if (!have) act = '<span class="note">解鎖角色後可以鍛造</span>';
      else if (w.words && st.reason) act = `<span class="note">${st.reason}</span>`;
      else if (w.words) act = `<span class="note">${st.miss && st.miss.length ? '還缺字母：' + st.miss.join(' ') : ''}${!st.goldOk ? '・金字母不夠' : ''}</span>`;
      return `<div class="wcard win ${owned ? 'owned' : ''} ${eq ? 'equipped' : ''} ${owned || st.ready ? '' : 'locked'}">
        <img src="${D.weaponImg(c.weapon, i)}" alt=""><div class="body">
        <div class="title">${i + 1}. ${esc(w.name)}<small>${stat}</small></div>
        <div class="recipe">${owned ? '<span class="ok">✅ 已打造</span>' : recipe}</div><div>${act}</div></div></div>`;
    }).join('')}</div>`;
    area.querySelectorAll('[data-forge]').forEach((b) => b.onclick = () => { forging = { idx: +b.dataset.forge, step: 0, typed: [] }; renderForgePanel(); });
    area.querySelectorAll('[data-equip]').forEach((b) => b.onclick = () => { S.equip[forgeChar] = +b.dataset.equip; persist(); beep(660, 'triangle', 0.1); renderForge(); });
    area.querySelectorAll('[data-unequip]').forEach((b) => b.onclick = () => { delete S.equip[forgeChar]; persist(); renderForge(); });
  }

  // 拼字鍛造：一個字一個字拼，拼對了才能丟進鐵爐
  function renderForgePanel() {
    const c = CH[forgeChar], w = WP[c.weapon][forging.idx], words = w.words;
    const area = $('#forge-area');
    const done = forging.step >= words.length;
    // 已拼好的字先扣掉，剩下的字母才能用
    const pool = Object.assign({}, S.letters);
    words.slice(0, forging.step).join('').split('').forEach((ch) => pool[ch]--);
    forging.typed.forEach((ch) => pool[ch]--);
    const word = words[forging.step] || '';
    area.innerHTML = `<div class="win" style="padding:12px;display:flex;flex-direction:column;gap:8px;text-align:center">
      <div class="row"><b style="color:var(--gold)">鍛造：${esc(w.name)}</b><button class="small-btn" id="f-cancel">✖ 取消</button></div>
      <img src="${D.weaponImg(c.weapon, forging.idx)}" alt="" style="width:90px;height:90px;object-fit:contain;margin:0 auto;filter:brightness(${done ? 1 : 0.35})">
      <div class="note">${words.map((x, i) => `${i < forging.step ? '✅' : i === forging.step ? '👉' : '⬜'} ${esc(wordCh(x))}`).join('　')}${w.gold ? `　★ 金字母 ×${w.gold}` : ''}</div>
      ${done ? `<p>全部拼對了！把字母丟進鐵爐吧！</p><button class="btn fire" id="f-throw">🔥 丟進鐵爐</button>`
        : `<div class="msg">拼出「<b>${esc(wordCh(word))}</b>」（${word.length} 個字母）</div>
        <div class="slots" id="f-slots">${word.split('').map((_, i) => `<span class="slot ${i < forging.typed.length ? 'filled' : ''} ${i === forging.typed.length ? 'active' : ''}">${forging.typed[i] || ''}</span>`).join('')}</div>
        <div class="keys">${Object.keys(pool).filter((ch) => S.letters[ch] > 0).sort().map((ch) => `<button class="key" data-l="${ch}" ${pool[ch] > 0 ? '' : 'disabled'}>${ch}<small>${pool[ch]}</small></button>`).join('')}</div>
        <div class="row"><button class="small-btn" id="f-back">⌫ 退一格</button><button class="small-btn" id="f-say">🔊 聽發音</button></div>`}
    </div>`;
    $('#f-cancel').onclick = () => { forging = null; renderForge(); };
    if (done) { $('#f-throw').onclick = throwIntoFurnace; return; }
    $('#f-say').onclick = () => speak(word);
    $('#f-back').onclick = () => { forging.typed.pop(); renderForgePanel(); };
    area.querySelectorAll('[data-l]').forEach((k) => k.onclick = () => {
      forging.typed.push(k.dataset.l);
      beep(500, 'sine', 0.06);
      if (forging.typed.length < word.length) return renderForgePanel();
      if (forging.typed.join('') === word) { forging.step++; forging.typed = []; speak(word); beep(784, 'triangle', 0.2); renderForgePanel(); }
      else {
        renderForgePanel();
        const s = $('#f-slots'); s.classList.add('bad');
        beep(150, 'sawtooth', 0.2, 0.15);
        setTimeout(() => { forging.typed = []; renderForgePanel(); }, 600);
      }
    });
  }

  async function throwIntoFurnace() {
    const c = CH[forgeChar], idx = forging.idx, w = WP[c.weapon][idx];
    const btn = $('#f-throw'), furnace = $('#furnace');
    btn.disabled = true;
    // 字母方塊飛進鐵爐
    const from = btn.getBoundingClientRect(), to = furnace.getBoundingClientRect();
    const letters = w.words.join('').split('');
    letters.forEach((ch, i) => {
      const t = document.createElement('div');
      t.className = 'key'; t.innerText = ch;
      t.style.cssText = `position:fixed;z-index:50;left:${from.left + from.width / 2}px;top:${from.top}px;display:grid;place-items:center`;
      document.body.appendChild(t);
      t.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top + to.height * 0.6 - from.top}px) scale(.3) rotate(360deg)`, opacity: 0.2 }],
      { duration: 600, delay: i * 70, easing: 'ease-in', fill: 'forwards' }).finished.then(() => t.remove(), () => t.remove());
    });
    letters.forEach((ch) => { S.letters[ch]--; if (!S.letters[ch]) delete S.letters[ch]; });
    S.gold -= w.gold;
    beep(240, 'sawtooth', 0.5, 0.2);
    await sleep(500 + letters.length * 70);
    furnace.src = 'assets/hero/p-furnace-fire.webp';
    furnace.classList.add('hot');
    beep(120, 'sawtooth', 0.6, 0.2);
    await sleep(1300);
    if (!S.owned[c.weapon].includes(idx)) S.owned[c.weapon].push(idx);
    const cur = weaponOf(forgeChar);
    if (!cur || w.atk > cur.atk) S.equip[forgeChar] = idx;
    S.forged++;
    const fresh = addPoint();
    persist();
    forging = null;
    let html = `<h2>⚒️ 鍛造成功！</h2><img class="pop-img" src="${D.weaponImg(c.weapon, idx)}" alt="">
      <div style="font-size:1.2rem;font-weight:900;color:var(--gold)">${esc(w.name)}</div>
      <p class="note">攻擊 +${w.atk}${w.def ? `・減傷 ${w.def}%` : ''}${S.equip[forgeChar] === idx ? `・已裝備給 ${c.name}` : ''}<br>解鎖點數 +1（目前 ${S.points}）</p>`;
    fresh.forEach((id) => { html += `<p style="color:#7fe3ff;font-weight:900">🎊 新夥伴 ${CH[id].name} 加入了！</p>`; });
    showModal(html + '<button class="btn" id="m-ok" style="margin-top:10px">太棒了！</button>');
    $('#m-ok').onclick = () => { closeModal(); renderForge(); };
  }

  /* ========================================================
     夥伴：解鎖進度、成長外觀、上場角色
     ======================================================== */
  function renderBar() {
    const page = $('#bar-page');
    page.innerHTML = `<h3>🍺 夥伴</h3>
      <p class="note">⭐ 解鎖點數 <b style="color:var(--gold)">${S.points}</b>：${D.UNLOCK_NOTE}（答錯後再答對不算）。一次最多 3 位上場：單字、文法、句型填空各一位。</p>
      <div class="cards">${Object.keys(CH).map((id) => {
        const c = CH[id], have = S.unlocked.includes(id), st = S.chars[id] || { lv: 1, exp: 0 };
        const w = weaponOf(id);
        const prog = have ? `<div class="note">Lv.${st.lv}・HP ${statHp(id)}・攻擊 ${statAtk(id)}${c.guard ? `・減傷 ${defPct(id)}%` : ''}${w ? `・${esc(w.name)}` : ''}</div>
          <div class="prog"><i style="width:${(st.exp / expNeed(st.lv)) * 100}%"></i></div>`
          : `<div class="note">解鎖：⭐ ${Math.min(S.points, c.unlock)} / ${c.unlock}</div><div class="prog"><i style="width:${Math.min(1, S.points / c.unlock) * 100}%"></i></div>`;
        const pickBtn = have && c.type === 'cloze' && S.unlocked.includes('shield') && S.unlocked.includes('angel')
          ? (partyIds().includes(id) ? '<span class="note">✅ 填空位置上場中</span>' : `<button class="btn blue" data-pick="${id}">換上場</button>`) : '';
        return `<div class="ccard win ${have ? '' : 'locked'}"><img src="${imgOf(id)}" alt=""><div class="body">
          <div class="title">${c.name}<span class="type ${c.type}">${TYPE_NAME[c.type]}</span>${have && partyIds().includes(id) ? ' ⚔️' : ''}</div>
          <div class="note">${esc(c.desc)}</div>${prog}
          <div class="growth">${c.tiers.map((lv, t) => `<figure class="${have && st.lv >= lv ? '' : 'lock'}"><img src="${c.img(t + 1)}" alt=""><figcaption>Lv.${lv}</figcaption></figure>`).join('')}</div>
          ${pickBtn}</div></div>`;
      }).join('')}</div>`;
    page.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => { S.clozePick = b.dataset.pick; persist(); B = null; renderBar(); });
  }

  /* ========================================================
     導覽、彈窗、年級
     ======================================================== */
  function showModal(html) { $('#modal-box').innerHTML = html; $('#modal').style.display = 'flex'; }
  function closeModal() { $('#modal').style.display = 'none'; }

  function show(scene) {
    ['battle', 'forge', 'bar'].forEach((s) => { $(`#scene-${s}`).hidden = s !== scene; $(`#nav-${s}`).classList.toggle('active', s === scene); });
    if (scene === 'forge') renderForge();
    if (scene === 'bar') renderBar();
    if (scene === 'battle') {
      // 隊伍或裝備變了：重新開這一關
      const ids = partyIds().join();
      if (!B) startStage(nextStageIdx());
      else if (!B.over && B.party.map((p) => p.id).join() !== ids) startStage(B.si);
      else renderParty();
    }
  }
  $('#nav-battle').onclick = () => show('battle');
  $('#nav-forge').onclick = () => show('forge');
  $('#nav-bar').onclick = () => show('bar');
  $('#chip-points').onclick = () => show('bar');
  $('#chip-sound').onclick = () => {
    soundOn = !soundOn;
    try { localStorage.setItem('word_hero_sound', soundOn ? 'on' : 'off'); } catch (e) {}
    if (!soundOn && 'speechSynthesis' in window) speechSynthesis.cancel();
    $('#chip-sound').innerText = soundOn ? '🔊' : '🔇';
  };

  function nextStageIdx() {
    const g = G(), i = g.stages.findIndex((_, k) => !S.cleared[stageKey(S.grade, k)]);
    return i >= 0 ? i : 0;
  }
  function setupGrades() {
    const reach = reachedGrade();
    $('#grade').innerHTML = GR.map((g, i) => {
      const ok = g.stages.length && g.grade <= reach;
      return `<option value="${g.grade}" ${g.grade === S.grade ? 'selected' : ''} ${ok ? '' : 'disabled'}>${g.name}${g.stages.length ? (ok ? '' : '（打倒前一年級魔王）') : '（第二階段）'}</option>`;
    }).join('');
  }
  $('#grade').onchange = (e) => { S.grade = +e.target.value; persist(); show('battle'); startStage(nextStageIdx()); };
  $('#chip-stage').onclick = () => {
    const g = G();
    showModal(`<h2>🗺️ ${esc(g.name)}</h2><div class="stage-list">${g.stages.map((st, i) => `<button class="cmd" data-st="${i}">${S.grade}-${i + 1} ${esc(st.name)}${i === g.stages.length - 1 ? ' 👑' : ''}<small>${S.cleared[stageKey(S.grade, i)] ? '✅ 已過關' : '⚔️ 挑戰'}</small></button>`).join('')}</div>
      <button class="btn" id="m-close" style="margin-top:12px">關閉</button>`);
    $('#m-close').onclick = closeModal;
    document.querySelectorAll('[data-st]').forEach((b) => b.onclick = () => { closeModal(); show('battle'); startStage(+b.dataset.st); });
  };

  window.addEventListener('keydown', (e) => {
    if (!B || B.busy || B.over || $('#scene-battle').hidden || $('#modal').style.display === 'flex') return;
    if (B.mode === 'spell') {
      const k = e.key.toLowerCase();
      if (k.length === 1 && k >= 'a' && k <= 'z') {
        const free = [...con.querySelectorAll('.key:not(.used)')];
        const btn = free.find((x) => x.innerText === k && k === B.q.word[B.q.pos]) || free.find((x) => x.innerText === k);
        if (btn) btn.click();
      }
    } else if (B.mode === 'talk' || B.mode === 'cloze') {
      const i = '123'.indexOf(e.key) >= 0 ? '123'.indexOf(e.key) : 'abc'.indexOf(e.key.toLowerCase());
      const b = con.querySelectorAll('.opt')[i];
      if (e.key.length === 1 && b) b.click();
    }
  });

  /* ---------- 啟動 ---------- */
  load();
  if (!GR[S.grade - 1] || !GR[S.grade - 1].stages.length) S.grade = 1;
  S.unlocked.forEach((id) => { if (!S.chars[id]) S.chars[id] = { lv: 1, exp: 0 }; });
  $('#points').innerText = S.points;
  $('#chip-sound').innerText = soundOn ? '🔊' : '🔇';
  setupGrades();
  persist();
  startStage(nextStageIdx());

  window.__hero = { get S() { return S; }, get B() { return B; }, addPoint, startStage, show }; // 測試用
})();
