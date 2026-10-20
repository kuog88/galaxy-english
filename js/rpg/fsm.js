// 有限狀態機：只允許事先列好的轉換，非法轉換會被擋下來並在 console 警告。
// 每次進入新狀態都會換一個 token；非同步動畫結束時用 fsm.alive(token) 檢查
// 「我還是不是目前的狀態」，避免玩家中途離開後舊的 setTimeout 又把畫面切走。
(function () {
  'use strict';

  class FSM {
    /**
     * @param {Object<string, {to: string[], enter?: Function, exit?: Function}>} states
     */
    constructor(states) {
      this.states = states;
      this.current = null;
      this.token = 0;
      this.listeners = [];
    }

    can(next) {
      if (this.current === null) return next in this.states;
      return this.states[this.current].to.includes(next);
    }

    go(next, payload) {
      if (!this.can(next)) {
        console.warn(`[FSM] 不允許的轉換：${this.current} → ${next}`);
        return false;
      }
      const prev = this.current;
      const ps = this.states[prev];
      if (ps && ps.exit) ps.exit(next);
      this.current = next;
      const token = ++this.token;
      this.listeners.forEach((fn) => fn(next, prev));
      const ns = this.states[next];
      if (ns.enter) ns.enter(payload || {}, token);
      return true;
    }

    alive(token) { return token === this.token; }

    onChange(fn) { this.listeners.push(fn); }
  }

  window.RPG = window.RPG || {};
  window.RPG.FSM = FSM;
})();
