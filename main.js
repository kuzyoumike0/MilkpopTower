(() => {
  "use strict";

  /* =========================
   * Canvas
   * ========================= */
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");

  function fitCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = cv.getBoundingClientRect();
    cv.width = Math.floor(rect.width * dpr);
    cv.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* =========================
   * UI
   * ========================= */
  const $enemyHpText = document.getElementById("enemyHpText");
  const $yourHpText  = document.getElementById("yourHpText");
  const $waveText    = document.getElementById("waveText");
  const $candyText   = document.getElementById("candyText");
  const $candyBar    = document.getElementById("candyBar");

  const $btnPause = document.getElementById("btnPause");
  const $btnReset = document.getElementById("btnReset");
  const $btnSkill = document.getElementById("btnSkill");
  const $skillText = document.getElementById("skillText");

  const unitBtns = Array.from(document.querySelectorAll(".unitBtn"));

  /* =========================
   * Assets
   * ========================= */
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }
  const isReady = img => img && img.complete && img.naturalWidth > 0;

  // Units
  const IMG_YOUR = {
    babybunny: loadImage("./assets/Unit/babybunny.png"),
    bunny:     loadImage("./assets/Unit/bunny.png"),
    bunny3:    loadImage("./assets/Unit/bunny3.png"),
    bunny4:    loadImage("./assets/Unit/bunny4.png"),
    bunny5:    loadImage("./assets/Unit/bunny5.png"),
    reabunny:  loadImage("./assets/Unit/reabunny.png"),
  };
  const IMG_ENEMY = {
    enemy: loadImage("./assets/enemy/enemybunny1.png"),
  };

  // Spawners
  const IMG_ITEM = {
    oak:        loadImage("./assets/item/oak.png"),
    mirrorball: loadImage("./assets/item/mirrorball.png"),
  };

  /* =========================
   * Config
   * ========================= */
  const GAME = {
    groundH: 92,
    leftBaseX: 90,
    rightBaseX: 0,
    laneY: 0,

    yourBaseHPMax: 2500,
    enemyBaseHPMax: 2200,

    candyMaxBase: 500,
    candyRegenBase: 32,

    skillCd: 9,

    // Spawner speeds
    oakSpawnSec: 3.2,
    mirrorSpawnSec: 1.8,

    // prevent overflow
    maxUnitsEachSide: 34,
  };

  const UNIT_DEFS = {
    babybunny:{ cost: 90,  hp:120, atk:16, range:24, speed:60, atkCd:0.55, size:24, spawnCd:1.8 },
    bunny:    { cost:160,  hp:220, atk:22, range:26, speed:52, atkCd:0.62, size:26, spawnCd:2.6 },
    bunny3:   { cost:240,  hp:320, atk:28, range:28, speed:46, atkCd:0.70, size:28, spawnCd:3.4 },
    bunny4:   { cost:340,  hp:420, atk:34, range:30, speed:42, atkCd:0.78, size:30, spawnCd:4.4, knock:8 },
    bunny5:   { cost:460,  hp:560, atk:42, range:34, speed:38, atkCd:0.86, size:32, spawnCd:5.6, knock:12 },
    reabunny: { cost:620,  hp:520, atk:46, range:140,speed:34, atkCd:0.95, size:32, spawnCd:7.2, projectile:false },
  };

  function enemyStatsForWave(w) {
    return {
      hp: 140 + w * 22,
      atk: 18 + w * 2,
      speed: 48 + Math.min(14, w * 0.85),
      atkCd: Math.max(0.48, 0.65 - w * 0.01),
      size: 26,
      range: 24,
    };
  }

  /* =========================
   * State
   * ========================= */
  let paused = false;
  let tPrev = performance.now();

  let wave = 1;
  let yourBaseHP = GAME.yourBaseHPMax;
  let enemyBaseHP = GAME.enemyBaseHPMax;

  let candyMax = GAME.candyMaxBase;
  let candy = 220;
  let candyRegen = GAME.candyRegenBase;

  let skillReady = true;
  let skillLeft = 0;

  const yourUnits = [];
  const enemyUnits = [];
  const particles = [];

  const spawnCdLeft = Object.create(null);

  let oakTimer = 0;
  let mirrorTimer = 0;

  /* =========================
   * Helpers
   * ========================= */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);

  function worldInitMetrics() {
    const r = cv.getBoundingClientRect();
    GAME.rightBaseX = r.width - 90;
    GAME.laneY = r.height - GAME.groundH - 52;
  }

  // ✅ 端固定：mirrorball 左端 / oak 右端
  function mirrorX() { return GAME.leftBaseX + 54; }
  function oakX()    { return GAME.rightBaseX - 54; }

  function addParticle(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-70, 70),
        vy: rand(-120, -40),
        life: rand(0.22, 0.55)
      });
    }
  }

  function pickYourImg(key) {
    const img = IMG_YOUR[key] || IMG_YOUR.bunny;
    if (isReady(img)) return img;
    return isReady(IMG_YOUR.bunny) ? IMG_YOUR.bunny : null;
  }
  function pickEnemyImg() {
    return isReady(IMG_ENEMY.enemy) ? IMG_ENEMY.enemy : null;
  }

  /* =========================
   * Spawns
   * ========================= */
  function makeYourUnit(key, x) {
    const d = UNIT_DEFS[key] || UNIT_DEFS.bunny;
    return {
      side: "your",
      key,
      x,
      y: GAME.laneY,
      hp: d.hp,
      hpMax: d.hp,
      atk: d.atk,
      range: d.range,
      speed: d.speed,
      atkCd: d.atkCd,
      cdLeft: 0,
      size: d.size,
      knock: d.knock || 0
    };
  }

  function spawnYour(key) {
    const d = UNIT_DEFS[key];
    if (!d) return;
    if ((spawnCdLeft[key] || 0) > 0) return;
    if (candy < d.cost) return;
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;

    candy -= d.cost;
    spawnCdLeft[key] = d.spawnCd || 0;

    // ✅ 右端 oak の少し左から出撃（見た目が自然）
    yourUnits.push(makeYourUnit(key, oakX() - 40));
    addParticle(oakX() - 40, GAME.laneY - 30, 10);
  }

  // oak -> bunny（無料）
  function spawnFromOak() {
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;
    yourUnits.push(makeYourUnit("bunny", oakX() - 40));
    addParticle(oakX() - 40, GAME.laneY - 30, 12);
  }

  // mirrorball -> enemy
  function spawnFromMirrorball() {
    if (enemyUnits.length >= GAME.maxUnitsEachSide) return;
    const s = enemyStatsForWave(wave);
    enemyUnits.push({
      side: "enemy",
      x: mirrorX() + 40,
      y: GAME.laneY,
      hp: s.hp,
      hpMax: s.hp,
      atk: s.atk,
      range: s.range,
      speed: s.speed,
      atkCd: s.atkCd,
      cdLeft: 0,
      size: s.size
    });
    addParticle(mirrorX() + 40, GAME.laneY - 30, 12);
  }

  /* =========================
   * Combat
   * ========================= */
  function updateUnit(u, dt) {
    u.cdLeft = Math.max(0, u.cdLeft - dt);

    const isYour = u.side === "your";
    const dir = isYour ? -1 : 1;
    const targets = isYour ? enemyUnits : yourUnits;
    const baseX = isYour ? GAME.leftBaseX : GAME.rightBaseX;

    let target = null;
    let best = 1e9;
    for (const t of targets) {
      const d = Math.abs(u.x - t.x);
      if (d < best) { best = d; target = t; }
    }

    const tx = target ? target.x : baseX;
    const dist = Math.abs(u.x - tx);
    const canHit = dist <= (u.range + u.size * 0.35);

    if (canHit) {
      if (u.cdLeft <= 0) {
        if (target) {
          target.hp -= u.atk;
          if (isYour && u.knock) target.x -= u.knock;
          if (!isYour) target.x += 4;
          addParticle(target.x, target.y - 22, 8);
        } else {
          if (isYour) enemyBaseHP -= u.atk;
          else yourBaseHP -= u.atk;
          addParticle(baseX + (isYour ? 16 : -16), GAME.laneY - 16, 10);
        }
        u.cdLeft = u.atkCd;
      }
      return;
    }

    u.x += dir * u.speed * dt;
    u.x = clamp(u.x, GAME.leftBaseX, GAME.rightBaseX);
  }

  function cleanupDead() {
    for (let i = enemyUnits.length - 1; i >= 0; i--) {
      if (enemyUnits[i].hp > 0) continue;
      addParticle(enemyUnits[i].x, enemyUnits[i].y - 18, 16);
      enemyUnits.splice(i, 1);
      candy = clamp(candy + 18, 0, candyMax);
    }
    for (let i = yourUnits.length - 1; i >= 0; i--) {
      if (yourUnits[i].hp > 0) continue;
      addParticle(yourUnits[i].x, yourUnits[i].y - 18, 14);
      yourUnits.splice(i, 1);
    }
  }

  /* =========================
   * Economy + cooldowns + spawners
   * ========================= */
  function updateEconomy(dt) {
    candy = clamp(candy + candyRegen * dt, 0, candyMax);

    for (const k in spawnCdLeft) {
      spawnCdLeft[k] = Math.max(0, spawnCdLeft[k] - dt);
    }

    if (!skillReady) {
      skillLeft = Math.max(0, skillLeft - dt);
      if (skillLeft <= 0) skillReady = true;
    }
  }

  function updateSpawners(dt) {
    oakTimer += dt;
    if (oakTimer >= GAME.oakSpawnSec) {
      oakTimer = 0;
      spawnFromOak();
    }

    mirrorTimer += dt;
    if (mirrorTimer >= GAME.mirrorSpawnSec) {
      mirrorTimer = 0;
      spawnFromMirrorball();
    }
  }

  /* =========================
   * Skill
   * ========================= */
  function castSkill() {
    if (!skillReady || paused) return;
    skillReady = false;
    skillLeft = GAME.skillCd;

    const zoneL = GAME.rightBaseX - 360;
    const zoneR = GAME.rightBaseX - 60;

    for (const e of enemyUnits) {
      if (e.x < zoneL || e.x > zoneR) continue;
      e.hp -= 60;
      e.x -= 70;
      addParticle(e.x, e.y - 22, 18);
    }
  }

  /* =========================
   * Particles
   * ========================= */
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const s = particles[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 260 * dt;
      if (s.life <= 0) particles.splice(i, 1);
    }
  }

  /* =========================
   * Render
   * ========================= */
  function drawBackground(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ffe8f2");
    g.addColorStop(1, "#fff3f8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255, 170, 210, .35)";
    ctx.fillRect(0, h - GAME.groundH, w, GAME.groundH);

    ctx.strokeStyle = "rgba(0,0,0,.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GAME.laneY + 24);
    ctx.lineTo(w, GAME.laneY + 24);
    ctx.stroke();
  }

  function drawBase(x, y, hp, hpMax, isYour) {
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

  function drawSpawner(x, y, img, size) {
    if (isReady(img)) {
      ctx.drawImage(img, x - size / 2, y - size, size, size);
      return;
    }
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.beginPath();
    ctx.arc(x, y - size * 0.55, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawUnit(u) {
    const isYour = u.side === "your";
    const x = u.x, y = u.y;

    if (isYour) {
      const img = pickYourImg(u.key);
      if (img) {
        const s = u.size * 2.25;
        ctx.drawImage(img, x - s / 2, y - s, s, s);
      }
    } else {
      const img = pickEnemyImg();
      if (img) {
        const s = u.size * 2.15;
        ctx.drawImage(img, x - s / 2, y - s, s, s);
      }
    }

    const p = clamp(u.hp / u.hpMax, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(x - 22, y - 64, 44, 6);
    ctx.fillStyle = isYour ? "rgba(255,79,160,.9)" : "rgba(80,80,90,.9)";
    ctx.fillRect(x - 22, y - 64, 44 * p, 6);
  }

  function drawParticles() {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (const s of particles) {
      ctx.globalAlpha = clamp(s.life / 0.55, 0, 1);
      ctx.fillRect(s.x, s.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    const rect = cv.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    drawBackground(w, h);

    // bases
    drawBase(GAME.leftBaseX,  GAME.laneY + 24, enemyBaseHP, GAME.enemyBaseHPMax, false);
    drawBase(GAME.rightBaseX, GAME.laneY + 24, yourBaseHP,  GAME.yourBaseHPMax,  true);

    // spawners on edges
    drawSpawner(mirrorX(), GAME.laneY + 28, IMG_ITEM.mirrorball, 150);
    drawSpawner(oakX(),    GAME.laneY + 28, IMG_ITEM.oak,        170);

    // units
    for (const e of enemyUnits) drawUnit(e);
    for (const u of yourUnits) drawUnit(u);

    drawParticles();
  }

  /* =========================
   * UI refresh
   * ========================= */
  function ensureCdBadges() {
    for (const btn of unitBtns) {
      if (btn.querySelector(".cdBadge")) continue;
      const badge = document.createElement("div");
      badge.className = "cdBadge";
      btn.appendChild(badge);
    }
  }

  function refreshUI() {
    $enemyHpText.textContent = `${Math.max(0, Math.floor(enemyBaseHP))}`;
    $yourHpText.textContent  = `${Math.max(0, Math.floor(yourBaseHP))}`;
    $waveText.textContent    = `${wave}`;

    $candyText.textContent = `${Math.floor(candy)}/${candyMax}`;
    $candyBar.style.width = `${(candy / candyMax) * 100}%`;

    ensureCdBadges();
    for (const b of unitBtns) {
      const key = b.dataset.unit;
      const def = UNIT_DEFS[key];
      const cd = spawnCdLeft[key] || 0;

      const okCost = def && candy >= def.cost;
      const okCd = cd <= 0;
      const ok = okCost && okCd;

      b.classList.toggle("disabled", !ok);
      const badge = b.querySelector(".cdBadge");
      if (badge) badge.textContent = cd > 0 ? `${Math.ceil(cd)}s` : "";
    }

    if (skillReady) {
      $btnSkill.disabled = false;
      $skillText.textContent = "ready";
    } else {
      $btnSkill.disabled = true;
      $skillText.textContent = `${Math.ceil(skillLeft)}s`;
    }
  }

  /* =========================
   * Wave
   * ========================= */
  function stepWave() {
    if (enemyBaseHP > 0 && yourBaseHP > 0) return;

    if (enemyBaseHP <= 0) {
      wave += 1;
      enemyBaseHP = GAME.enemyBaseHPMax + Math.floor((wave - 1) * 160);

      // mirrorball gets faster each wave (cap)
      GAME.mirrorSpawnSec = Math.max(0.75, 1.8 - (wave - 1) * 0.08);

      candyMax = GAME.candyMaxBase + (wave - 1) * 40;
      candyRegen = GAME.candyRegenBase + (wave - 1) * 2.4;
      candy = clamp(candy + 240, 0, candyMax);

      enemyUnits.length = 0;
      yourBaseHP = Math.min(GAME.yourBaseHPMax, yourBaseHP + 520);
      addParticle(GAME.rightBaseX - 40, GAME.laneY - 40, 24);
      return;
    }

    if (yourBaseHP <= 0) resetGame();
  }

  /* =========================
   * Loop
   * ========================= */
  function loop(tNow) {
    const dt = clamp((tNow - tPrev) / 1000, 0, 0.05);
    tPrev = tNow;

    if (!paused) {
      updateEconomy(dt);
      updateSpawners(dt);

      for (const u of yourUnits) updateUnit(u, dt);
      for (const e of enemyUnits) updateUnit(e, dt);

      cleanupDead();
      updateParticles(dt);
      stepWave();
    }

    render();
    refreshUI();
    requestAnimationFrame(loop);
  }

  /* =========================
   * Reset
   * ========================= */
  function resetGame() {
    paused = false;
    wave = 1;

    yourBaseHP = GAME.yourBaseHPMax;
    enemyBaseHP = GAME.enemyBaseHPMax;

    candyMax = GAME.candyMaxBase;
    candy = 220;
    candyRegen = GAME.candyRegenBase;

    skillReady = true;
    skillLeft = 0;

    yourUnits.length = 0;
    enemyUnits.length = 0;
    particles.length = 0;

    for (const k in spawnCdLeft) delete spawnCdLeft[k];

    oakTimer = 0;
    mirrorTimer = 0;

    GAME.oakSpawnSec = 3.2;
    GAME.mirrorSpawnSec = 1.8;
  }

  /* =========================
   * Events
   * ========================= */
  unitBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      spawnYour(btn.dataset.unit);
    });
  });

  $btnSkill.addEventListener("click", () => castSkill());

  $btnPause.addEventListener("click", () => {
    paused = !paused;
    $btnPause.textContent = paused ? "▶" : "⏸";
  });

  $btnReset.addEventListener("click", () => resetGame());

  /* =========================
   * Start
   * ========================= */
  function boot() {
    fitCanvas();
    worldInitMetrics();
    resetGame();
    requestAnimationFrame((t) => {
      tPrev = t;
      requestAnimationFrame(loop);
    });
  }

  window.addEventListener("resize", () => {
    fitCanvas();
    worldInitMetrics();
  });

  boot();
})();
