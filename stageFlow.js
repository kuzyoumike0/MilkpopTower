// stageFlow.js
// Stage1〜5 管理（mirrorball破壊で勝利→次ステージ）
// + ステージ選択（HUDに「STAGE」ボタンを自動追加）

export function createStageFlow() {
  const STAGES = [
    { id: 1, mirrorHP: 900,  mirrorSpawnSec: 2.10, enemyMulHP: 1.00, enemyMulATK: 1.00 },
    { id: 2, mirrorHP: 1200, mirrorSpawnSec: 1.90, enemyMulHP: 1.12, enemyMulATK: 1.08 },
    { id: 3, mirrorHP: 1600, mirrorSpawnSec: 1.65, enemyMulHP: 1.30, enemyMulATK: 1.14 },
    { id: 4, mirrorHP: 2200, mirrorSpawnSec: 1.40, enemyMulHP: 1.55, enemyMulATK: 1.22 },
    { id: 5, mirrorHP: 3000, mirrorSpawnSec: 1.18, enemyMulHP: 1.85, enemyMulATK: 1.35 },
  ];

  let stageIndex = 0;
  let onSelectCb = null;

  // ---- Base overlay root ----
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999; display:none;
    background:rgba(255, 230, 242, .70);
    backdrop-filter: blur(6px);
    align-items:center; justify-content:center;
    pointer-events:auto;
  `;
  document.body.appendChild(overlay);

  function openOverlay(innerHtml) {
    overlay.innerHTML = innerHtml;
    overlay.style.display = "flex";
  }
  function closeOverlay() {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }

  function cardShell(title, bodyHtml, footerHtml) {
    return `
      <div style="
        width:min(560px, calc(100vw - 28px));
        border-radius:26px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(255,160,200,.35);
        box-shadow:0 20px 60px rgba(0,0,0,.18);
        padding:18px 18px 16px;
        text-align:center;
        color:#5b3550;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      ">
        <div style="font-weight:1000; font-size:26px; margin-top:4px;">${title}</div>
        <div style="margin-top:14px;">${bodyHtml}</div>
        <div style="margin-top:14px;">${footerHtml || ""}</div>
      </div>
    `;
  }

  function current() {
    return STAGES[stageIndex];
  }

  function loadStage(n) {
    const idx = STAGES.findIndex(s => s.id === n);
    stageIndex = idx >= 0 ? idx : 0;
    return current();
  }

  // ---- WIN overlay ----
  function showWin(onNext) {
    const st = current();
    const isLast = stageIndex >= STAGES.length - 1;

    const body = `
      <div style="opacity:.88; font-weight:900;">
        mirrorball を破壊した！
      </div>
      <div style="margin-top:10px; font-weight:1000; opacity:.75;">
        ${isLast ? "全ステージクリア！" : `次は Stage ${STAGES[stageIndex+1].id}`}
      </div>
    `;

    const footer = `
      <button id="sfNext" style="
        border:none; border-radius:18px;
        padding:12px 14px;
        background:linear-gradient(180deg,#ffffff,#ffeaf3);
        border:2px solid rgba(255,160,200,.30);
        box-shadow:0 10px 22px rgba(0,0,0,.10);
        cursor:pointer;
        font-weight:1000;
        color:#5b3550;
        width: 100%;
      ">${isLast ? "最初から" : "次のステージへ"}</button>

      <button id="sfPick" style="
        margin-top:10px;
        border:none; border-radius:18px;
        padding:10px 14px;
        background:rgba(255, 210, 230, .35);
        border:1px solid rgba(255,160,200,.25);
        box-shadow:0 8px 18px rgba(0,0,0,.08);
        cursor:pointer;
        font-weight:1000;
        color:#5b3550;
        width: 100%;
      ">ステージ選択</button>
    `;

    openOverlay(cardShell(`勝利！ Stage ${st.id}`, body, footer));

    overlay.querySelector("#sfNext").onclick = () => {
      closeOverlay();
      stageIndex = isLast ? 0 : stageIndex + 1;
      onNext?.(current());
    };
    overlay.querySelector("#sfPick").onclick = () => {
      showStageSelect();
    };
  }

  // ---- STAGE SELECT overlay ----
  function showStageSelect() {
    const buttons = STAGES.map(s => {
      const active = (s.id === current().id);
      return `
        <button class="sfStageBtn" data-id="${s.id}" style="
          border:none; border-radius:18px;
          padding:12px 10px;
          background:${active ? "linear-gradient(180deg,#ffffff,#ffeaf3)" : "rgba(255,255,255,.92)"};
          border:2px solid rgba(255,160,200,.30);
          box-shadow:0 10px 22px rgba(0,0,0,.10);
          cursor:pointer;
          font-weight:1100;
          color:#5b3550;
          text-align:left;
        ">
          <div style="font-size:14px; font-weight:1000;">Stage ${s.id}</div>
          <div style="font-size:12px; opacity:.78; margin-top:2px;">
            HP ${s.mirrorHP} / enemy ${Math.round(s.enemyMulHP*100)}% / spawn ${s.mirrorSpawnSec.toFixed(2)}s
          </div>
        </button>
      `;
    }).join("");

    const body = `
      <div style="
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:10px;
      ">${buttons}</div>
    `;

    const footer = `
      <button id="sfClose" style="
        border:none; border-radius:18px;
        padding:12px 14px;
        background:rgba(255, 210, 230, .35);
        border:1px solid rgba(255,160,200,.25);
        box-shadow:0 8px 18px rgba(0,0,0,.08);
        cursor:pointer;
        font-weight:1000;
        color:#5b3550;
        width: 100%;
      ">閉じる</button>
    `;

    openOverlay(cardShell("ステージ選択", body, footer));

    overlay.querySelectorAll(".sfStageBtn").forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        const cfg = loadStage(id);
        closeOverlay();
        onSelectCb?.(cfg);
      };
    });

    overlay.querySelector("#sfClose").onclick = () => closeOverlay();
  }

  // ---- HUD button injected ----
  function ensureHudButton() {
    // index.html の hudBottom の左側に置く（#hud があればOK）
    const hud = document.getElementById("hud");
    if (!hud) return;

    // すでにあるなら終了
    if (document.getElementById("btnStageSelect")) return;

    // hudBottom があればそこへ、なければ hud 直下
    const bottom = hud.querySelector(".hudBottom") || hud;

    const wrap = document.createElement("div");
    wrap.style.cssText = `display:flex; gap:10px; align-items:center;`;

    const btn = document.createElement("button");
    btn.id = "btnStageSelect";
    btn.className = "btn"; // 既存 style.css の .btn を使う
    btn.textContent = "🎟 STAGE";
    btn.style.minWidth = "110px";

    btn.onclick = () => showStageSelect();

    // bottom の先頭に追加（WAVEの左あたりに置きたい）
    // 既存 hudBottom は「WAVE / skill / buttons」なので先頭に入れても自然
    bottom.insertBefore(btn, bottom.firstChild);
  }

  function onSelect(cb) {
    onSelectCb = cb;
  }

  // 起動時にHUDボタンを作る
  ensureHudButton();
  // ページ読み込み直後に hud がまだ無い場合があるので保険
  setTimeout(ensureHudButton, 0);
  setTimeout(ensureHudButton, 200);

  return {
    loadStage,     // 初期ロード
    current,       // 現在のステージ
    showWin,       // 勝利演出
    showStageSelect, // 外部から開きたい場合
    onSelect,      // 選択時コールバック登録
  };
}
