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

  // ✅ 自動再生制限対策：最初の操作で“その場で鳴らす”
  function unlockBgm() {
    if (bgmUnlocked) return;
    bgmUnlocked = true;

    if (AudioState.bgmVol <= 0) return;
    BGM.volume = AudioState.bgmVol;
    BGM.currentTime = 0;
    BGM.play().catch(() => {});
  }
  window.addEventListener("pointerdown", unlockBgm); // once を付けない（取りこぼし防止）

  function playSE(src, volMul = 1) {
    if (!src) return;
    const a = new Audio(src);
    a.volume = Math.min(1, AudioState.seVol * volMul);
    a.play().catch(() => {});
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

    // hudBottom の右側に添える（見た目が綺麗）
    const bottom = hud.querySelector(".hudBottom") || hud;
    bottom.appendChild(wrap);

    const bgmS = wrap.querySelector("#bgmSlider");
    const seS  = wrap.querySelector("#seSlider");

    bgmS.oninput = () => {
      AudioState.bgmVol = Number(bgmS.value);
      localStorage.setItem("bgmVol", String(AudioState.bgmVol));
      BGM.volume = AudioState.bgmVol;

      // すでに解除済みで、音量>0なら鳴らす
      if (bgmUnlocked && !lockedWin && !paused && AudioState.bgmVol > 0) {
        if (BGM.paused) BGM.play().catch(()=>{});
      }
      if (AudioState.bgmVol <= 0) BGM.pause();
    };

    seS.oninput = () => {
      AudioState.seVol = Number(seS.value);
      localStorage.setItem("seVol", String(AudioState.seVol));
      // 試聴（無くても進行止まらないようにcatch）
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

  // ユニット定義（出撃クールタイム＝spawnCd）
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
   * State
   * ========================= */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
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

  // スキル（簡易）：敵全員に小ダメ＆少しノックバック（見た目変わる）
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
      side: "your",
      key, x,
      y: stage.ST.laneY,
      hp: d.hp,
      hpMax: d.hp,
      atk: d.atk,
      range: d.range,
      speed: d.speed,
      atkCd: d.atkCd,
      cdLeft: 0,
      size: d.size,
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

    // 味方は右（oak）から左へ
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
      side: "enemy",
      x: stage.mirrorX() + 60,
      y: stage.ST.laneY,
      hp: s.hp,
      hpMax: s.hp,
      atk: s.atk,
      range: s.range,
      speed: s.speed,
      atkCd: s.atkCd,
      cdLeft: 0,
      size: s.size,
    });
  }

  function updateUnit(u, dt) {
    u.cdLeft = Math.max(0, u.cdLeft - dt);

    const isYour = u.side === "your";
    const dir = isYour ? -1 : 1;
    const targets = isYour ? enemyUnits : yourUnits;
    const baseX = isYour ? stage.mirrorX() : stage.oakX();

    // 一番近い相手
    let target = null;
    let best = 1e9;
    for (const t of targets) {
      const d = Math.abs(u.x - t.x);
      if (d < best) { best = d; target = t; }
    }

    const tx = target ? target.x : baseX;
    const dist = Math.abs(u.x - tx);

    if (dist <= u.range) {
      // attack
      if (u.cdLeft <= 0) {
        if (target) {
          target.hp -= u.atk;
        } else {
          // 拠点へ
          if (isYour) mirrorHP -= u.atk;
          else yourBaseHP -= u.atk;
        }
        u.cdLeft = u.atkCd;
      }
    } else {
      // move
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
    // candy regen
    candy = clamp(candy + candyRegen * dt, 0, candyMax);

    // spawn cooldowns
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
    // oak auto spawn
    oakTimer += dt;
    if (oakTimer >= GAME.oakSpawnSec) {
      oakTimer = 0;
      spawnFromOakAuto();
    }

    // enemy spawn from mirrorball
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

    // ステージ切替時は頭から
    if (fromRestart) BGM.currentTime = 0;
    if (BGM.paused && !paused && !lockedWin) {
      BGM.play().catch(()=>{});
    }
  }

  function checkWinLose() {
    if (!lockedWin && mirrorHP <= 0) {
      lockedWin = true;
      BGM.pause();
      playSE("./assets/se/win.mp3", 1.0);
      flow.showWin(cfg => loadStage(cfg));
    }
    if (!lockedWin && yourBaseHP <= 0) {
      BGM.pause();
      loadStage(stageCfg);
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

    tryStartBgm(true);
  }

  /* =========================
   * Skill (simple)
   * ========================= */
  function useSkill() {
    if (lockedWin) return;
    if (!skillReady) return;

    // 敵全員に軽ダメ＋押し戻し（演出がわかりやすい）
    for (const e of enemyUnits) {
      e.hp -= SKILL.dmg;
      e.x -= SKILL.push; // 左へ押す
    }

    playSE("./assets/se/pop.mp3", 0.6);

    skillReady = false;
    skillLeft = SKILL.cd;
    if ($skillText) $skillText.textContent = `${SKILL.cd.toFixed(0)}s`;
  }

  /* =========================
   * Rendering
   * ========================= */
  function drawUnit(u) {
    const img = u.side === "your" ? pickYourImg(u.key) : pickEnemyImg();
    const s = u.size * 2.2;
    ctx.drawImage(img, u.x - s / 2, u.y - s, s, s);
  }

  function render() {
    stage.render(ctx, cv, { oak: ITEM.oak, mirrorball: ITEM.mirrorball }, {
      stageId,
      mirrorHP,
      mirrorHPMax,
      yourBaseHP,
      yourBaseHPMax,
    });

    // 先に敵→味方で、手前に味方が来やすい
    enemyUnits.forEach(drawUnit);
    yourUnits.forEach(drawUnit);
  }

  /* =========================
   * UI update
   * ========================= */
  function refreshUI(dt) {
    $waveText.textContent = `${stageId}`;
    $yourHpText.textContent = Math.max(0, yourBaseHP | 0);
    $enemyHpText.textContent = Math.max(0, mirrorHP | 0);

    $candyText.textContent = `${candy | 0}/${candyMax}`;
    $candyBar.style.width = `${(candy / candyMax) * 100}%`;

    // ボタンの有効/無効
    unitBtns.forEach(b => {
      const k = b.dataset.unit;
      const d = UNIT_DEFS[k];
      const cd = spawnCdLeft[k] || 0;
      const ok = !!d && candy >= d.cost && cd <= 0 && !lockedWin;
      b.classList.toggle("disabled", !ok);
      b.disabled = !ok;
    });

    // スキル表示
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

    if (!paused && !lockedWin) {
      updateEconomy(dt);
      updateSpawners(dt);

      yourUnits.forEach(u => updateUnit(u, dt));
      enemyUnits.forEach(u => updateUnit(u, dt));

      cleanupDead();

      // スキルCD表示更新
      if (!skillReady) {
        skillLeft = Math.max(0, skillLeft - dt);
        if (skillLeft <= 0) skillReady = true;
      }

      checkWinLose();
    }

    render();
    refreshUI(dt);

    // 戦闘中は鳴ってる状態を維持
    tryStartBgm(false);

    requestAnimationFrame(loop);
  }

  /* =========================
   * Events
   * ========================= */
  unitBtns.forEach(b => b.onclick = () => spawnYour(b.dataset.unit));

  $btnPause.onclick = () => {
    paused = !paused;
    if (paused) {
      BGM.pause();
    } else {
      tryStartBgm(false);
    }
  };

  $btnReset.onclick = () => {
    BGM.pause();
    loadStage(stageCfg);
  };

  if ($btnSkill) {
    $btnSkill.onclick = () => useSkill();
  }

  // ステージ選択→ロード
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
