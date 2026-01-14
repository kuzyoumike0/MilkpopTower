// levelup.js — ステージ勝利EXP + ハンバーガーメニューからレベルアップ(モーダル) v1.0.0
// ✅ 勝利ごとにEXP付与（複数検知：WB.emit / windowイベント / DOM）
// ✅ EXP消費で「bunny種別ごとのレベル」UP → 強さ倍率UP
// ✅ localStorage永続化
// ✅ gameMenu.js（ハンバーガー）へ「レベルアップ」ボタンを自動追加（無ければ単独UIでも動く）

(() => {
  "use strict";
  if (window.__MILKPOP_LEVELUP_V1__) return;
  window.__MILKPOP_LEVELUP_V1__ = true;

  const LS_KEY = "milkpop_levelup_v1";

  // ===== 調整ポイント =====
  const CFG = {
    // 勝利1回のEXP（必要ならステージ番号で増やすのも可）
    expPerWin: 10,

    // 各レベルの最大
    maxLevel: 50,

    // レベルアップ必要EXP（例：基礎 + 伸び）
    // cost(level+1) を返す
    costFn: (nextLevel) => Math.floor(20 + nextLevel * 8),

    // 強さ倍率（例：レベル1ごとに +6%）
    // mul(level) を返す（lv0=1.00）
    powerMulFn: (level) => 1 + level * 0.06,

    // 影響させたいパラメータ名（あなたのゲーム側で参照する用途）
    // WB.getBunnyPowerMul(type) を使う想定
    affects: ["atk", "hp"],

    // bunny種別の候補（あなたのゲームの命名に合わせて増減OK）
    bunnyTypes: ["bunny", "bunny2", "bunny3", "bunny4", "bunny5", "reabunny"],

    // モーダルUI文言
    title: "レベルアップ",
  };

  const $ = (q, p = document) => p.querySelector(q);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ===== Save/Load =====
  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return null;
      return s;
    } catch {
      return null;
    }
  }

  function defaultState() {
    const levels = {};
    for (const t of CFG.bunnyTypes) levels[t] = 0;
    return {
      ver: 1,
      exp: 0,
      levels,
      totalWins: 0,
      lastWinAt: 0,
    };
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(ST));
    } catch {}
  }

  let ST = loadState() || defaultState();
  // 足りない種別が追加された時の補完
  for (const t of CFG.bunnyTypes) {
    if (typeof ST.levels?.[t] !== "number") {
      ST.levels[t] = 0;
    }
  }
  if (typeof ST.exp !== "number") ST.exp = 0;
  if (typeof ST.totalWins !== "number") ST.totalWins = 0;
  if (typeof ST.lastWinAt !== "number") ST.lastWinAt = 0;
  saveState();

  // ===== Core API =====
  function getLevel(type) {
    return clamp(ST.levels[type] ?? 0, 0, CFG.maxLevel);
  }

  function getMul(type) {
    const lv = getLevel(type);
    return CFG.powerMulFn(lv);
  }

  function getNextCost(type) {
    const lv = getLevel(type);
    if (lv >= CFG.maxLevel) return Infinity;
    return CFG.costFn(lv + 1);
  }

  function canLevelUp(type) {
    const cost = getNextCost(type);
    return Number.isFinite(cost) && ST.exp >= cost;
  }

  function tryLevelUp(type, times = 1) {
    times = clamp(times | 0, 1, 999);
    let did = 0;

    for (let i = 0; i < times; i++) {
      const lv = getLevel(type);
      if (lv >= CFG.maxLevel) break;
      const cost = getNextCost(type);
      if (!Number.isFinite(cost) || ST.exp < cost) break;

      ST.exp -= cost;
      ST.levels[type] = lv + 1;
      did++;
    }
    if (did) saveState();
    return did;
  }

  function addExp(amount, reason = "") {
    amount = Math.max(0, Math.floor(amount || 0));
    if (!amount) return;
    ST.exp += amount;
    saveState();
    toast(`EXP +${amount}${reason ? `（${reason}）` : ""}`);
    rerenderModal();
  }

  // ===== “勝利”検知（複数ルートで保険） =====
  const WIN_DEDUP_MS = 1200;
  function grantWinExp(source = "win") {
    const now = Date.now();
    if (now - ST.lastWinAt < WIN_DEDUP_MS) return; // 二重付与防止
    ST.lastWinAt = now;
    ST.totalWins += 1;
    saveState();

    // ステージ番号が取れるなら増やす（例）
    // const stage = window.WB?.stage || window.__stageIndex || 1;
    // const exp = CFG.expPerWin + Math.floor(stage * 2);
    const exp = CFG.expPerWin;

    addExp(exp, "勝利");
    console.log("[levelup] grant exp:", exp, "source:", source);
  }

  // A) windowイベント（自作でも投げられる）
  window.addEventListener("milkpop:win", () => grantWinExp("windowEvent"));

  // B) よくあるイベント名にも反応（保険）
  window.addEventListener("victory", () => grantWinExp("victory"));
  window.addEventListener("gameWin", () => grantWinExp("gameWin"));

  // C) WB.emit をフック（WBがあるなら一番確実）
  function hookWBEmit() {
    const WB = window.WB;
    if (!WB || typeof WB.emit !== "function") return false;
    if (WB.__levelupEmitHooked) return true;
    WB.__levelupEmitHooked = true;

    const origEmit = WB.emit.bind(WB);
    WB.emit = function (name, payload) {
      try {
        // あなたのゲーム側が勝利時に emit しているイベント名に合わせて増やせる
        if (
          name === "win" ||
          name === "victory" ||
          name === "stageWin" ||
          name === "game:win" ||
          name === "battleWin"
        ) {
          grantWinExp(`WB.emit:${name}`);
        }
      } catch {}
      return origEmit(name, payload);
    };

    return true;
  }

  // D) DOMで victory.png 表示を検知（最終保険）
  function hookVictoryImageObserver() {
    const obs = new MutationObserver(() => {
      // 画面中央に victory.png を出している前提のゆる検知
      const imgs = Array.from(document.images || []);
      const hit = imgs.find((im) => (im.src || "").includes("victory.png"));
      if (!hit) return;
      // 表示されてるっぽい時だけ
      const r = hit.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) grantWinExp("DOM:victory.png");
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
  }

  // WB待機
  (function waitWB() {
    const start = Date.now();
    const t = setInterval(() => {
      hookWBEmit();
      if (window.WB && window.WB.__levelupEmitHooked) {
        clearInterval(t);
      }
      if (Date.now() - start > 10000) {
        clearInterval(t);
      }
    }, 100);
  })();

  hookVictoryImageObserver();

  // ===== UI（モーダル） =====
  const UI = {
    styleId: "milkpopLevelUpStyleV1",
    modalId: "milkpopLevelUpModalV1",
    toastWrapId: "milkpopLevelUpToastWrapV1",
  };

  function ensureStyle() {
    if (document.getElementById(UI.styleId)) return;
    const s = document.createElement("style");
    s.id = UI.styleId;
    s.textContent = `
#${UI.modalId}{
  position:fixed; inset:0;
  z-index:2147483600;
  display:none;
}
#${UI.modalId}.open{ display:block; }
#${UI.modalId} .bg{
  position:absolute; inset:0;
  background:rgba(0,0,0,.45);
}
#${UI.modalId} .panel{
  position:absolute;
  left:50%; top:50%;
  transform:translate(-50%,-50%);
  width:min(560px, calc(100vw - 22px));
  max-height:min(78vh, 720px);
  overflow:auto;
  background:#fff;
  border-radius:18px;
  box-shadow:0 18px 50px rgba(0,0,0,.35);
  padding:14px;
}
#${UI.modalId} .head{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
  padding:6px 4px 10px;
  border-bottom:1px solid rgba(0,0,0,.08);
}
#${UI.modalId} .head h2{
  margin:0;
  font-size:18px;
}
#${UI.modalId} .x{
  border:none; background:#f3f3f3;
  border-radius:12px;
  padding:8px 10px;
  cursor:pointer;
  font-weight:900;
}
#${UI.modalId} .summary{
  display:flex; flex-wrap:wrap;
  gap:8px;
  padding:12px 4px 8px;
  align-items:center;
}
#${UI.modalId} .pill{
  background:#fff3f8;
  border:1px solid rgba(0,0,0,.08);
  border-radius:999px;
  padding:6px 10px;
  font-weight:900;
}
#${UI.modalId} .list{
  display:flex;
  flex-direction:column;
  gap:10px;
  padding:6px 2px 2px;
}
#${UI.modalId} .row{
  border:1px solid rgba(0,0,0,.10);
  border-radius:16px;
  padding:10px;
  display:flex;
  flex-direction:column;
  gap:8px;
}
#${UI.modalId} .rowTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
#${UI.modalId} .name{
  font-weight:1000;
}
#${UI.modalId} .meta{
  font-weight:900;
  opacity:.85;
}
#${UI.modalId} .actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
#${UI.modalId} button.btn{
  border:none;
  border-radius:14px;
  padding:9px 12px;
  cursor:pointer;
  font-weight:1000;
  background:#fff;
  box-shadow:0 4px 14px rgba(0,0,0,.12);
}
#${UI.modalId} button.btn.primary{
  background:#ffe2ef;
}
#${UI.modalId} button.btn:disabled{
  opacity:.45;
  cursor:not-allowed;
  box-shadow:none;
}
#${UI.toastWrapId}{
  position:fixed;
  left:50%;
  bottom:14px;
  transform:translateX(-50%);
  z-index:2147483650;
  display:flex;
  flex-direction:column;
  gap:8px;
  pointer-events:none;
}
#${UI.toastWrapId} .t{
  pointer-events:none;
  background:rgba(0,0,0,.78);
  color:#fff;
  padding:10px 12px;
  border-radius:14px;
  font-weight:900;
  box-shadow:0 10px 26px rgba(0,0,0,.25);
}
    `.trim();
    document.head.appendChild(s);
  }

  function ensureToastWrap() {
    let w = document.getElementById(UI.toastWrapId);
    if (w) return w;
    w = document.createElement("div");
    w.id = UI.toastWrapId;
    document.body.appendChild(w);
    return w;
  }

  function toast(msg) {
    ensureStyle();
    const wrap = ensureToastWrap();
    const el = document.createElement("div");
    el.className = "t";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 280);
    }, 1100);
  }

  function ensureModal() {
    ensureStyle();
    let root = document.getElementById(UI.modalId);
    if (root) return root;

    root = document.createElement("div");
    root.id = UI.modalId;
    root.innerHTML = `
      <div class="bg" data-close="1"></div>
      <div class="panel" role="dialog" aria-modal="true">
        <div class="head">
          <h2>${CFG.title}</h2>
          <button class="x" data-close="1">✕</button>
        </div>
        <div class="summary">
          <div class="pill" id="${UI.modalId}_exp"></div>
          <div class="pill" id="${UI.modalId}_wins"></div>
          <div class="pill" id="${UI.modalId}_hint"></div>
        </div>
        <div class="list" id="${UI.modalId}_list"></div>
      </div>
    `.trim();

    root.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
    });

    document.body.appendChild(root);
    return root;
  }

  function openModal() {
    const m = ensureModal();
    m.classList.add("open");
    renderModal();
  }

  function closeModal() {
    const m = document.getElementById(UI.modalId);
    if (m) m.classList.remove("open");
  }

  function renderModal() {
    const expEl = $(`#${UI.modalId}_exp`);
    const winsEl = $(`#${UI.modalId}_wins`);
    const hintEl = $(`#${UI.modalId}_hint`);
    const listEl = $(`#${UI.modalId}_list`);

    if (!expEl || !winsEl || !hintEl || !listEl) return;

    expEl.textContent = `EXP: ${ST.exp}`;
    winsEl.textContent = `勝利: ${ST.totalWins}回`;
    hintEl.textContent = `倍率はゲーム側で WB.getBunnyPowerMul(type) を参照`;

    listEl.innerHTML = "";

    for (const type of CFG.bunnyTypes) {
      const lv = getLevel(type);
      const mul = getMul(type);
      const cost = getNextCost(type);
      const maxed = lv >= CFG.maxLevel;

      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="rowTop">
          <div class="name">${escapeHtml(type)}</div>
          <div class="meta">Lv ${lv} / x${mul.toFixed(2)} ${maxed ? "（MAX）" : ""}</div>
        </div>
        <div class="actions">
          <button class="btn primary" data-up="1" data-type="${escapeHtml(type)}" ${canLevelUp(type) ? "" : "disabled"}>
            レベルアップ ${maxed ? "" : `(EXP ${cost})`}
          </button>
          <button class="btn" data-up="10" data-type="${escapeHtml(type)}" ${ST.exp >= cost && !maxed ? "" : "disabled"}>
            まとめて+10
          </button>
        </div>
      `.trim();

      row.addEventListener("click", (e) => {
        const b = e.target?.closest?.("button");
        if (!b) return;
        const t = b.getAttribute("data-type");
        const up = parseInt(b.getAttribute("data-up") || "0", 10);
        if (!t || !up) return;

        const did = tryLevelUp(t, up === 10 ? 10 : 1);
        if (!did) {
          toast("EXPが足りない / すでにMAX");
        } else {
          toast(`${t} Lv +${did}`);
        }
        renderModal();

        // ゲーム側へ通知（必要ならあなたのロジックで拾える）
        window.dispatchEvent(new CustomEvent("milkpop:levelup", { detail: { type: t, add: did, level: getLevel(t) } }));
        if (window.WB && typeof window.WB.emit === "function") {
          try { window.WB.emit("levelup", { type: t, add: did, level: getLevel(t) }); } catch {}
        }
      });

      listEl.appendChild(row);
    }
  }

  function rerenderModal() {
    const m = document.getElementById(UI.modalId);
    if (m && m.classList.contains("open")) renderModal();
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== gameMenu.js（ハンバーガー）にボタンを追加 =====
  function tryInjectIntoGameMenu() {
    // gameMenu.js が panel を作ってる想定：#gameMenuPanelV1 など
    // ただしIDが違うかもしれないので “それっぽい” パネルを探す
    const candidates = [
      "#gameMenuPanelV1",
      "#gameMenuPanelV2",
      "#gameMenuPanel",
    ];

    let panel = null;
    for (const q of candidates) {
      panel = $(q);
      if (panel) break;
    }
    // 見つからない場合は、WB.gameMenu.openModal 等にぶら下げるだけ
    if (!panel) return false;

    // 既に追加済みなら何もしない
    if (panel.querySelector("[data-levelup-btn='1']")) return true;

    const btn = document.createElement("button");
    btn.textContent = "⬆ レベルアップ";
    btn.setAttribute("data-levelup-btn", "1");

    // 既存のメニューと見た目を合わせる（可能なら）
    btn.style.width = "100%";
    btn.style.marginTop = "8px";
    btn.style.padding = "10px 12px";
    btn.style.border = "none";
    btn.style.borderRadius = "14px";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "900";
    btn.style.background = "#ffe2ef";
    btn.style.boxShadow = "0 4px 14px rgba(0,0,0,.12)";

    btn.addEventListener("click", () => {
      openModal();
    });

    panel.appendChild(btn);
    return true;
  }

  // ===== 公開API（ゲーム側で使う） =====
  const api = {
    addExp, // 手動付与にも使える
    grantWinExp: () => grantWinExp("manual"),
    openModal,
    closeModal,
    getExp: () => ST.exp,
    getLevel,
    getMul,
    getNextCost,
    canLevelUp,
    tryLevelUp,
    cfg: CFG,
  };

  window.MilkpopLevelUp = api;

  // WBに生やす（ゲーム側が参照しやすいように）
  // 例：攻撃計算で WB.getBunnyPowerMul(type) を掛ける
  function attachToWB() {
    const WB = window.WB;
    if (!WB) return false;

    if (typeof WB.getBunnyPowerMul !== "function") {
      WB.getBunnyPowerMul = (type) => getMul(type);
    }
    if (!WB.levelup) WB.levelup = {};
    WB.levelup.openModal = openModal;
    WB.levelup.addExp = addExp;
    WB.levelup.getMul = (type) => getMul(type);
    WB.levelup.getLevel = (type) => getLevel(type);

    return true;
  }

  (function boot() {
    ensureStyle();
    ensureToastWrap();

    const start = Date.now();
    const t = setInterval(() => {
      attachToWB();
      tryInjectIntoGameMenu();
      if (Date.now() - start > 12000) clearInterval(t);
    }, 150);

    // モーダルを単独で開けるホットキー（デバッグ用）：Shift+L
    window.addEventListener("keydown", (e) => {
      if (e.shiftKey && (e.key === "L" || e.key === "l")) openModal();
    });
  })();
})();
