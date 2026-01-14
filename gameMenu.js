// gameMenu.js（非module）— 右上ハンバーガー + パネル + レベルアップ導線 v1.0.0
// ✅ 右上ハンバーガー（44px）
// ✅ パネル開閉（背景クリックで閉じる）
// ✅ 「レベルアップ」ボタン → window.MilkpopLevelUp.openModal() を呼ぶ
// ✅ 「ステージ選択」ボタン → window.flow.openStageSelect() or window.StageFlow.openStageSelect() があれば呼ぶ（保険）
// ✅ 「BGM/SEスライダー」は main.js 側がHUDに出してる想定（ここでは触らない）
//
// 使い方：index.html で levelup.js の後、main.js(module) の前に読み込む

(() => {
  "use strict";
  if (window.__MILKPOP_GAMEMENU_V1__) return;
  window.__MILKPOP_GAMEMENU_V1__ = true;

  const UI = {
    btn: "gameHamburgerV1",
    panel: "gameMenuPanelV1",
    style: "gameMenuStyleV1",
    openClass: "open",
  };

  const $ = (q, p = document) => p.querySelector(q);

  function ensureStyle() {
    if (document.getElementById(UI.style)) return;
    const s = document.createElement("style");
    s.id = UI.style;
    s.textContent = `
#${UI.btn}{
  position:fixed;
  top:10px; right:10px;
  z-index:2147483600;
  width:44px; height:44px;
  border:none;
  border-radius:14px;
  background:rgba(255,255,255,.92);
  box-shadow:0 10px 24px rgba(0,0,0,.18);
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  -webkit-tap-highlight-color: transparent;
}
#${UI.btn}:active{ transform: translateY(1px); }

#${UI.btn} .bars{
  width:18px; height:14px;
  position:relative;
}
#${UI.btn} .bars span{
  position:absolute; left:0;
  width:100%; height:3px;
  border-radius:999px;
  background:#5b3550;
  transition:transform .18s ease, top .18s ease, opacity .18s ease;
}
#${UI.btn} .bars span:nth-child(1){ top:0; }
#${UI.btn} .bars span:nth-child(2){ top:5.5px; }
#${UI.btn} .bars span:nth-child(3){ top:11px; }

#${UI.panel}{
  position:fixed; inset:0;
  z-index:2147483590;
  display:none;
}
#${UI.panel}.${UI.openClass}{ display:block; }

#${UI.panel} .bg{
  position:absolute; inset:0;
  background:rgba(0,0,0,.42);
}
#${UI.panel} .sheet{
  position:absolute;
  top:10px; right:10px;
  width:min(320px, calc(100vw - 20px));
  max-height: min(74vh, 700px);
  overflow:auto;
  background:rgba(255,255,255,.96);
  border:1px solid rgba(255,160,200,.35);
  border-radius:18px;
  box-shadow:0 18px 50px rgba(0,0,0,.32);
  padding:12px;
  backdrop-filter: blur(6px);
}
#${UI.panel} .title{
  display:flex; align-items:center; justify-content:space-between;
  gap:8px;
  padding:6px 4px 10px;
  border-bottom:1px solid rgba(0,0,0,.08);
}
#${UI.panel} .title b{
  font-size:14px;
  color:#5b3550;
}
#${UI.panel} .close{
  border:none;
  border-radius:12px;
  padding:8px 10px;
  cursor:pointer;
  background:#f3f3f3;
  font-weight:1000;
}

#${UI.panel} .group{
  padding:10px 4px 0;
  display:flex;
  flex-direction:column;
  gap:8px;
}
#${UI.panel} button.menuBtn{
  width:100%;
  border:none;
  border-radius:14px;
  padding:10px 12px;
  cursor:pointer;
  font-weight:1000;
  background:#fff;
  box-shadow:0 4px 14px rgba(0,0,0,.12);
  text-align:left;
}
#${UI.panel} button.menuBtn.primary{
  background:#ffe2ef;
}
#${UI.panel} button.menuBtn:active{ transform: translateY(1px); }
#${UI.panel} .hint{
  margin-top:6px;
  font-size:12px;
  font-weight:900;
  opacity:.7;
  color:#5b3550;
  line-height:1.35;
}
    `.trim();
    document.head.appendChild(s);
  }

  function ensureUI() {
    ensureStyle();

    // hamburger
    if (!document.getElementById(UI.btn)) {
      const b = document.createElement("button");
      b.id = UI.btn;
      b.setAttribute("aria-label", "menu");
      b.innerHTML = `
        <div class="bars" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      `.trim();
      document.body.appendChild(b);
      b.addEventListener("click", toggle);
    }

    // panel
    if (!document.getElementById(UI.panel)) {
      const p = document.createElement("div");
      p.id = UI.panel;
      p.innerHTML = `
        <div class="bg" data-close="1"></div>
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="title">
            <b>🍭 Candy Defense</b>
            <button class="close" data-close="1">✕</button>
          </div>
          <div class="group">
            <button class="menuBtn primary" data-act="levelup">⬆ レベルアップ</button>
            <button class="menuBtn" data-act="stageSelect">🗺 ステージ選択</button>
            <button class="menuBtn" data-act="reset">↻ リスタート</button>
          </div>
          <div class="hint">
            ・レベルアップは勝利でもらえるEXPで強化できます<br>
            ・ステージ選択は flow.openStageSelect() があれば開きます
          </div>
        </div>
      `.trim();
      document.body.appendChild(p);

      p.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1") close();
      });

      p.querySelector('[data-act="levelup"]').addEventListener("click", () => {
        close();
        try {
          if (window.MilkpopLevelUp && typeof window.MilkpopLevelUp.openModal === "function") {
            window.MilkpopLevelUp.openModal();
            return;
          }
        } catch {}
        // ない場合はヒント
        alert("levelup.js が読み込まれていません");
      });

      p.querySelector('[data-act="stageSelect"]').addEventListener("click", () => {
        close();
        // stageFlow 側に openStageSelect がある前提（保険で複数候補）
        try {
          if (window.flow && typeof window.flow.openStageSelect === "function") {
            window.flow.openStageSelect();
            return;
          }
        } catch {}
        try {
          if (window.StageFlow && typeof window.StageFlow.openStageSelect === "function") {
            window.StageFlow.openStageSelect();
            return;
          }
        } catch {}
        // ない場合
        alert("ステージ選択UIが見つかりません（stageFlow.js側を確認）");
      });

      p.querySelector('[data-act="reset"]').addEventListener("click", () => {
        close();
        const btn = document.getElementById("btnReset");
        if (btn) btn.click();
      });
    }
  }

  function open() {
    const p = document.getElementById(UI.panel);
    if (!p) return;
    p.classList.add(UI.openClass);
  }

  function close() {
    const p = document.getElementById(UI.panel);
    if (!p) return;
    p.classList.remove(UI.openClass);
  }

  function toggle() {
    const p = document.getElementById(UI.panel);
    if (!p) return;
    p.classList.toggle(UI.openClass);
  }

  // 公開API（任意）
  window.GameMenu = {
    open, close, toggle,
    ids: { btn: UI.btn, panel: UI.panel }
  };

  // boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUI);
  } else {
    ensureUI();
  }
})();
