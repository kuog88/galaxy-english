// 打擊感（Juice）：全部用 Web Animations API，單張 2D 圖片也能打得很有感覺。
// 1. 位移回彈  2. 受傷閃爍  3. 火花＋傷害飄字  4. 擊敗飛散＋輕煙  5. 鏡頭微震
(function () {
  'use strict';

  const T = {
    knockPx: 26,        // 後退 20～30px
    knockDeg: 8,        // 旋轉 5～10 度
    springMs: 150,      // 0.15 秒彈回
    flashMs: 50,        // 每次閃 0.05 秒，閃 3 次
    shakeMs: 100,       // 鏡頭震 0.1 秒
  };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const done = (anim) => anim.finished.catch(() => {});

  // 彈簧插值（Elastic Out）：從被打飛的位置衰減震盪回到原點
  function elasticFrames(dx, deg) {
    const steps = [1, -0.45, 0.2, -0.08, 0];
    return steps.map((k, i) => ({
      transform: `translateX(${(dx * k).toFixed(1)}px) rotate(${(deg * k).toFixed(1)}deg)`,
      offset: i / (steps.length - 1),
      easing: 'ease-out',
    }));
  }

  /** 1. 物理位移回彈。dir = 1 往右退（怪物）、-1 往左退（主角） */
  function knockback(el, dir = 1, power = 1) {
    return done(el.animate(elasticFrames(T.knockPx * dir * power, T.knockDeg * dir * power),
      { duration: T.springMs, easing: 'linear' }));
  }

  /** 2. 受傷閃爍：變紅 3 次 */
  function flash(el, color = 'red') {
    const hot = color === 'red'
      ? 'brightness(1.1) sepia(1) saturate(8) hue-rotate(-35deg)'
      : 'brightness(2.2) saturate(0)';
    const frames = [];
    for (let i = 0; i < 3; i++) frames.push({ filter: hot }, { filter: 'none' });
    frames.push({ filter: 'none' });
    return done(el.animate(frames, { duration: T.flashMs * 6, easing: 'steps(1, end)' }));
  }

  /** 3a. 斬擊火花（有 ui-hit 圖就疊圖，沒有就用 CSS 星星） */
  function sparks(layer, x, y, hitImg) {
    if (hitImg) {
      const img = document.createElement('img');
      img.src = hitImg;
      img.className = 'fx-hit';
      img.style.left = x + 'px';
      img.style.top = y + 'px';
      layer.appendChild(img);
      img.animate([
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: 'translate(-50%,-50%) scale(1.15) rotate(25deg)', opacity: 1, offset: 0.5 },
        { transform: 'translate(-50%,-50%) scale(1.3) rotate(35deg)', opacity: 0 },
      ], { duration: 320, easing: 'ease-out' }).finished.then(() => img.remove(), () => img.remove());
    }
    const n = reduced ? 4 : 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'fx-spark';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      layer.appendChild(p);
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const r = 40 + Math.random() * 50;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(.2)`, opacity: 0 },
      ], { duration: 380 + Math.random() * 160, easing: 'cubic-bezier(.2,.8,.3,1)' })
        .finished.then(() => p.remove(), () => p.remove());
    }
  }

  /** 3b. 傷害飄字：放大後往上飄、淡出 */
  function floatText(layer, x, y, text, cls = 'dmg') {
    const el = document.createElement('div');
    el.className = 'fx-text ' + cls;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer.appendChild(el);
    return el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-80%) scale(1.5)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-110%) scale(1)', opacity: 1, offset: 0.55 },
      { transform: 'translate(-50%,-190%) scale(.9)', opacity: 0 },
    ], { duration: 900, easing: 'ease-out' }).finished.then(() => el.remove(), () => el.remove());
  }

  /** 4. 擊敗飛散：旋轉、往右上飛、縮小淡出，再冒一團輕煙 */
  async function defeat(el, layer) {
    const box = el.getBoundingClientRect();
    const lb = layer.getBoundingClientRect();
    const cx = box.left - lb.left + box.width / 2;
    const cy = box.top - lb.top + box.height / 2;
    await done(el.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: 'translate(40vw,-60vh) rotate(900deg) scale(.15)', opacity: 0 },
    ], { duration: 650, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }));
    smoke(layer, cx, cy);
  }

  function smoke(layer, x, y) {
    for (let i = 0; i < 7; i++) {
      const s = document.createElement('i');
      s.className = 'fx-smoke';
      s.style.left = x + (Math.random() - 0.5) * 60 + 'px';
      s.style.top = y + (Math.random() - 0.5) * 40 + 'px';
      layer.appendChild(s);
      s.animate([
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.9 },
        { transform: `translate(-50%,-${80 + Math.random() * 40}%) scale(${1.6 + Math.random()})`, opacity: 0 },
      ], { duration: 700 + Math.random() * 300, delay: i * 40, easing: 'ease-out' })
        .finished.then(() => s.remove(), () => s.remove());
    }
  }

  /** 5. 鏡頭微震：整個冒險舞台抖 0.1 秒 */
  function shake(stage, power = 1) {
    if (reduced) return Promise.resolve();
    const a = 6 * power;
    const frames = [0, 1, 2, 3, 4].map(() => ({
      transform: `translate(${(Math.random() - 0.5) * 2 * a}px, ${(Math.random() - 0.5) * 2 * a}px)`,
    }));
    frames.push({ transform: 'translate(0,0)' });
    return done(stage.animate(frames, { duration: T.shakeMs * power, easing: 'linear' }));
  }

  /** 角色衝刺攻擊：往前衝再回來 */
  function lunge(el, dx) {
    return done(el.animate([
      { transform: 'translateX(0) scale(1)' },
      { transform: `translateX(${dx * -0.15}px) scale(.95)`, offset: 0.25 },
      { transform: `translateX(${dx}px) scale(1.08)`, offset: 0.55 },
      { transform: 'translateX(0) scale(1)' },
    ], { duration: 420, easing: 'ease-in-out' }));
  }

  /** 怪物登場：從右邊滑進來 */
  function enter(el) {
    return done(el.animate([
      { transform: 'translateX(70vw) scale(.8)', opacity: 0 },
      { transform: 'translateX(-14px) scale(1.05)', opacity: 1, offset: 0.75 },
      { transform: 'translateX(0) scale(1)', opacity: 1 },
    ], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }));
  }

  window.RPG = window.RPG || {};
  window.RPG.juice = { T, knockback, flash, sparks, floatText, defeat, smoke, shake, lunge, enter };
})();
