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
    return isReady(IMG_YOUR[key]) ? IMG_YOUR[key] : IMG_YOUR.bunny;
  }
  function pickEnemyImg() {
    return IMG_ENEMY.enemy;
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
    return {
      hp: Math.floor(160 * stageCfg.enemyMulHP),
      atk: Math.floor(18 * stageCfg.enemyMulATK),
      speed: 48 + stageCfg.id * 2,
      atkCd: Math.max(0.45, 0.65 - stageCfg.id * 0.02),
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
  let stageId = stageCfg.id;

  let mirrorHPMax = stageCfg.mirrorHP;
  let mirrorHP = stageCfg.mirrorHP;

  let yourBaseHPMax = GAME.yourBaseHPMax;
  let yourBaseHP = yourBaseHPMax;

  let candyMax = GAME.candyMaxBase;
  let candy = 220;
  let candyRegen = GAME.candyRegenBase;

  let skillReady = true;
  let skillLeft = 0;

  const yourUnits = [];
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
      side:"your", key, x,
      y: stage.ST.laneY,
      hp:d.hp, hpMax:d.hp,
      atk:d.atk, range:d.range,
      speed:d.speed, atkCd:d.atkCd, cdLeft:0,
      size:d.size, knock:d.knock||0
    };
  }

  function spawnYour(key) {
    const d = UNIT_DEFS[key];
    if (!d || candy < d.cost) return;
    if ((spawnCdLeft[key]||0)>0) return;

    candy -= d.cost;
    spawnCdLeft[key] = d.spawnCd;
    yourUnits.push(makeYourUnit(key, stage.oakX() - 40));
  }

  function spawnFromOak() {
    if (yourUnits.length >= GAME.maxUnitsEachSide) return;
    yourUnits.push(makeYourUnit("bunny", stage.oakX() - 40));
  }

  function spawnFromMirrorball() {
    if (enemyUnits.length >= GAME.maxUnitsEachSide) return;
    const s = enemyStatsForStage(stageCfg);
    enemyUnits.push({
      side:"enemy",
      x:stage.mirrorX()+60,
      y:stage.ST.laneY,
      hp:s.hp, hpMax:s.hp,
      atk:s.atk, range:s.range,
      speed:s.speed, atkCd:s.atkCd, cdLeft:0,
      size:s.size
    });
  }

  function updateUnit(u,dt){
    u.cdLeft=Math.max(0,u.cdLeft-dt);
    const isYour=u.side==="your";
    const dir=isYour?-1:1;
    const targets=isYour?enemyUnits:yourUnits;
    const baseX=isYour?stage.mirrorX():stage.oakX();

    let target=null, best=1e9;
    for(const t of targets){
      const d=Math.abs(u.x-t.x);
      if(d<best){best=d;target=t;}
    }

    const tx=target?target.x:baseX;
    const dist=Math.abs(u.x-tx);
    if(dist<=u.range){
      if(u.cdLeft<=0){
        if(target) target.hp-=u.atk;
        else isYour ? mirrorHP-=u.atk : yourBaseHP-=u.atk;
        u.cdLeft=u.atkCd;
      }
    }else{
      u.x+=dir*u.speed*dt;
    }
  }

  /* =========================
   * Game loop helpers
   * ========================= */
  function cleanupDead(){
    for(let i=enemyUnits.length-1;i>=0;i--){
      if(enemyUnits[i].hp<=0){
        enemyUnits.splice(i,1);
        candy=clamp(candy+18,0,candyMax);
      }
    }
    for(let i=yourUnits.length-1;i>=0;i--){
      if(yourUnits[i].hp<=0) yourUnits.splice(i,1);
    }
  }

  function updateEconomy(dt){
    candy=clamp(candy+candyRegen*dt,0,candyMax);
    for(const k in spawnCdLeft){
      spawnCdLeft[k]=Math.max(0,spawnCdLeft[k]-dt);
    }
    if(!skillReady){
      skillLeft=Math.max(0,skillLeft-dt);
      if(skillLeft<=0) skillReady=true;
    }
  }

  function updateSpawners(dt){
    oakTimer+=dt;
    if(oakTimer>=GAME.oakSpawnSec){
      oakTimer=0; spawnFromOak();
    }
    mirrorTimer+=dt;
    if(mirrorTimer>=stageCfg.mirrorSpawnSec){
      mirrorTimer=0; spawnFromMirrorball();
    }
  }

  function checkWinLose(){
    if(!lockedWin && mirrorHP<=0){
      lockedWin=true;
      flow.showWin(cfg=>loadStage(cfg));
    }
    if(!lockedWin && yourBaseHP<=0){
      loadStage(stageCfg);
    }
  }

  function loadStage(cfg){
    stageCfg=cfg;
    stageId=cfg.id;
    mirrorHPMax=cfg.mirrorHP;
    mirrorHP=cfg.mirrorHP;
    yourBaseHP=yourBaseHPMax;
    candy=220;
    yourUnits.length=0;
    enemyUnits.length=0;
    for(const k in spawnCdLeft) delete spawnCdLeft[k];
    oakTimer=mirrorTimer=0;
    lockedWin=false;
  }

  /* =========================
   * Rendering
   * ========================= */
  function drawUnit(u){
    const img=u.side==="your"?pickYourImg(u.key):pickEnemyImg();
    const s=u.size*2.2;
    ctx.drawImage(img,u.x-s/2,u.y-s,s,s);
  }

  function render(){
    stage.render(ctx,cv,{oak:ITEM.oak,mirrorball:ITEM.mirrorball},{
      stageId, mirrorHP, mirrorHPMax, yourBaseHP, yourBaseHPMax
    });
    enemyUnits.forEach(drawUnit);
    yourUnits.forEach(drawUnit);
  }

  /* =========================
   * UI
   * ========================= */
  function refreshUI(){
    $waveText.textContent=`${stageId}`;
    $yourHpText.textContent=Math.max(0,yourBaseHP|0);
    $enemyHpText.textContent=Math.max(0,mirrorHP|0);
    $candyText.textContent=`${candy|0}/${candyMax}`;
    $candyBar.style.width=`${candy/candyMax*100}%`;

    unitBtns.forEach(b=>{
      const k=b.dataset.unit;
      const d=UNIT_DEFS[k];
      const cd=spawnCdLeft[k]||0;
      b.classList.toggle("disabled",!(d&&candy>=d.cost&&cd<=0&&!lockedWin));
    });
  }

  /* =========================
   * Loop
   * ========================= */
  function loop(t){
    const dt=Math.min(0.05,(t-tPrev)/1000);
    tPrev=t;

    if(!paused && !lockedWin){
      updateEconomy(dt);
      updateSpawners(dt);
      yourUnits.forEach(u=>updateUnit(u,dt));
      enemyUnits.forEach(u=>updateUnit(u,dt));
      cleanupDead();
      checkWinLose();
    }

    render();
    refreshUI();
    requestAnimationFrame(loop);
  }

  /* =========================
   * Events
   * ========================= */
  unitBtns.forEach(b=>b.onclick=()=>spawnYour(b.dataset.unit));
  $btnPause.onclick=()=>paused=!paused;
  $btnReset.onclick=()=>loadStage(stageCfg);

  flow.onSelect(cfg=>loadStage(cfg));

  /* =========================
   * Boot
   * ========================= */
  fitCanvas();
  stage.resize(cv);
  loadStage(stageCfg);
  requestAnimationFrame(t=>{tPrev=t;loop(t);});

  window.addEventListener("resize",()=>{
    fitCanvas();
    stage.resize(cv);
  });
})();
