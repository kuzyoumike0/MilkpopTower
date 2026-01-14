// stageFlow.js
// Stage1〜5の難易度を「綺麗に」上げる + ステージ選択 + 勝利遷移UI

export function createStageFlow() {
  const STAGES = [
    {
      id: 1,
      label: "Stage 1",
      // やさしめ
      mirrorHP: 900,
      mirrorSpawnSec: 3.3,
      enemyMulHP: 0.90,
      enemyMulATK: 0.90,
      theme: "pokapoka",
      ground: "grass",
    },
    {
      id: 2,
      label: "Stage 2",
      mirrorHP: 1200,
      mirrorSpawnSec: 2.9,
      enemyMulHP: 1.05,
      enemyMulATK: 1.05,
      theme: "kirakira",
      ground: "candy",
    },
    {
      id: 3,
      label: "Stage 3",
      mirrorHP: 1550,
      mirrorSpawnSec: 2.45,
      enemyMulHP: 1.22,
      enemyMulATK: 1.18,
      theme: "party",
      ground: "party",
    },
    {
      id: 4,
      label: "Stage 4",
      mirrorHP: 1950,
      mirrorSpawnSec: 2.05,
      enemyMulHP: 1.40,
      enemyMulATK: 1.35,
      theme: "yuki",
      ground: "ice",
    },
    {
      id: 5,
      label: "Stage 5",
      // 最終：かなりキツい
      mirrorHP: 2500,
      mirrorSpawnSec: 1.70,
      enemyMulHP: 1.62,
      enemyMulATK: 1.55,
      theme: "utyuu",
      ground: "space",
    },
  ];

  let onSelectCb = null;

  function getStageById(id) {
    return STAGES.find(s => s.id === id) || STAGES[0];
  }

  function loadStage(id) {
    return structuredClone(getStageById(id));
  }

  // ===== UI =====
  function ensureStyle() {
    if (document.getElementById("stageFlowStyle")) return;
    const s = document.createElement("style");
    s.id = "stageFlowStyle";
    s.textContent = `
      .sfOverlay{
        position:fixed; inset:0;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,.35);
        z-index:9998;
      }
      .sfCard{
        width:min(520px, calc(100vw - 24px));
        background:rgba(255,255,255,.92);
        border:1px solid rgba(255,140,195,.35);
        border-radius:22px;
        box-shadow:0 18px 44px rgba(0,0,0,.18);
        padding:16px 16px 14px;
        color:#5b3550;
        backdrop-filter: blur(8px);
      }
      .sfTitle{
        font-weight:1000;
        font-size:18px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .sfSub{
        margin-top:6px;
        font-size:12px;
        opacity:.85;
        line-height:1.5;
      }
      .sfGrid{
        margin-top:12px;
        display:grid;
        grid-template-columns: repeat(2, 1fr);
        gap:10px;
      }
      .sfBtn{
        border:1px solid rgba(255,140,195,.35);
        border-radius:18px;
        background:rgba(255,255,255,.92);
        box-shadow:0 10px 22px rgba(0,0,0,.10);
        padding:12px 12px;
        cursor:pointer;
        font-weight:1000;
        color:#5b3550;
        text-align:left;
        transition: transform .12s ease;
      }
      .sfBtn:hover{ transform: translateY(-2px); }
      .sfBtn:active{ transform: translateY(0) scale(.98); }
      .sfMeta{
        margin-top:6px;
        font-size:12px;
        opacity:.88;
        font-weight:900;
      }
      .sfMeta b{ color:#ff4fa2; }
      .sfClose{
        border:none;
        background:transparent;
        font-size:18px;
        cursor:pointer;
        font-weight:1000;
        color:#ff4fa2;
      }
      @media (max-width: 480px){
        .sfGrid{ grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  function openStageSelect() {
    ensureStyle();

    const ov = document.createElement("div");
    ov.className = "sfOverlay";

    const card = document.createElement("div");
    card.className = "sfCard";

    card.innerHTML = `
      <div class="sfTitle">
        <div>🍬 Stage Select</div>
        <button class="sfClose" aria-label="close">✕</button>
      </div>
      <div class="sfSub">
        Stageが上がるほど <b>敵HP/火力</b> と <b>出現頻度</b> と <b>拠点HP</b> が段階的に上がります。
      </div>
      <div class="sfGrid"></div>
    `;

    const grid = card.querySelector(".sfGrid");

    for (const st of STAGES) {
      const btn = document.createElement("button");
      btn.className = "sfBtn";
      btn.innerHTML = `
        <div>${st.label}</div>
        <div class="sfMeta">
          MirrorHP <b>${st.mirrorHP}</b> /
          Spawn <b>${st.mirrorSpawnSec.toFixed(2)}s</b><br>
          EnemyHP× <b>${st.enemyMulHP.toFixed(2)}</b> /
          ATK× <b>${st.enemyMulATK.toFixed(2)}</b>
        </div>
      `;
      btn.onclick = () => {
        ov.remove();
        onSelectCb && onSelectCb(loadStage(st.id));
      };
      grid.appendChild(btn);
    }

    ov.addEventListener("click", (e) => {
      if (e.target === ov) ov.remove();
    });

    card.querySelector(".sfClose").onclick = () => ov.remove();

    ov.appendChild(card);
    document.body.appendChild(ov);
  }

  function showWin(nextLoader) {
    // 勝ったら「次へ / ステージ選択」
    ensureStyle();

    const ov = document.createElement("div");
    ov.className = "sfOverlay";

    const card = document.createElement("div");
    card.className = "sfCard";

    card.innerHTML = `
      <div class="sfTitle">
        <div>🏆 Victory!</div>
        <button class="sfClose" aria-label="close">✕</button>
      </div>
      <div class="sfSub">
        次のステージへ進むか、ステージ選択に戻れます。
      </div>
      <div class="sfGrid">
        <button class="sfBtn" id="sfNext">➡ Next Stage</button>
        <button class="sfBtn" id="sfSelect">🎀 Stage Select</button>
      </div>
    `;

    const close = () => ov.remove();

    card.querySelector(".sfClose").onclick = close;
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });

    card.querySelector("#sfNext").onclick = () => {
      close();
      // nextLoader(cfg => loadStage(cfg)) のパターンに合わせる
      // 現在ステージ番号は nextLoader が外側で渡す前提なので、
      // ここでは「一旦ステージ選択を開く」よりも nextLoader に任せる
      nextLoader((cfg)=>cfg);
    };

    card.querySelector("#sfSelect").onclick = () => {
      close();
      openStageSelect();
    };

    ov.appendChild(card);
    document.body.appendChild(ov);
  }

  function onSelect(cb) {
    onSelectCb = cb;
  }

  // 外部から呼べるように
  return {
    STAGES,
    loadStage,
    onSelect,
    openStageSelect,
    showWin,
  };
}
