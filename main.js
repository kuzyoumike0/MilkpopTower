// main.js
import { createStage } from "./stage.js";
import { createStageFlow } from "./stageFlow.js";

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
  const $enemyHpText = document.getElementById("enemyHpText"); // 使わなくてもOK（残してるだけ）
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
  const ITEM = {
    oak:        loadImage("./assets/item/oak.png"),
    mirrorball: loadImage("./assets/item/mirrorball.png"),
  };

  function pickYourImg(key) {
    const img = IMG_YOUR[key] || IMG_YOUR.bunny;
    if (isReady(img)) return img;
    return isReady(IMG_YOUR.bunny) ? IMG_YOUR.bunny : null;
  }
  function pickEnemyImg() {
    return isReady(IMG_ENEMY.enemy) ? IMG_ENEMY.enemy : null;
  }

  /* =========================
   * Stage / Flow
   * ========================= */
  const stage = createStage();
  const flow  = createStageFlow();

  /* =========================
   * Config
   * ========================= */
  const GAME = {
    yourBaseHPMax: 2200,

    candyMaxBase: 500,
    candyRegenBase: 32,

    skillCd: 9,
    oakSpawnSec: 3.2,

    maxUnitsEachSide: 34,
  };

  const UNIT_DEFS = {
    babybunny:{ cost: 90,  hp:120, atk:16, range:24, speed:60, atkCd:0.55, size:24, spawnCd:1.8 },
    bunny:    { cost:160,  hp:220, atk:22, range:26, speed:52, atkCd:0.62, size:26, spawnCd:2.6 },
    bunny3:   { cost:240,  hp:320, atk:28, range:28, speed:46, atkCd:0.70, size:28, spawnCd:3.4 },
    bunny4:   { cost:340,  hp:420, atk:34, range:30, speed:42, atkCd:0.78, size:30, spawnCd:4.4, knock:8 },
    bunny5:   { cost:460,  hp:560, atk:42, range:34, speed:38, atkCd:0.86, size:32, spawnCd:5.6, knock:12 },
    reabunny: { cost:620,  hp:520, atk:46, range:140,speed:34, atkCd:0.95, size:32, spawnCd:7.2 },
  };

  function enemyStatsForStage(stageCfg) {
    // 基本値×ステージ倍率
    const base = { hp: 160, atk: 18, speed: 50, atkCd: 0.65, size: 26, range: 24 };
    return {
      hp: Math.floor(base.hp * stageCfg.enemyMulHP),
      atk: Math.floor(base.atk * stageCfg.enemyMulATK),
      speed: base.speed + Math.min(18, stageCfg.id * 1.2),
      atkCd: Math.max(0.45, base.atkCd - stageCfg.id * 0.02),
      size: base.size,
      range: base.range,
    };
  }

  /* =========================
   * State
   * ========================= */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);

  let paused = false;
  let tPrev = performance.now();

  // stage state
  let stageCfg = flow.loadStage(1);
  let stageId = stageCfg.id;

  // mirrorball (enemy base)
  let mirrorHPMax = stageCfg.mirrorHP;
  let mirrorHP = stageCfg.mirrorHP;

  // your base
  let yourBaseHPMax = GAME.yourBaseHPMax;
  let yourBaseHP = yourBaseHPMax;

  // economy
  let candyMax = GAME.candyMaxBase;
  let candy = 220;
  let candyRegen = GAME.candyRegenBase;

  // skill
  let skillReady = true;
  let skillLeft = 0;

  const yourUnits = [];
  const enemyUnits = [];
  const particles = [];

  const spawnCdLeft = Object.create(null);

  let oakTimer = 0;
  let mirrorTimer = 0;

  let lockedWin = false;

  /* =========================
   * Particles
   * ========================= */
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
  function drawParticles() {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    for (const s of particles) {
      ctx.globalAlpha = clamp(s.life / 0.55, 0, 1);
      ctx.fillRect(s.x, s.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  /* =========================
   * Units
   * ========================= */
  function makeYourUnit(key, x) {
    const d = UNIT_DEFS[key] || UNIT_DEFS.bunny;
    return {
      side: "your",
      key,
      x,
      y: stage.ST.laneY,
      hp: d.hp, hpMax: d.hp,
      atk: d.atk, range: d.range,
      speed: d.speed, atkCd: d.atkCd, cdLeft: 0,
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

    // oakの少し左から出撃
    yourUnits.push(makeYourUnit(key, stage.oakX() - 40));
    addParticle(stage.oakX() - 40, stage.ST.laneY - 30, 10);
  }

  // oak -> bunny（無料）
  function spawnFromOak() {
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;
    yourUnits.push(makeYourUnit("bunny", stage.oakX() - 40));
    addParticle(stage.oakX() - 40, stage.ST.laneY - 30, 12);
  }

  // mirrorball -> enemy
  function spawnFromMirrorball() {
    if (enemyUnits.length >= GAME.maxUnitsEachSide) return;
    const s = enemyStatsForStage(stageCfg);
    enemyUnits.push({
      side: "enemy",
      x: stage.mirrorX() + 70,
      y: stage.ST.laneY,
      hp: s.hp, hpMax: s.hp,
      atk: s.atk, range: s.range,
      speed: s.speed, atkCd: s.atkCd, cdLeft: 0,
      size: s.size
    });
    addParticle(stage.mirrorX() + 70, stage.ST.laneY - 30, 12);
  }

  function updateUnit(u, dt) {
    u.cdLeft = Math.max(0, u.cdLeft - dt);

    const isYour = u.side === "your";
    const dir = isYour ? -1 : 1;

    // ✅ 敵は「右側（oak側）」へ進む
    // ✅ 味方は「左側（mirrorball）」へ進む
    const targets = isYour ? enemyUnits : yourUnits;

    // 近接ターゲット探索
    let target = null;
    let best = 1e9;
    for (const t of targets) {
      const d = Math.abs(u.x - t.x);
      if (d < best) { best = d; target = t; }
    }

    // 拠点ターゲット
    const baseX = isYour ? stage.mirrorX() : stage.oakX();
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

          addParticle(target.x, target.y - 22, 8);
        } else {
          // ✅ 拠点を攻撃
          if (isYour) {
            // mirrorball を削る
            mirrorHP -= u.atk;
            addParticle(stage.mirrorX() + 20, stage.ST.laneY - 16, 10);
          } else {
            // oak側（自軍拠点）を削る
            yourBaseHP -= u.atk;
            addParticle(stage.oakX() - 20, stage.ST.laneY - 16, 10);
          }
        }
        u.cdLeft = u.atkCd;
      }
      return;
    }

    // move
    u.x += dir * u.speed * dt;
    u.x = clamp(u.x, stage.mirrorX() + 20, stage.oakX() - 20);
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
   * Economy / Spawners / Skill
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
    // oak: your bunny free
    oakTimer += dt;
    if (oakTimer >= GAME.oakSpawnSec) {
      oakTimer = 0;
      spawnFromOak();
    }

    // mirrorball: enemy spawn (stage dependent)
    mirrorTimer += dt;
    if (mirrorTimer >= stageCfg.mirrorSpawnSec) {
      mirrorTimer = 0;
      spawnFromMirrorball();
    }
  }

  function castSkill() {
    if (!skillReady || paused) return;
    skillReady = false;
    skillLeft = GAME.skillCd;

    // your side zone push enemies a bit
    const zoneL = stage.oakX() - 360;
    const zoneR = stage.oakX() - 60;

    for (const e of enemyUnits) {
      if (e.x < zoneL || e.x > zoneR) continue;
      e.hp -= 60;
      e.x -= 70;
      addParticle(e.x, e.y - 22, 18);
    }
  }

  /* =========================
   * Render units
   * ========================= */
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

  /* =========================
   * UI
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
    // waveText を Stage 表示に流用
    $waveText.textContent = `${stageId}`;

    // 右上 HP
    $yourHpText.textContent = `${Math.max(0, Math.floor(yourBaseHP))}`;

    // enemyHpText は mirrorHP 表示にしておく（任意）
    if ($enemyHpText) $enemyHpText.textContent = `${Math.max(0, Math.floor(mirrorHP))}`;

    $candyText.textContent = `${Math.floor(candy)}/${candyMax}`;
    $candyBar.style.width = `${(candy / candyMax) * 100}%`;

    ensureCdBadges();
    for (const b of unitBtns) {
      const key = b.dataset.unit;
      const def = UNIT_DEFS[key];
      const cd = spawnCdLeft[key] || 0;

      const ok = !!def && candy >= def.cost && cd <= 0 && !lockedWin;
      b.classList.toggle("disabled", !ok);

      const badge = b.querySelector(".cdBadge");
      if (badge) badge.textContent = cd > 0 ? `${Math.ceil(cd)}s` : "";
    }

    if (skillReady && !lockedWin) {
      $btnSkill.disabled = false;
      $skillText.textContent = "ready";
    } else if (lockedWin) {
      $btnSkill.disabled = true;
      $skillText.textContent = "locked";
    } else {
      $btnSkill.disabled = true;
      $skillText.textContent = `${Math.ceil(skillLeft)}s`;
    }
  }

  /* =========================
   * Stage Win / Lose
   * ========================= */
  function checkWinLose() {
    if (!lockedWin && mirrorHP <= 0) {
      lockedWin = true;
      // 勝利表示→次ステージへ
      flow.showWin((nextStageCfg) => {
        loadStage(nextStageCfg);
      });
    }

    if (!lockedWin && yourBaseHP <= 0) {
      // 負け：そのステージやり直し
      loadStage(stageCfg);
    }
  }

  function loadStage(newCfg) {
    stageCfg = newCfg;
    stageId = stageCfg.id;

    mirrorHPMax = stageCfg.mirrorHP;
    mirrorHP = stageCfg.mirrorHP;

    yourBaseHPMax = GAME.yourBaseHPMax;
    yourBaseHP = yourBaseHPMax;

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

    lockedWin = false;
  }

  /* =========================
   * Render
   * ========================= */
  function render() {
    stage.render(ctx, cv, { oak: ITEM.oak, mirrorball: ITEM.mirrorball }, {
      stageId,
      mirrorHP,
      mirrorHPMax,
      yourBaseHP,
      yourBaseHPMax,
    });

    for (const e of enemyUnits) drawUnit(e);
    for (const u of yourUnits) drawUnit(u);

    drawParticles();
  }

  /* =========================
   * Loop
   * ========================= */
  function loop(tNow) {
    const dt = clamp((tNow - tPrev) / 1000, 0, 0.05);
    tPrev = tNow;

    if (!paused && !lockedWin) {
      updateEconomy(dt);
      updateSpawners(dt);

      for (const u of yourUnits) updateUnit(u, dt);
      for (const e of enemyUnits) updateUnit(e, dt);

      cleanupDead();
      updateParticles(dt);
      checkWinLose();
    } else if (!paused) {
      // 勝利停止中もパーティクルだけ少し流したいなら
      updateParticles(dt);
    }

    render();
    refreshUI();
    requestAnimationFrame(loop);
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

  $btnReset.addEventListener("click", () => loadStage(stageCfg));

  /* =========================
   * Boot
   * ========================= */
  function boot() {
    fitCanvas();
    stage.resize(cv);

    // 初期ステージ
    loadStage(flow.loadStage(1));

    requestAnimationFrame((t) => {
      tPrev = t;
      requestAnimationFrame(loop);
    });
  }

  window.addEventListener("resize", () => {
    fitCanvas();
    stage.resize(cv);
  });

  boot();
})();
