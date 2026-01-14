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
    cv.width  = Math.floor(rect.width  * dpr);
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

  const unitBtns = Array.from(document.querySelectorAll(".unitBtn"));

  /* =========================
   * Assets
   * ========================= */
  function loadImage(src){
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

  function pickYourImg(key){
    return isReady(IMG_YOUR[key]) ? IMG_YOUR[key] : IMG_YOUR.bunny;
  }
  function pickEnemyImg(){
    return IMG_ENEMY.enemy;
  }

  /* =========================
   * AUDIO (BGM / SE)
   * ========================= */
  const AudioState = {
    bgmVol: Number(localStorage.getItem("bgmVol") ?? 0.45),
    seVol:  Number(localStorage.getItem("seVol")  ?? 0.7),
  };

  const BGM = new Audio("./assets/bgm/8-bit_Aggressive1.mp3");
  BGM.loop = true;
  BGM.volume = AudioState.bgmVol;

  let bgmUnlocked = false;

  // ★ 最重要：初回ユーザー操作で即BGMを鳴らす
  function unlockBgm(){
    if (bgmUnlocked) return;
    bgmUnlocked = true;

    if (AudioState.bgmVol <= 0) return;

    BGM.volume = AudioState.bgmVol;
    BGM.currentTime = 0;
    BGM.play().catch(()=>{});
  }
  window.addEventListener("pointerdown", unlockBgm);

  function playSE(src, volMul = 1){
    if (!src) return;
    const a = new Audio(src);
    a.volume = Math.min(1, AudioState.seVol * volMul);
    a.play().catch(()=>{});
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

  function enemyStatsForStage(cfg){
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
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let paused=false;
  let tPrev=performance.now();

  let stageCfg=flow.loadStage(1);
  let stageId=stageCfg.id;

  let mirrorHP=stageCfg.mirrorHP;
  let mirrorHPMax=stageCfg.mirrorHP;

  let yourBaseHP=GAME.yourBaseHPMax;

  let candy=220;
  let candyMax=GAME.candyMaxBase;

  const yourUnits=[];
  const enemyUnits=[];
  const spawnCdLeft={};

  let oakTimer=0;
  let mirrorTimer=0;
  let lockedWin=false;

  /* =========================
   * Units
   * ========================= */
  function makeYourUnit(key,x){
    const d=UNIT_DEFS[key];
    return {
      side:"your", key, x,
      y:stage.ST.laneY,
      hp:d.hp,
      atk:d.atk,
      range:d.range,
      speed:d.speed,
      atkCd:d.atkCd,
      cdLeft:0,
      size:d.size
    };
  }

  function spawnYour(key){
    const d=UNIT_DEFS[key];
    if(!d||candy<d.cost||(spawnCdLeft[key]||0)>0||lockedWin) return;
    candy-=d.cost;
    spawnCdLeft[key]=d.spawnCd;
    yourUnits.push(makeYourUnit(key,stage.oakX()-40));
    playSE("./assets/se/pop.mp3",0.9);
  }

  /* =========================
   * Loop
   * ========================= */
  function loop(t){
    const dt=Math.min(0.05,(t-tPrev)/1000);
    tPrev=t;

    if(!paused&&!lockedWin){
      candy=clamp(candy+32*dt,0,candyMax);
    }

    stage.render(ctx,cv,{oak:ITEM.oak,mirrorball:ITEM.mirrorball},{
      stageId, mirrorHP, mirrorHPMax, yourBaseHP, yourBaseHPMax:GAME.yourBaseHPMax
    });

    yourUnits.forEach(u=>{
      const img=pickYourImg(u.key);
      const s=u.size*2.2;
      ctx.drawImage(img,u.x-s/2,u.y-s,s,s);
    });

    $waveText.textContent=`${stageId}`;
    $yourHpText.textContent=Math.max(0,yourBaseHP|0);
    $enemyHpText.textContent=Math.max(0,mirrorHP|0);
    $candyText.textContent=`${candy|0}/${candyMax}`;
    $candyBar.style.width=`${candy/candyMax*100}%`;

    requestAnimationFrame(loop);
  }

  /* =========================
   * Events
   * ========================= */
  unitBtns.forEach(b=>b.onclick=()=>spawnYour(b.dataset.unit));

  $btnPause.onclick=()=>{
    paused=!paused;
    if(paused){
      BGM.pause();
    }else if(bgmUnlocked&&AudioState.bgmVol>0){
      BGM.play().catch(()=>{});
    }
  };

  $btnReset.onclick=()=>{
    BGM.pause();
    BGM.currentTime=0;
  };

  flow.onSelect(cfg=>{
    stageCfg=cfg;
    stageId=cfg.id;
    mirrorHP=cfg.mirrorHP;
    mirrorHPMax=cfg.mirrorHP;
    if(bgmUnlocked&&AudioState.bgmVol>0){
      BGM.currentTime=0;
      BGM.play().catch(()=>{});
    }
  });

  /* =========================
   * Boot
   * ========================= */
  fitCanvas();
  stage.resize(cv);

  requestAnimationFrame(t=>{
    tPrev=t;
    loop(t);
  });

  window.addEventListener("resize",()=>{
    fitCanvas();
    stage.resize(cv);
  });
})();
