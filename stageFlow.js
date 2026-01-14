// stageFlow.js
// Stage1〜5 管理（mirrorball破壊で勝利→次ステージ）
// - 画面中央に「勝利！」オーバーレイを動的に作成（HTML改修不要）

export function createStageFlow() {
  const STAGES = [
    // stage 1
    { id: 1, mirrorHP: 900,  mirrorSpawnSec: 2.10, enemyMulHP: 1.00, enemyMulATK: 1.00 },
    // stage 2
    { id: 2, mirrorHP: 1200, mirrorSpawnSec: 1.90, enemyMulHP: 1.12, enemyMulATK: 1.08 },
    // stage 3
    { id: 3, mirrorHP: 1600, mirrorSpawnSec: 1.65, enemyMulHP: 1.30, enemyMulATK: 1.14 },
    // stage 4
    { id: 4, mirrorHP: 2200, mirrorSpawnSec: 1.40, enemyMulHP: 1.55, enemyMulATK: 1.22 },
    // stage 5
    { id: 5, mirrorHP: 3000, mirrorSpawnSec: 1.18, enemyMulHP: 1.85, enemyMulATK: 1.35 },
  ];

  let stageIndex = 0;

  // ---- overlay ----
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999; display:none;
    background:rgba(255, 230, 242, .70);
    backdrop-filter: blur(6px);
    align-items:center; justify-content:center;
    pointer-events:auto;
  `;
  overlay.innerHTML = `
    <div style="
      width:min(520px, calc(100vw - 28px));
      border-radius:26px;
      background:rgba(255,255,255,.92);
      border:2px solid rgba(255,160,200,.35);
      box-shadow:0 20px 60px rgba(0,0,0,.18);
      padding:18px 18px 16px;
      text-align:center;
      color:#5b3550;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    ">
      <div id="sfTitle" style="font-weight:1000; font-size:28px; margin-top:4px;">勝利！</div>
      <div id="sfDesc" style="opacity:.85; font-weight:900; margin-top:10px;">
        mirrorball を破壊した！
      </div>
      <button id="sfNext" style="
        margin-top:14px;
        border:none; border-radius:18px;
        padding:12px 14px;
        background:linear-gradient(180deg,#ffffff,#ffeaf3);
        border:2px solid rgba(255,160,200,.30);
        box-shadow:0 10px 22px rgba(0,0,0,.10);
        cursor:pointer;
        font-weight:1000;
        color:#5b3550;
        width: 100%;
      ">次のステージへ</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const $title = overlay.querySelector("#sfTitle");
  const $desc  = overlay.querySelector("#sfDesc");
  const $next  = overlay.querySelector("#sfNext");

  function current() {
    return STAGES[stageIndex];
  }

  function showWin(onNext) {
    const st = current();
    overlay.style.display = "flex";
    $title.textContent = `勝利！ Stage ${st.id}`;
    if (stageIndex >= STAGES.length - 1) {
      $desc.textContent = "全ステージクリア！";
      $next.textContent = "最初から";
    } else {
      $desc.textContent = "mirrorball を破壊した！";
      $next.textContent = "次のステージへ";
    }
    $next.onclick = () => {
      overlay.style.display = "none";
      // 次へ（5を超えたら最初へ）
      stageIndex = (stageIndex >= STAGES.length - 1) ? 0 : stageIndex + 1;
      onNext?.(current());
    };
  }

  function loadStage(n) {
    const idx = STAGES.findIndex(s => s.id === n);
    stageIndex = idx >= 0 ? idx : 0;
    return current();
  }

  return {
    loadStage,     // 初期ロード
    current,       // 現在のステージ設定
    showWin,       // 勝利演出 → 次ステージへ
  };
}
