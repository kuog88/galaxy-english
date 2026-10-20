// 圖片載入＋快取。
// 每張圖只會載入一次（Promise 存在 Map 裡），死亡回退到舊關卡時直接拿快取，
// 不會重新下載，更不會重新呼叫生成 API（圖是事先用 tools/kling-generate.mjs 生好的）。
// 找不到圖片時回傳 null，由畫面改用內建的卡通替代圖。
(function () {
  'use strict';

  const M = window.RPG_MANIFEST;
  const EXTS = ['webp', 'png', 'jpg'];
  const cache = new Map();

  function tryLoad(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  /** @returns {Promise<string|null>} 圖片網址，沒有圖就是 null */
  function load(id) {
    if (!cache.has(id)) {
      cache.set(id, (async () => {
        for (const ext of EXTS) {
          const url = await tryLoad(`${M.dir}${id}.${ext}`);
          if (url) return url;
        }
        return null;
      })());
    }
    return cache.get(id);
  }

  window.RPG = window.RPG || {};
  window.RPG.assets = { load, cache };
})();
