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
  function mirrorX() { return ST.leftBaseX + 54; }
  function oakX()    { return ST.rightBaseX - 54; }

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

  function drawBase(ctx, x, y, hp, hpMax, isYour) {
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = isYour ? "rgba(255,123,178,.80)" : "rgba(80,80,90,.55)";
    ctx.beginPath();
    ctx.roundRect(-22, -74, 44, 92, 16);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath();
    ctx.arc(0, -86, 18, 0, Math.PI * 2);
    ctx.fill();

    const p = clamp(hp / hpMax, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(-30, -110, 60, 8);
    ctx.fillStyle = isYour ? "#ff4fa0" : "#6a6a7a";
    ctx.fillRect(-30, -110, 60 * p, 8);

    ctx.restore();
  }

  function drawSpawner(ctx, x, y, img, size) {
    const isReady = (im) => im && im.complete && im.naturalWidth > 0;
    if (isReady(img)) {
      ctx.drawImage(img, x - size / 2, y - size, size, size);
      return;
    }
    // fallback
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.beginPath();
    ctx.arc(x, y - size * 0.55, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(ctx, canvas, assets, state) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    drawBackground(ctx, w, h);

    // bases
    drawBase(ctx, ST.leftBaseX,  ST.laneY + 24, state.enemyBaseHP, state.enemyBaseHPMax, false);
    drawBase(ctx, ST.rightBaseX, ST.laneY + 24, state.yourBaseHP,  state.yourBaseHPMax,  true);

    // spawners (left/right edge)
    drawSpawner(ctx, mirrorX(), ST.laneY + 28, assets.mirrorball, 150);
    drawSpawner(ctx, oakX(),    ST.laneY + 28, assets.oak,        170);
  }

  return {
    ST,
    resize,
    mirrorX,
    oakX,
    render,
  };
}
