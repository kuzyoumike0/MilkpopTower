// stage.js
export function createStage() {
  const ST = {
    groundH: 92,
    leftBaseX: 90,
    rightBaseX: 0,
    laneY: 0,
  };

  function resize(canvas) {
    const rect = canvas.getBoundingClientRect();
    ST.rightBaseX = rect.width - 90;
    ST.laneY = rect.height - ST.groundH - 52;
  }

  // ✅ 端固定：mirrorball 左端 / oak 右端
  function mirrorX() { return 60; } // 画面左端寄り
  function oakX()    { return ST.rightBaseX - 54; }

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const isReady = (img) => img && img.complete && img.naturalWidth > 0;

  function drawBackground(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ffe8f2");
    g.addColorStop(1, "#fff3f8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255, 170, 210, .35)";
    ctx.fillRect(0, h - ST.groundH, w, ST.groundH);

    ctx.strokeStyle = "rgba(0,0,0,.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ST.laneY + 24);
    ctx.lineTo(w, ST.laneY + 24);
    ctx.stroke();
  }

  function drawSpawner(ctx, x, y, img, size) {
    if (isReady(img)) {
      ctx.drawImage(img, x - size / 2, y - size, size, size);
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.beginPath();
    ctx.arc(x, y - size * 0.55, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHpBar(ctx, x, y, w, p) {
    p = clamp(p, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = "#ff4fa0";
    ctx.fillRect(x, y, w * p, 10);
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.strokeRect(x, y, w, 10);
  }

  // state: { stageId, mirrorHP, mirrorHPMax, yourBaseHP, yourBaseHPMax }
  function render(ctx, canvas, assets, state) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    drawBackground(ctx, w, h);

    // oak（右端）
    drawSpawner(ctx, oakX(), ST.laneY + 28, assets.oak, 170);

    // mirrorball（左端＝敵拠点）
    const mx = mirrorX();
    drawSpawner(ctx, mx, ST.laneY + 28, assets.mirrorball, 150);

    // mirror HP bar（左上寄り）
    drawHpBar(ctx, 18, 18, 220, state.mirrorHP / state.mirrorHPMax);

    // stage label（左上）
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = "900 14px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(`STAGE ${state.stageId}`, 18, 58);

    // your base HP bar（右上寄り）
    drawHpBar(ctx, w - 238, 18, 220, state.yourBaseHP / state.yourBaseHPMax);
  }

  return { ST, resize, mirrorX, oakX, render };
}
