(() => {
  "use strict";

  /* =========================
   * Canvas setup
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

  // 自軍（指定ファイル名）
  const IMG_YOUR = {
    babybunny: loadImage("./assets/Unit/babybunny.png"),
    bunny:     loadImage("./assets/Unit/bunny.png"),
    bunny3:    loadImage("./assets/Unit/bunny3.png"),
    bunny4:    loadImage("./assets/Unit/bunny4.png"),
    bunny5:    loadImage("./assets/Unit/bunny5.png"),
    reabunny:  loadImage("./assets/Unit/reabunny.png"),
  };

  // 敵（指定ファイル名）
  const IMG_ENEMY = {
    enemybunny1: loadImage("./assets/enemy/enemybunny1.png"),
  };

  // スポナー（追加）
  const IMG_ITEM = {
    oak:        loadImage("./assets/item/oak.png"),
    mirrorball: loadImage("./assets/item/mirrorball.png"),
  };

  /* =========================
   * Game constants
   * ========================= */
  const GAME = {
    groundH: 86,
    leftBaseX: 110,
    rightBaseX: 0,
    laneY: 0,

    yourBaseHPMax: 2500,
    enemyBaseHPMax: 2200,

    candyMaxBase: 500,
    candyRegenBase: 32,

    // スキル（今回は表示だけ残して、動作は簡易）
    skillCd: 9,

    // スポナー設定
    oakSpawnSec: 3.2,        // oakから味方bunnyが出る間隔
    mirrorSpawnSec: 1.8,     // mirrorballから敵が出る間隔
    maxUnitsEachSide: 30,    // 増えすぎ防止
  };

  /* =========================
   * Unit definitions（出撃クールタイム付き）
   * ========================= */
  const UNIT_DEFS = {
    babybunny:{ cost: 90,  hp:120, atk:16, range:24, speed:60, atkCd:0.55, size:24, spawnCd:1.8 },
    bunny:    { cost:160,  hp:220, atk:22, range:26, speed:52, atkCd:0.62, size:26, spawnCd:2.6 },
    bunny3:   { cost:240,  hp:320, atk:28, range:28, speed:46, atkCd:0.70, size:28, spawnCd:3.4 },
    bunny4:   { cost:340,  hp:420, atk:34, range:30, speed:42, atkCd:0.78, size:30, spawnCd:4.4, knock:8 },
    bunny5:   { cost:460,  hp:560, atk:42, range:34, speed:38, atkCd:0.86, size:32, spawnCd:5.6, knock:12 },
    reabunny: { cost:620,  hp:520, atk:46, range:140,speed:34, atkCd:0.95, size:32, spawnCd:7.2, projectile:true },
  };

  /* =========================
   * Enemy base def (simple)
   * ========================= */
  function enemyStatsForWave(w) {
    return {
      hp: 140 + w * 22,
      atk: 18 + w * 2,
      speed: 48 + Math.min(12, w * 0.8),
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

  // スキル（簡易：押したら敵を少し押し返す）
  let skillReady = true;
  let skillLeft = 0;

  const yourUnits = [];
  const enemyUnits = [];
  const particles = [];

  // ★ 出撃クールタイム（unitKey -> secondsLeft）
  const spawnCdLeft = Object.create(null);

  // ★ スポナー用タイマー
  let oakTimer = 0;
  let mirrorTimer = 0;

  /* =========================
   * Helpers
   * ========================= */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);

  function worldInitMetrics() {
    const r = cv.getBoundingClientRect();
    GAME.rightBaseX = r.width - 110;
    GAME.laneY = r.height - GAME.groundH - 44;
  }

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
    const img = IMG_ENEMY.enemybunny1;
    return isReady(img) ? img : null;
  }

  /* =========================
   * Spawn
   * ========================= */

  // 通常出撃（ボタン）：cost + 出撃クールタイムあり
  function spawnYour(key) {
    const d = UNIT_DEFS[key];
    if (!d) return;
    if ((spawnCdLeft[key] || 0) > 0) return;
    if (candy < d.cost) return;
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;

    candy -= d.cost;
    spawnCdLeft[key] = d.spawnCd || 0;

    yourUnits.push(makeYourUnit(key, GAME.rightBaseX - 50));
  }

  // oak出撃：無料＆ボタンCD無関係（= oak専用タイマーで制御）
  function spawnFromOak() {
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;
    // oakからは「bunny」を出す（指定通り）
    yourUnits.push(makeYourUnit("bunny", oakX() + 36));
    addParticle(oakX() + 36, GAME.laneY - 30, 12);
  }

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

  // mirrorball出撃：敵がここから湧く
  function spawnFromMirrorball() {
    if (enemyUnits.length >= GAME.maxUnitsEachSide) return;

    const s = enemyStatsForWave(wave);
    enemyUnits.push({
      side: "enemy",
      x: mirrorX() - 36,
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
    addParticle(mirrorX() - 36, GAME.laneY - 30, 12);
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

    // find nearest
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

          // knockback
          if (isYour && u.knock) target.x -= u.knock;
          if (!isYour) target.x += 4;

          addParticle(target.x, target.y - 20, 8);
        } else {
          // hit base
          if (isYour) enemyBaseHP -= u.atk;
          else yourBaseHP -= u.atk;
          addParticle(baseX + (isYour ? 20 : -20), GAME.laneY - 16, 10);
        }
        u.cdLeft = u.atkCd;
      }
      return;
    }

    // move
    u.x += dir * u.speed * dt;
    u.x = clamp(u.x, GAME.leftBaseX, GAME.rightBaseX);
  }

  function cleanupDead() {
    for (let i = enemyUnits.length - 1; i >= 0; i--) {
      if (enemyUnits[i].hp > 0) continue;
      addParticle(enemyUnits[i].x, enemyUnits[i].y - 18, 16);
      enemyUnits.splice(i, 1);
      candy = clamp(candy + 18, 0, candyMax); // 倒した報酬
    }
    for (let i = yourUnits.length - 1; i >= 0; i--) {
      if (yourUnits[i].hp > 0) continue;
      addParticle(yourUnits[i].x, yourUnits[i].y - 18, 14);
      yourUnits.splice(i, 1);
    }
  }

  /* =========================
   * Economy + Cooldowns + Spawners
   * ========================= */
  function updateEconomy(dt) {
    // candy regen
    candy = clamp(candy + candyRegen * dt, 0, candyMax);

    // button spawn cooldowns
    for (const k in spawnCdLeft) {
      spawnCdLeft[k] = Math.max(0, spawnCdLeft[k] - dt);
    }

    // skill cd
    if (!skillReady) {
      skillLeft = Math.max(0, skillLeft - dt);
      if (skillLeft <= 0) skillReady = true;
    }
  }

  function updateSpawners(dt) {
    // oak -> your bunny
    oakTimer += dt;
    if (oakTimer >= GAME.oakSpawnSec) {
      oakTimer = 0;
      spawnFromOak();
    }

    // mirrorball -> enemy
    mirrorTimer += dt;
    if (mirrorTimer >= GAME.mirrorSpawnSec) {
      mirrorTimer = 0;
      spawnFromMirrorball();
    }
  }

  /* =========================
   * Skill (simple)
   * ========================= */
  function castSkill() {
    if (!skillReady || paused) return;
    skillReady = false;
    skillLeft = GAME.skillCd;

    // push enemies back a bit near your side
    const zoneL = GAME.rightBaseX - 320;
    const zoneR = GAME.rightBaseX - 30;

    for (const e of enemyUnits) {
      if (e.x < zoneL || e.x > zoneR) continue;
      e.hp -= 60;
      e.x -= 60;
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
   * Spawner positions
   * ========================= */
  function oakX() {
    // 右側（自軍側）に配置
    return GAME.rightBaseX - 190;
  }
  function mirrorX() {
    // 左側（敵側）に配置
    return GAME.leftBaseX + 190;
  }

  /* =========================
   * Rendering
   * ========================= */
  function drawBackground(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ffe8f2");
    g.addColorStop(1, "#fff3f8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255, 170, 210, .35)";
    ctx.fillRect(0, h - GAME.groundH, w, GAME.groundH);

    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GAME.laneY + 22);
    ctx.lineTo(w, GAME.laneY + 22);
    ctx.stroke();
  }

  function drawBase(x, y, hp, hpMax, isYour) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = isYour ? "rgba(255,123,178,.75)" : "rgba(80,80,90,.55)";
    ctx.beginPath();
    ctx.roundRect(-22, -74, 44, 92, 14);
    ctx.fill();

    ctx.fillStyle = isYour ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.75)";
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
    // fallback
    ctx.fillStyle = "rgba(0,0,0,.15)";
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
      } else {
        ctx.fillStyle = "rgba(255,160,195,.75)";
        ctx.beginPath();
        ctx.arc(x, y - 24, u.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const img = pickEnemyImg();
      if (img) {
        const s = u.size * 2.15;
        ctx.drawImage(img, x - s / 2, y - s, s, s);
      } else {
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.beginPath();
        ctx.arc(x, y - 24, u.size, 0, Math.PI * 2);
        ctx.fill();
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
    drawBase(GAME.leftBaseX,  GAME.laneY + 22, enemyBaseHP, GAME.enemyBaseHPMax, false);
    drawBase(GAME.rightBaseX, GAME.laneY + 22, yourBaseHP,  GAME.yourBaseHPMax,  true);

    // spawners (oak / mirrorball)
    drawSpawner(oakX(),    GAME.laneY + 24, IMG_ITEM.oak,        170);
    drawSpawner(mirrorX(), GAME.laneY + 24, IMG_ITEM.mirrorball, 150);

    // units
    for (const e of enemyUnits) drawUnit(e);
    for (const u of yourUnits) drawUnit(u);

    drawParticles();

    // skill zone hint
    if (skillReady) {
      ctx.save();
      ctx.fillStyle = "rgba(255,220,140,.16)";
      ctx.fillRect(GAME.rightBaseX - 320, GAME.laneY - 120, 280, 150);
      ctx.restore();
    }
  }

  /* =========================
   * UI
   * ========================= */
  function ensureCdBadges() {
    for (const btn of unitBtns) {
      if (btn.querySelector(".cdBadge")) continue;
      const badge = document.createElement("div");
      badge.className = "cdBadge";
      badge.textContent = "";
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
      $btnSkill.classList.remove("disabled");
      $skillText.textContent = "ready";
    } else {
      $btnSkill.classList.add("disabled");
      $skillText.textContent = `${Math.ceil(skillLeft)}s`;
    }
  }

  /* =========================
   * Main loop
   * ========================= */
  function stepWave(dt) {
    // シンプル：敵拠点破壊でWave+1（スポナー速度が上がる）
    if (enemyBaseHP > 0 && yourBaseHP > 0) return;

    if (enemyBaseHP <= 0) {
      wave += 1;
      enemyBaseHP = GAME.enemyBaseHPMax + Math.floor((wave - 1) * 160);

      // スポーン強化：mirrorballが少し早くなる
      GAME.mirrorSpawnSec = Math.max(0.75, GAME.mirrorSpawnSec - 0.08);

      // 報酬
      candyMax = GAME.candyMaxBase + (wave - 1) * 40;
      candyRegen = GAME.candyRegenBase + (wave - 1) * 2.4;
      candy = clamp(candy + 240, 0, candyMax);

      // 盤面軽く整頓
      enemyUnits.length = 0;

      // 自軍回復
      yourBaseHP = Math.min(GAME.yourBaseHPMax, yourBaseHP + 520);
      addParticle(GAME.rightBaseX - 40, GAME.laneY - 40, 24);
    }

    if (yourBaseHP <= 0) {
      // リセット（簡単に）
      resetGame();
    }
  }

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
      stepWave(dt);
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

    // 初期スポーン速度を戻す
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

  $btnSkill.addEventListener("click", () => {
    if ($btnSkill.classList.contains("disabled")) return;
    castSkill();
  });

  $btnPause.addEventListener("click", () => {
    paused = !paused;
    $btnPause.textContent = paused ? "▶" : "⏸";
  });

  $btnReset.addEventListener("click", () => resetGame());

  /* =========================
   * Start
   * ========================= */
  fitCanvas();
  worldInitMetrics();
  window.addEventListener("resize", () => {
    fitCanvas();
    worldInitMetrics();
  });

  resetGame();
  requestAnimationFrame((t) => {
    tPrev = t;
    requestAnimationFrame(loop);
  });
})();
