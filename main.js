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
  window.addEventListener("resize", () => {
    fitCanvas();
    worldInitMetrics();
  });

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

  const $overlay = document.getElementById("overlay");
  const $ovTitle = document.getElementById("ovTitle");
  const $ovDesc  = document.getElementById("ovDesc");
  const $btnNext = document.getElementById("btnNext");
  const $btnAgain = document.getElementById("btnAgain");

  const unitBtns = Array.from(document.querySelectorAll(".unitBtn"));

  /* =========================
   * Assets
   * ========================= */
  function loadImage(src){
    const img = new Image();
    img.src = src;
    return img;
  }
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

  const isReady = img => img && img.complete && img.naturalWidth > 0;

  /* =========================
   * Game constants
   * ========================= */
  const GAME = {
    groundH: 80,
    leftBaseX: 110,
    rightBaseX: 0,
    laneY: 0,

    yourBaseHPMax: 2500,
    enemyBaseHPMax: 2200,

    candyMaxBase: 500,
    candyRegenBase: 32,

    skillCd: 9,
  };

  /* =========================
   * Unit definitions（CDあり）
   * ========================= */
  const UNIT_DEFS = {
    babybunny:{ cost:90,  hp:120, atk:16, range:24, speed:60, atkCd:0.55, size:24, spawnCd:1.8 },
    bunny:{     cost:160, hp:220, atk:22, range:26, speed:52, atkCd:0.62, size:26, spawnCd:2.6 },
    bunny3:{    cost:240, hp:320, atk:28, range:28, speed:46, atkCd:0.70, size:28, spawnCd:3.4 },
    bunny4:{    cost:340, hp:420, atk:34, range:30, speed:42, atkCd:0.78, size:30, spawnCd:4.4, knock:8 },
    bunny5:{    cost:460, hp:560, atk:42, range:34, speed:38, atkCd:0.86, size:32, spawnCd:5.6, knock:12 },
    reabunny:{  cost:620, hp:520, atk:46, range:140,speed:34, atkCd:0.95, size:32, spawnCd:7.2, projectile:true },
  };

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
  const projectiles = [];
  const particles = [];

  const spawnCdLeft = {};   // ★ 出撃クールタイム

  let spawnTimer = 0;
  let spawnRate = 1.6;
  let gameEnded = false;

  /* =========================
   * Helpers
   * ========================= */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a+Math.random()*(b-a);

  function worldInitMetrics(){
    const r=cv.getBoundingClientRect();
    GAME.rightBaseX = r.width - 110;
    GAME.laneY = r.height - GAME.groundH - 42;
  }

  /* =========================
   * Core logic
   * ========================= */
  function spawnYour(key){
    const d=UNIT_DEFS[key];
    if(!d) return;
    if((spawnCdLeft[key]||0)>0) return;
    if(candy<d.cost) return;

    candy-=d.cost;
    spawnCdLeft[key]=d.spawnCd;

    yourUnits.push({
      key,
      x:GAME.rightBaseX-40,
      y:GAME.laneY,
      hp:d.hp, hpMax:d.hp,
      atk:d.atk, range:d.range,
      speed:d.speed, atkCd:d.atkCd, cdLeft:0,
      size:d.size, knock:d.knock||0,
      projectile:!!d.projectile
    });
  }

  function spawnEnemy(){
    enemyUnits.push({
      x:GAME.leftBaseX+40,
      y:GAME.laneY,
      hp:140+wave*20,
      hpMax:140+wave*20,
      atk:18+wave*2,
      range:24,
      speed:48,
      atkCd:0.65,
      cdLeft:0,
      size:26
    });
  }

  function updateUnit(u,dt,side){
    u.cdLeft=Math.max(0,u.cdLeft-dt);
    const dir = side==="your"?-1:1;
    const targets = side==="your"?enemyUnits:yourUnits;
    const baseX = side==="your"?GAME.leftBaseX:GAME.rightBaseX;

    let target=null, best=1e9;
    for(const t of targets){
      const d=Math.abs(u.x-t.x);
      if(d<best){best=d;target=t;}
    }

    const tx = target?target.x:baseX;
    if(Math.abs(u.x-tx)<=u.range){
      if(u.cdLeft<=0){
        if(target){ target.hp-=u.atk; }
        else{ side==="your"?enemyBaseHP-=u.atk:yourBaseHP-=u.atk; }
        u.cdLeft=u.atkCd;
      }
    }else{
      u.x+=dir*u.speed*dt;
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

  /* =========================
   * Rendering
   * ========================= */
  function drawUnit(u,isYour){
    const img=isYour?IMG_YOUR[u.key]:IMG_ENEMY.enemy;
    if(isReady(img)){
      const s=u.size*2.2;
      ctx.drawImage(img,u.x-s/2,u.y-s,s,s);
    }
    const p=u.hp/u.hpMax;
    ctx.fillStyle="rgba(0,0,0,.2)";
    ctx.fillRect(u.x-22,u.y-64,44,6);
    ctx.fillStyle=isYour?"#ff4fa0":"#555";
    ctx.fillRect(u.x-22,u.y-64,44*p,6);
  }

  function render(){
    const r=cv.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    ctx.fillStyle="#fff3f8";
    ctx.fillRect(0,0,r.width,r.height);

    for(const e of enemyUnits) drawUnit(e,false);
    for(const u of yourUnits) drawUnit(u,true);
  }

  /* =========================
   * UI update
   * ========================= */
  function refreshUI(){
    $enemyHpText.textContent=Math.max(0,enemyBaseHP|0);
    $yourHpText.textContent=Math.max(0,yourBaseHP|0);
    $waveText.textContent=wave;
    $candyText.textContent=`${candy|0}/${candyMax}`;
    $candyBar.style.width=`${candy/candyMax*100}%`;

    for(const b of unitBtns){
      const k=b.dataset.unit;
      const d=UNIT_DEFS[k];
      const cd=spawnCdLeft[k]||0;
      b.classList.toggle("disabled",!(d&&candy>=d.cost&&cd<=0));
      let badge=b.querySelector(".cdBadge");
      if(!badge){
        badge=document.createElement("div");
        badge.className="cdBadge";
        b.appendChild(badge);
      }
      badge.textContent=cd>0?`${Math.ceil(cd)}s`:"";
    }
  }

  /* =========================
   * Loop
   * ========================= */
  function loop(t){
    const dt=Math.min(0.05,(t-tPrev)/1000);
    tPrev=t;

    if(!paused){
      updateEconomy(dt);
      spawnTimer+=dt;
      if(spawnTimer>spawnRate){ spawnTimer=0; spawnEnemy(); }

      yourUnits.forEach(u=>updateUnit(u,dt,"your"));
      enemyUnits.forEach(e=>updateUnit(e,dt,"enemy"));
    }

    render();
    refreshUI();
    requestAnimationFrame(loop);
  }

  /* =========================
   * Events
   * ========================= */
  unitBtns.forEach(b=>{
    b.addEventListener("click",()=>spawnYour(b.dataset.unit));
  });

  $btnPause.onclick=()=>paused=!paused;
  $btnReset.onclick=()=>location.reload();

  /* =========================
   * Start
   * ========================= */
  fitCanvas();
  worldInitMetrics();
  requestAnimationFrame(t=>{tPrev=t;loop(t);});
})();
