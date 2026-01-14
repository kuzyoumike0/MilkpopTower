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
  const isReady = (img) => img && img.complete && img.naturalWidth > 0;

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
    return isReady(IMG_YOUR[key]) ? IMG_YOUR[key] : IMG_YOUR.bunny;
  }
  function pickEnemyImg() {
    return IMG_ENEMY.enemy;
  }

  /* =========================
   * RESULT OVERLAY (victory/lose)
   * ========================= */
  let resultOverlay = null;

  function showResult(type) {
    if (!resultOverlay) {
      resultOverlay = document.createElement("div");
      resultOverlay.style.cssText = `
        position:fixed; inset:0;
        display:flex; align-items:center; justify-content:center;
        z-index:9999;
        pointer-events:none;
      `;
      document.body.appendChild(resultOverlay);
    }

    const imgSrc =
      type === "win"
        ? "./assets/ui/victory.png"
        : "./assets/ui/lose.png";

    const isLose = (type === "lose");
    resultOverlay.innerHTML = `
      <img src="${imgSrc}" style="
        max-width:70vw;
        max-height:70vh;
        image-rendering: pixelated;
        animation: popIn .35s ease-out${isLose ? ", wiggleLose .9s ease-in-out infinite" : ""};
      ">
    `;
  }

  function hideResult() {
    if (resultOverlay) resultOverlay.innerHTML = "";
  }

  (function injectResultStyle(){
    if (document.getElementById("resultStyle")) return;
    const s = document.createElement("style");
    s.id = "resultStyle";
    s.textContent = `
      @keyframes popIn {
        0%   { transform: scale(0.6); opacity:0; }
        60%  { transform: scale(1.05); opacity:1; }
        100% { transform: scale(1); }
      }
      @keyframes wiggleLose {
        0%   { transform: translateX(0) rotate(0deg); }
        20%  { transform: translateX(-6px) rotate(-2deg); }
        40%  { transform: translateX(6px) rotate(2deg); }
        60%  { transform: translateX(-4px) rotate(-1.5deg); }
        80%  { transform: translateX(4px) rotate(1.5deg); }
        100% { transform: translateX(0) rotate(0deg); }
      }
    `;
    document.head.appendChild(s);
  })();

  /* =========================
   * AUDIO (BGM / SE) + sliders
   * ========================= */
  const AudioState = {
    bgmVol: Number(localStorage.getItem("bgmVol") ?? 0.45),
    seVol:  Number(localStorage.getItem("seVol")  ?? 0.7),
  };

  const BGM = new Audio("./assets/bgm/8-bit_Aggressive1.mp3");
  BGM.loop = true;
  BGM.volume = AudioState.bgmVol;

  let bgmUnlocked = false;
  function unlockBgm() {
    if (bgmUnlocked) return;
    bgmUnlocked = true;
    if (AudioState.bgmVol <= 0) return;
    BGM.volume = AudioState.bgmVol;
    BGM.currentTime = 0;
    BGM.play().catch(()=>{});
  }
  window.addEventListener("pointerdown", unlockBgm); // 取りこぼし防止で onceしない

  function playSE(src, volMul = 1) {
    if (!src) return;
    const a = new Audio(src);
    a.volume = Math.min(1, AudioState.seVol * volMul);
    a.play().catch(()=>{});
  }

  function injectAudioSliders() {
    const hud = document.getElementById("hud");
    if (!hud || document.getElementById("audioSliders")) return;

    const wrap = document.createElement("div");
    wrap.id = "audioSliders";
    wrap.style.cssText = `
      display:flex; gap:10px; align-items:center;
      background:rgba(255,255,255,.85);
      border:1px solid rgba(255,160,200,.35);
      border-radius:14px;
      padding:6px 10px;
      box-shadow:0 6px 14px rgba(0,0,0,.10);
      font-weight:900;
      color:#5b3550;
      margin-left:10px;
    `;

    wrap.innerHTML = `
      <label style="display:flex;align-items:center;gap:6px;">
        🎵 <input id="bgmSlider" type="range" min="0" max="1" step="0.01"
          value="${AudioState.bgmVol}" style="accent-color:#ff6fae;">
      </label>
      <label style="display:flex;align-items:center;gap:6px;">
        🔊 <input id="seSlider" type="range" min="0" max="1" step="0.01"
          value="${AudioState.seVol}" style="accent-color:#ff6fae;">
      </label>
    `;

    const bottom = hud.querySelector(".hudBottom") || hud;
    bottom.appendChild(wrap);

    const bgmS = wrap.querySelector("#bgmSlider");
    const seS  = wrap.querySelector("#seSlider");

    bgmS.oninput = () => {
      AudioState.bgmVol = Number(bgmS.value);
      localStorage.setItem("bgmVol", String(AudioState.bgmVol));
      BGM.volume = AudioState.bgmVol;

      if (AudioState.bgmVol <= 0) {
        BGM.pause();
        return;
      }
      if (bgmUnlocked && !lockedWin && !paused && BGM.paused) {
        BGM.play().catch(()=>{});
      }
    };

    seS.oninput = () => {
      AudioState.seVol = Number(seS.value);
      localStorage.setItem("seVol", String(AudioState.seVol));
      playSE("./assets/se/pop.mp3", 0.5);
    };
  }

  /* =========================
   * Stage / Flow
   * ========================= */
  const stage = createStage();
  const flow  = createStageFlow();

  /* =========================
   * Game Config
   * ========================= */
  const GAME = {
    yourBaseHPMax: 2200,
    candyMaxBase: 500,
    candyRegenBase: 32,
    oakSpawnSec: 3.2,
    maxUnitsEachSide: 34,
  };

  const UNIT_DEFS = {
    babybunny:{ cost: 90,  hp:120, atk:16, range:24, speed:60, atkCd:0.55, size:24, spawnCd:1.8 },
    bunny:    { cost:160,  hp:220, atk:22, range:26, speed:52, atkCd:0.62, size:26, spawnCd:2.6 },
    bunny3:   { cost:240,  hp:320, atk:28, range:28, speed:46, atkCd:0.70, size:28, spawnCd:3.4 },
    bunny4:   { cost:340,  hp:420, atk:34, range:30, speed:42, atkCd:0.78, size:30, spawnCd:4.4 },
    bunny5:   { cost:460,  hp:560, atk:42, range:34, speed:38, atkCd:0.86, size:32, spawnCd:5.6 },
    reabunny: { cost:620,  hp:520, atk:46, range:140,speed:34, atkCd:0.95, size:32, spawnCd:7.2 },
  };

  function enemyStatsForStage(cfg) {
    return {
      hp: Math.floor(160 * cfg.enemyMulHP),
      atk: Math.floor(18  * cfg.enemyMulATK),
      speed: 48 + cfg.id * 2,
      atkCd: Math.max(0.45, 0.65 - cfg.id * 0.02),
      size: 26,
      range: 24,
    };
  }

  /* =========================
   * Helpers
   * ========================= */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);

  /* =========================
   * Particles
   * - break explosion/sparkle
   * - win: confetti
   * - lose: smoke
   * ========================= */
  const particles = [];

  function spawnBreakParticles(side){
    const x = (side === "mirror") ? stage.mirrorX() : stage.oakX();
    const y = stage.ST.laneY - 30;

    // boom
    for (let i = 0; i < 34; i++) {
      const ang = rand(-Math.PI * 0.9, Math.PI * 0.9);
      const sp  = rand(140, 420);
      particles.push({
        type:"boom", x, y,
        vx: Math.cos(ang)*sp,
        vy: Math.sin(ang)*sp - rand(80,180),
        r: rand(3,10),
        life: rand(0.35,0.70),
        t:0,
        col: (Math.random()<0.45) ? "rgba(255,120,190,1)" :
             (Math.random()<0.75) ? "rgba(255,210,120,1)" :
                                    "rgba(255,255,255,1)"
      });
    }
    // sparkle
    for (let i = 0; i < 22; i++) {
      const ang = rand(-Math.PI, Math.PI);
      const sp  = rand(70, 250);
      particles.push({
        type:"spark", x, y,
        vx: Math.cos(ang)*sp,
        vy: Math.sin(ang)*sp - rand(40,120),
        s: rand(6,14),
        life: rand(0.55,1.10),
        t:0,
        col: (Math.random()<0.6) ? "rgba(255,255,255,1)" : "rgba(255,240,160,1)"
      });
    }
    // ring
    particles.push({ type:"ring", x, y, vx:0, vy:0, r:8, life:0.55, t:0, col:"rgba(255,255,255,1)" });
  }

  // ✅ 勝利：紙吹雪（上からひらひら落ちる）
  function spawnConfetti() {
    const w = cv.getBoundingClientRect().width;
    const h = cv.getBoundingClientRect().height;

    for (let i = 0; i < 90; i++) {
      particles.push({
        type:"confetti",
        x: rand(0, w),
        y: rand(-h*0.2, -10),
        vx: rand(-40, 40),
        vy: rand(120, 260),
        rot: rand(0, Math.PI*2),
        vr: rand(-5, 5),
        s: rand(6, 14),
        life: rand(1.3, 2.2),
        t:0,
        // パステル
        col: [
          "rgba(255,120,190,1)",
          "rgba(120,200,255,1)",
          "rgba(255,230,140,1)",
          "rgba(170,255,190,1)",
          "rgba(255,170,130,1)",
          "rgba(255,255,255,1)"
        ][(Math.random()*6)|0]
      });
    }
  }

  // ✅ 敗北：黒い煙（もくもく上に）
  function spawnSmoke() {
    const x = stage.oakX();
    const y = stage.ST.laneY - 25;

    for (let i = 0; i < 46; i++) {
      particles.push({
        type:"smoke",
        x: x + rand(-40,40),
        y: y + rand(-10,10),
        vx: rand(-25,25),
        vy: rand(-80,-160),
        r: rand(10, 26),
        grow: rand(18, 40),
        life: rand(1.1, 1.8),
        t:0,
        col: "rgba(20,20,25,1)"
      });
    }
  }

  function updateParticles(dt){
    const g = 900;
    const w = cv.getBoundingClientRect().width;
    const h = cv.getBoundingClientRect().height;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }

      if (p.type === "ring") {
        p.r += 420 * dt;
        continue;
      }

      if (p.type === "smoke") {
        p.vx *= (1 - 0.9*dt);
        p.vy *= (1 - 0.4*dt);
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        p.r += p.grow*dt;
        continue;
      }

      if (p.type === "confetti") {
        p.vy += 220 * dt; // 軽い重力
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.rot += p.vr * dt;

        // 画面外で消えやすく
        if (p.y > h + 80 || p.x < -80 || p.x > w + 80) {
          p.t = p.life;
        }
        continue;
      }

      // boom / spark
      p.vy += g * dt * (p.type === "spark" ? 0.35 : 1.0);
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
    }
  }

  function drawParticles(){
    if (!particles.length) return;

    // ① 光系（爆発/きらきら/リング）
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      if (p.type !== "boom" && p.type !== "spark" && p.type !== "ring") continue;
      const k = 1 - (p.t / p.life);
      const alpha = Math.max(0, Math.min(1, k));

      if (p.type === "boom") {
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = p.col.replace(",1)", `,${alpha})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.8 + (1 - k) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "spark") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.col.replace(",1)", `,${alpha})`);
        ctx.lineWidth = 2;
        const s = p.s * (0.7 + (1 - k) * 0.7);
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
        ctx.stroke();
      } else if (p.type === "ring") {
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = p.col.replace(",1)", `,${alpha})`);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ② 通常系（紙吹雪/煙）
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (const p of particles) {
      const k = 1 - (p.t / p.life);
      const alpha = Math.max(0, Math.min(1, k));

      if (p.type === "confetti") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.col.replace(",1)", `,${alpha})`);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // ひらひら（縦をsinで変える）
        const w = p.s;
        const hh = p.s * (0.45 + 0.55 * Math.abs(Math.sin(p.rot*2)));
        ctx.fillRect(-w/2, -hh/2, w, hh);
        ctx.restore();
      }

      if (p.type === "smoke") {
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = p.col.replace(",1)", `,${alpha})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.globalAlpha = 1;
  }

  /* =========================
   * Shake / Break
   * ========================= */
  function kickShake(u, amp = 4, time = 0.14){
    if (!u) return;
    u.shakeT = Math.max(u.shakeT || 0, time);
    u.shakeA = Math.max(u.shakeA || 0, amp);
  }

  const BASE_BREAK = {
    time: 1.25,    // 端到達 → 破壊完了まで
    shakeAmp: 6,   // 破壊中の揺れ
  };
  let baseBreaking = false;
  let baseBreakSide = null; // "mirror" | "oak"
  let baseBreakTimer = 0;

  function startBaseBreak(side, breakerUnit){
    if (baseBreaking || lockedWin) return;
    baseBreaking = true;
    baseBreakSide = side;
    baseBreakTimer = BASE_BREAK.time;

    if (breakerUnit) {
      breakerUnit.breaking = true;
      breakerUnit.breakT = BASE_BREAK.time;
      breakerUnit.breakSide = side;
      kickShake(breakerUnit, BASE_BREAK.shakeAmp, 0.25);
    }
  }

  /* =========================
   * State
   * ========================= */
  let paused = false;
  let tPrev = performance.now();

  let stageCfg = flow.loadStage(1);
  let stageId  = stageCfg.id;

  let mirrorHPMax = stageCfg.mirrorHP;
  let mirrorHP    = stageCfg.mirrorHP;

  let yourBaseHPMax = GAME.yourBaseHPMax;
  let yourBaseHP    = yourBaseHPMax;

  let candyMax   = GAME.candyMaxBase;
  let candy      = 220;
  let candyRegen = GAME.candyRegenBase;

  // skill（軽め）
  const SKILL = { cd: 9, dmg: 24, push: 20 };
  let skillReady = true;
  let skillLeft = 0;

  const yourUnits  = [];
  const enemyUnits = [];
  const spawnCdLeft = Object.create(null);

  let oakTimer = 0;
  let mirrorTimer = 0;

  let lockedWin = false;

  /* =========================
   * Units
   * ========================= */
  function makeYourUnit(key, x) {
    const d = UNIT_DEFS[key];
    return {
      side:"your",
      key, x,
      y: stage.ST.laneY,
      hp:d.hp,
      hpMax:d.hp,
      atk:d.atk,
      range:d.range,
      speed:d.speed,
      atkCd:d.atkCd,
      cdLeft:0,
      size:d.size,

      shakeT:0,
      shakeA:0,

      breaking:false,
      breakT:0,
      breakSide:null,
    };
  }

  function spawnYour(key) {
    const d = UNIT_DEFS[key];
    if (!d) return;
    if (lockedWin) return;
    if (candy < d.cost) return;
    if ((spawnCdLeft[key] || 0) > 0) return;

    candy -= d.cost;
    spawnCdLeft[key] = d.spawnCd;
    yourUnits.push(makeYourUnit(key, stage.oakX() - 40));
    playSE("./assets/se/pop.mp3", 0.9);
  }

  function spawnFromOakAuto() {
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;
    yourUnits.push(makeYourUnit("bunny", stage.oakX() - 40));
  }

  function spawnFromMirrorball() {
    if (enemyUnits.length >= GAME.maxUnitsEachSide) return;
    const s = enemyStatsForStage(stageCfg);
    enemyUnits.push({
      side:"enemy",
      x: stage.mirrorX() + 60,
      y: stage.ST.laneY,
      hp:s.hp,
      hpMax:s.hp,
      atk:s.atk,
      range:s.range,
      speed:s.speed,
      atkCd:s.atkCd,
      cdLeft:0,
      size:s.size,

      shakeT:0,
      shakeA:0,

      breaking:false,
      breakT:0,
      breakSide:null,
    });
  }

  function updateUnit(u, dt) {
    // shake decay
    if (u.shakeT > 0) u.shakeT = Math.max(0, u.shakeT - dt);

    // breaking motion stops movement
    if (u.breaking) {
      u.breakT = Math.max(0, u.breakT - dt);
      kickShake(u, BASE_BREAK.shakeAmp, 0.12);
      return;
    }

    u.cdLeft = Math.max(0, u.cdLeft - dt);

    const isYour = u.side === "your";
    const dir = isYour ? -1 : 1;
    const targets = isYour ? enemyUnits : yourUnits;
    const baseX = isYour ? stage.mirrorX() : stage.oakX();

    let target = null;
    let best = 1e9;
    for (const t of targets) {
      const d = Math.abs(u.x - t.x);
      if (d < best) { best = d; target = t; }
    }

    const tx = target ? target.x : baseX;
    const dist = Math.abs(u.x - tx);

    if (dist <= u.range) {
      if (u.cdLeft <= 0) {
        if (target) {
          target.hp -= u.atk;

          // ✅ 接触ヒット揺れ
          kickShake(u, 3.5, 0.10);
          kickShake(target, 4.5, 0.12);
        } else {
          // ✅ 拠点に届いた＝破壊モーション開始
          kickShake(u, 5.5, 0.16);
          if (isYour) startBaseBreak("mirror", u); // 勝利側
          else       startBaseBreak("oak", u);     // 敗北側
        }
        u.cdLeft = u.atkCd;
      }
    } else {
      u.x += dir * u.speed * dt;
    }
  }

  function cleanupDead() {
    for (let i = enemyUnits.length - 1; i >= 0; i--) {
      if (enemyUnits[i].hp <= 0) {
        enemyUnits.splice(i, 1);
        candy = clamp(candy + 18, 0, candyMax);
      }
    }
    for (let i = yourUnits.length - 1; i >= 0; i--) {
      if (yourUnits[i].hp <= 0) yourUnits.splice(i, 1);
    }
  }

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
      spawnFromOakAuto();
    }

    mirrorTimer += dt;
    if (mirrorTimer >= stageCfg.mirrorSpawnSec) {
      mirrorTimer = 0;
      spawnFromMirrorball();
    }
  }

  function tryStartBgm(fromRestart = false) {
    if (!bgmUnlocked) return;
    if (AudioState.bgmVol <= 0) return;
    BGM.volume = AudioState.bgmVol;
    if (fromRestart) BGM.currentTime = 0;
    if (BGM.paused && !paused && !lockedWin) BGM.play().catch(()=>{});
  }

  function useSkill() {
    if (lockedWin) return;
    if (!skillReady) return;

    for (const e of enemyUnits) {
      e.hp -= SKILL.dmg;
      e.x -= SKILL.push;
      kickShake(e, 4.2, 0.12);
    }
    playSE("./assets/se/pop.mp3", 0.6);

    skillReady = false;
    skillLeft = SKILL.cd;
    if ($skillText) $skillText.textContent = `${SKILL.cd}s`;
  }

  function checkWinLose() {
    // 勝利
    if (!lockedWin && mirrorHP <= 0) {
      lockedWin = true;
      BGM.pause();

      // ✅ 勝利：紙吹雪
      spawnConfetti();

      showResult("win");

      setTimeout(() => {
        hideResult();
        flow.showWin(cfg => loadStage(cfg));
      }, 1200);
    }

    // 敗北
    if (!lockedWin && yourBaseHP <= 0) {
      lockedWin = true;
      BGM.pause();

      // ✅ 敗北：黒い煙
      spawnSmoke();

      showResult("lose");

      setTimeout(() => {
        hideResult();
        loadStage(stageCfg);
      }, 1200);
    }
  }

  function loadStage(cfg) {
    stageCfg = cfg;
    stageId  = cfg.id;

    mirrorHPMax = cfg.mirrorHP;
    mirrorHP    = cfg.mirrorHP;

    yourBaseHP  = yourBaseHPMax;

    candy = 220;
    yourUnits.length = 0;
    enemyUnits.length = 0;
    for (const k in spawnCdLeft) delete spawnCdLeft[k];

    oakTimer = 0;
    mirrorTimer = 0;

    lockedWin = false;

    skillReady = true;
    skillLeft = 0;
    if ($skillText) $skillText.textContent = "ready";

    // ✅ base break reset
    baseBreaking = false;
    baseBreakSide = null;
    baseBreakTimer = 0;

    tryStartBgm(true);
  }

  /* =========================
   * Rendering
   * ========================= */
  function drawUnit(u) {
    const img = (u.side === "your") ? pickYourImg(u.key) : pickEnemyImg();
    const s = u.size * 2.2;

    // shake offsets
    const a = (u.shakeT > 0) ? (u.shakeA || 0) : 0;
    const ox = (a > 0) ? (Math.sin(performance.now() * 0.06) * a) : 0;
    const oy = (a > 0) ? (Math.cos(performance.now() * 0.07) * (a * 0.35)) : 0;

    // breaking visual
    const isBreak = !!u.breaking;
    const scale = isBreak ? (1 + 0.05 * Math.sin(performance.now() * 0.03)) : 1;

    ctx.save();
    ctx.translate(u.x + ox, u.y + oy);

    if (isBreak) {
      const rot = Math.sin(performance.now() * 0.04) * 0.06;
      ctx.rotate(rot);
    }

    ctx.scale(scale, scale);
    ctx.drawImage(img, -s/2, -s, s, s);
    ctx.restore();
  }

  function render() {
    stage.render(ctx, cv, { oak: ITEM.oak, mirrorball: ITEM.mirrorball }, {
      stageId,
      mirrorHP,
      mirrorHPMax,
      yourBaseHP,
      yourBaseHPMax,
    });

    enemyUnits.forEach(drawUnit);
    yourUnits.forEach(drawUnit);

    // ✅ particles on top
    drawParticles();
  }

  /* =========================
   * UI update
   * ========================= */
  function refreshUI() {
    $waveText.textContent = `${stageId}`;
    $yourHpText.textContent = Math.max(0, yourBaseHP | 0);
    $enemyHpText.textContent = Math.max(0, mirrorHP | 0);

    $candyText.textContent = `${candy | 0}/${candyMax}`;
    $candyBar.style.width = `${(candy / candyMax) * 100}%`;

    unitBtns.forEach(b => {
      const k = b.dataset.unit;
      const d = UNIT_DEFS[k];
      const cd = spawnCdLeft[k] || 0;
      const ok = !!d && candy >= d.cost && cd <= 0 && !lockedWin;
      b.classList.toggle("disabled", !ok);
      b.disabled = !ok;
    });

    if ($skillText) {
      if (skillReady) $skillText.textContent = "ready";
      else $skillText.textContent = `${Math.ceil(skillLeft)}s`;
    }
  }

  /* =========================
   * Loop
   * ========================= */
  function loop(t) {
    const dt = Math.min(0.05, (t - tPrev) / 1000);
    tPrev = t;

    // particles update always（勝敗演出中も動く）
    updateParticles(dt);

    if (!paused && !lockedWin) {
      updateEconomy(dt);

      // ✅ 破壊演出中はスポーン止める（気持ちいい）
      if (!baseBreaking) updateSpawners(dt);

      yourUnits.forEach(u => updateUnit(u, dt));
      enemyUnits.forEach(u => updateUnit(u, dt));
      cleanupDead();

      // ✅ base break countdown
      if (baseBreaking) {
        baseBreakTimer = Math.max(0, baseBreakTimer - dt);
        if (baseBreakTimer <= 0) {
          // 破壊完了で爆発/きらきら
          spawnBreakParticles(baseBreakSide);

          if (baseBreakSide === "mirror") {
            mirrorHP = 0;      // 勝利へ
          } else {
            yourBaseHP = 0;    // 敗北へ
          }

          baseBreaking = false;
          baseBreakSide = null;
        }
      }

      checkWinLose();
    }

    render();
    refreshUI();

    tryStartBgm(false);
    requestAnimationFrame(loop);
  }

  /* =========================
   * Events
   * ========================= */
  unitBtns.forEach(b => b.onclick = () => spawnYour(b.dataset.unit));

  $btnPause.onclick = () => {
    paused = !paused;
    if (paused) BGM.pause();
    else tryStartBgm(false);
  };

  $btnReset.onclick = () => {
    BGM.pause();
    loadStage(stageCfg);
  };

  if ($btnSkill) $btnSkill.onclick = () => useSkill();

  flow.onSelect(cfg => {
    BGM.pause();
    loadStage(cfg);
  });

  /* =========================
   * Boot
   * ========================= */
  fitCanvas();
  stage.resize(cv);
  injectAudioSliders();

  loadStage(stageCfg);

  requestAnimationFrame((tt) => {
    tPrev = tt;
    loop(tt);
  });

  window.addEventListener("resize", () => {
    fitCanvas();
    stage.resize(cv);
  });
})();
