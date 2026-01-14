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
  function mirrorX() { return 60; }
  function oakX()    { return ST.rightBaseX - 54; }

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const isReady = (img) => img && img.complete && img.naturalWidth > 0;

  /* =========================
   * BG images (Stage1-5)
   * ========================= */
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  // ✅ ユーザー指定BG
  const BG = {
    1: loadImage("./assets/bg/pokapoka.png"),  // stage1
    2: loadImage("./assets/bg/kirakira.png"),  // stage2
    3: loadImage("./assets/bg/yuki.jpg"),      // stage3
    4: loadImage("./assets/bg/utyuu.jpg"),     // stage4
    5: loadImage("./assets/bg/party.png"),     // stage5
  };

  function getTheme(stageId) {
    // 画像の上に重ねる“ほんのり”色味と地面演出だけステージごとに変える
    switch (stageId) {
      case 1: return { tint: "rgba(255,170,210,.10)", groundA:"rgba(255,170,210,.30)", groundB:"rgba(255,210,230,.55)", deco:"sprinkle" };
      case 2: return { tint: "rgba(120,210,255,.10)", groundA:"rgba(120,170,255,.18)", groundB:"rgba(210,235,255,.55)", deco:"sparkle" };
      case 3: return { tint: "rgba(255,255,255,.08)", groundA:"rgba(180,210,255,.18)", groundB:"rgba(255,255,255,.55)", deco:"snow" };
      case 4: return { tint: "rgba(120,90,200,.12)",  groundA:"rgba(120,90,200,.14)",  groundB:"rgba(220,200,255,.55)", deco:"stars" };
      case 5: return { tint: "rgba(255,210,240,.10)", groundA:"rgba(255,170,210,.22)", groundB:"rgba(255,240,250,.60)", deco:"confetti" };
      default:return { tint: "rgba(255,170,210,.10)", groundA:"rgba(255,170,210,.30)", groundB:"rgba(255,210,230,.55)", deco:"sprinkle" };
    }
  }

  /* =========================
   * Drawing helpers
   * ========================= */
  function drawCoverImage(ctx, img, w, h) {
    // cover（縦横比維持で全面に敷く）
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawBackground(ctx, w, h, stageId) {
    const img = BG[stageId] || BG[1];

    // 画像がまだ読み込めてない時の保険
    if (!isReady(img)) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#ffe8f2");
      g.addColorStop(1, "#fff7fb");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    drawCoverImage(ctx, img, w, h);

    // ほんのり可愛くトーンを統一する色かぶせ
    const theme = getTheme(stageId);
    ctx.fillStyle = theme.tint;
    ctx.fillRect(0, 0, w, h);

    // 上からふんわり白
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "rgba(255,255,255,.08)");
    v.addColorStop(1, "rgba(255,255,255,.00)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  function drawGround(ctx, w, h, stageId, t) {
    const theme = getTheme(stageId);

    // ground base
    ctx.fillStyle = theme.groundA;
    ctx.fillRect(0, h - ST.groundH, w, ST.groundH);

    // wavy highlight
    ctx.fillStyle = theme.groundB;
    const y0 = h - ST.groundH + 14;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    const amp = 6;
    const spd = 1.7;
    for (let x = 0; x <= w; x += 18) {
      const yy = y0 + Math.sin((x / 120) + t * spd) * amp;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;

    // lane line
    ctx.strokeStyle = "rgba(0,0,0,.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ST.laneY + 24);
    ctx.lineTo(w, ST.laneY + 24);
    ctx.stroke();

    // stage-specific small fx on ground
    drawDeco(ctx, w, h, stageId, t);
  }

  function drawDeco(ctx, w, h, stageId, t) {
    const theme = getTheme(stageId);
    ctx.save();
    ctx.globalAlpha = 0.22;

    // 空中の演出は軽めに（地面より上）
    const topLimit = h - ST.groundH - 40;

    if (theme.deco === "snow") {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 38; i++) {
        const x = (i * 70 + (t * 28) % (w + 200)) - 100;
        const y = (i * 33 + (t * 18)) % (topLimit + 120) - 60;
        const r = 1.5 + (i % 3) * 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.deco === "stars") {
      ctx.fillStyle = "rgba(255,255,255,.95)";
      for (let i = 0; i < 14; i++) {
        const x = (i * 90 + 60) % (w - 40) + 20;
        const y = 60 + (i % 5) * 28;
        const tw = 0.55 + 0.45 * Math.sin(t * 2.0 + i);
        drawStar(ctx, x, y, 4 + (i % 3), tw);
      }
    } else if (theme.deco === "sparkle") {
      ctx.fillStyle = "rgba(255,255,255,.95)";
      for (let i = 0; i < 14; i++) {
        const x = (i * 100 + (t * 44) % (w + 220)) - 110;
        const y = 70 + (i % 4) * 34;
        const s = 6 + (i % 3) * 3;
        const a = 0.5 + 0.5 * Math.sin(t * 3.0 + i);
        ctx.globalAlpha = 0.12 + a * 0.22;
        drawSpark(ctx, x, y, s);
      }
      ctx.globalAlpha = 0.22;
    } else if (theme.deco === "confetti") {
      for (let i = 0; i < 22; i++) {
        const x = (i * 70 + (t * 60) % (w + 260)) - 130;
        const y = 40 + (i % 6) * 22 + Math.sin(t * 1.6 + i) * 6;
        ctx.fillStyle = `rgba(${150 + (i%3)*30},${120 + (i%5)*18},${200 - (i%4)*22},.85)`;
        ctx.fillRect(x, y, 12, 4);
      }
    } else {
      // sprinkle
      for (let i = 0; i < 18; i++) {
        const x = (i * 90 + (t * 34) % (w + 220)) - 110;
        const y = 60 + (i % 5) * 24;
        ctx.fillStyle = `rgba(${255},${140 + (i%5)*18},${200 + (i%3)*18},.85)`;
        ctx.fillRect(x, y, 10, 4);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawStar(ctx, x, y, r, tw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(tw, tw);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = (i % 2 === 0) ? r : r * 0.45;
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSpark(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(2, -2);
    ctx.lineTo(s, 0);
    ctx.lineTo(2, 2);
    ctx.lineTo(0, s);
    ctx.lineTo(-2, 2);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-2, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

    const t = performance.now() / 1000;

    // ✅ BG画像
    drawBackground(ctx, w, h, state.stageId);

    // ✅ 地面演出（半透明で重ねる）
    drawGround(ctx, w, h, state.stageId, t);

    // oak（右端）
    drawSpawner(ctx, oakX(), ST.laneY + 28, assets.oak, 170);

    // mirrorball（左端＝敵拠点）
    drawSpawner(ctx, mirrorX(), ST.laneY + 28, assets.mirrorball, 150);

    // mirror HP（左上）
    drawHpBar(ctx, 18, 18, 220, state.mirrorHP / state.mirrorHPMax);

    // stage label（左上）
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.font = "900 14px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(`STAGE ${state.stageId}`, 18, 58);

    // your base HP（右上）
    drawHpBar(ctx, w - 238, 18, 220, state.yourBaseHP / state.yourBaseHPMax);
  }

  return { ST, resize, mirrorX, oakX, render };
}
