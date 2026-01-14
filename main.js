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
   * Assets loader
   * ========================= */
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  // ✅ 自軍：assets/Unit/
  const IMG_YOUR = {
    bunny:   loadImage("./assets/Unit/bunny.png"),
    puchi:  loadImage("./assets/Unit/puchi.png"),   // 無ければfallback
    stitch: loadImage("./assets/Unit/stitch.png"),
    lollipop: loadImage("./assets/Unit/lollipop.png"),
  };

  // ✅ 敵：assets/enemy/
  const IMG_ENEMY = {
    shadow:  loadImage("./assets/enemy/shadow.png"),
    beta:    loadImage("./assets/enemy/beta.png"),
    chigire: loadImage("./assets/enemy/chigire.png"),
    small:   loadImage("./assets/enemy/small.png"),
  };

  function isImgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
  }

  function pickYourImg(key) {
    // keyに対応が無ければ bunny.png
    const img = IMG_YOUR[key] || IMG_YOUR.bunny;
    return isImgReady(img) ? img : (isImgReady(IMG_YOUR.bunny) ? IMG_YOUR.bunny : null);
  }

  function pickEnemyImg(name) {
    // nameからそれっぽい画像を選ぶ（無ければ shadow）
    let img = IMG_ENEMY.shadow;
    if (/べた/.test(name)) img = IMG_ENEMY.beta || IMG_ENEMY.shadow;
    if (/ちぎれ/.test(name)) img = IMG_ENEMY.chigire || IMG_ENEMY.shadow;
    if (/ちび/.test(name)) img = IMG_ENEMY.small || IMG_ENEMY.shadow;
    return isImgReady(img) ? img : (isImgReady(IMG_ENEMY.shadow) ? IMG_ENEMY.shadow : null);
  }

  /* =========================
   * Game constants
   * ========================= */
  const GAME = {
    laneY: 0,
    leftBaseX: 110,
    rightBaseX: 0,
    groundH: 80,

    yourBaseHPMax: 2500,
    enemyBaseHPMax: 2200,

    candyMaxBase: 500,
    candyRegenBase: 32, // per sec

    skillCd: 9.0, // sec
  };

  const UNIT_DEFS = {
    puchi: {
      side: "your",
      name: "ぷちバニー",
      cost: 120,
      hp: 160,
      atk: 22,
      range: 26,
      speed: 52,
      atkCd: 0.55,
      size: 26
    },
    stitch: {
      side: "your",
      name: "つぎはぎ",
      cost: 220,
      hp: 340,
      atk: 30,
      range: 28,
      speed: 40,
      atkCd: 0.72,
      size: 30,
      knock: 10
    },
    lollipop: {
      side: "your",
      name: "ペロ職人",
      cost: 320,
      hp: 210,
      atk: 38,
      range: 130,
      speed: 34,
      atkCd: 0.95,
      size: 28,
      projectile: true
    }
  };

  const ENEMY_DEFS = [
    {
      name: "影キャンディ",
      hp: 140,
      atk: 18,
      range: 24,
      speed: 48,
      atkCd: 0.65,
      size: 26
    },
    {
      name: "べた影",
      hp: 260,
      atk: 24,
      range: 26,
      speed: 34,
      atkCd: 0.85,
      size: 30
    },
    {
      name: "ちぎれ影",
      hp: 90,
      atk: 14,
      range: 24,
      speed: 58,
      atkCd: 0.55,
      size: 24,
      split: true
    }
  ];

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

  let spawnTimer = 0;
  let spawnRate = 1.6;
  let gameEnded = false;

  /* =========================
   * Helpers
   * ========================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function worldInitMetrics() {
    const rect = cv.getBoundingClientRect();
    GAME.rightBaseX = rect.width - 110;
    GAME.laneY = rect.height - GAME.groundH - 42;
  }

  function openOverlay(title, desc, nextLabel = "次へ") {
    $ovTitle.textContent = title;
    $ovDesc.textContent = desc;
    $btnNext.textContent = nextLabel;
    $overlay.classList.remove("hidden");
  }
  function closeOverlay() {
    $overlay.classList.add("hidden");
  }

  function resetGame() {
    paused = false;
    gameEnded = false;
    closeOverlay();

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
    projectiles.length = 0;
    particles.length = 0;

    spawnTimer = 0;
    spawnRate = 1.6;
  }

  function addParticle(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-70, 70),
        vy: rand(-120, -40),
        life: rand(0.25, 0.55)
      });
    }
  }

  function spawnYour(unitKey) {
    const def = UNIT_DEFS[unitKey];
    if (!def) return;
    if (candy < def.cost) return;

    candy -= def.cost;

    yourUnits.push({
      side: "your",
      key: unitKey,
      name: def.name,
      x: GAME.rightBaseX - 40,
      y: GAME.laneY,
      hp: def.hp,
      hpMax: def.hp,
      atk: def.atk,
      range: def.range,
      speed: def.speed,
      atkCd: def.atkCd,
      cdLeft: 0,
      size: def.size,
      projectile: !!def.projectile,
      knock: def.knock || 0
    });
  }

  function spawnEnemy() {
    const pick = ENEMY_DEFS[Math.floor(Math.random() * ENEMY_DEFS.length)];
    const mulHP = 1 + (wave - 1) * 0.12;
    const mulATK = 1 + (wave - 1) * 0.06;

    enemyUnits.push({
      side: "enemy",
      name: pick.name,
      x: GAME.leftBaseX + 40,
      y: GAME.laneY,
      hp: Math.floor(pick.hp * mulHP),
      hpMax: Math.floor(pick.hp * mulHP),
      atk: Math.floor(pick.atk * mulATK),
      range: pick.range,
      speed: pick.speed,
      atkCd: pick.atkCd,
      cdLeft: 0,
      size: pick.size,
      split: !!pick.split
    });
  }

  function findTarget(u) {
    if (u.side === "your") {
      let best = null;
      let bestDist = Infinity;
      for (const e of enemyUnits) {
        const dist = Math.abs(u.x - e.x);
        if (dist < bestDist) { bestDist = dist; best = e; }
      }
      return best || "enemyBase";
    } else {
      let best = null;
      let bestDist = Infinity;
      for (const y of yourUnits) {
        const dist = Math.abs(u.x - y.x);
        if (dist < bestDist) { bestDist = dist; best = y; }
      }
      return best || "yourBase";
    }
  }

  function attack(u, target) {
    if (u.projectile) {
      const dir = (u.side === "your") ? -1 : 1;
      projectiles.push({
        x: u.x + dir * 10,
        y: u.y - 14,
        vx: dir * 340,
        damage: u.atk,
        side: u.side,
        life: 1.2
      });
      addParticle(u.x, u.y - 12, 3);
      return;
    }

    if (target === "enemyBase") {
      enemyBaseHP -= u.atk;
      addParticle(GAME.leftBaseX + 24, GAME.laneY - 12, 7);
      return;
    }
    if (target === "yourBase") {
      yourBaseHP -= u.atk;
      addParticle(GAME.rightBaseX - 24, GAME.laneY - 12, 7);
      return;
    }
    if (!target) return;

    target.hp -= u.atk;

    if (u.side === "your" && u.knock) target.x -= u.knock;
    else if (u.side === "enemy") target.x += 4;

    addParticle(target.x, target.y - 10, 6);
  }

  function updateUnit(u, dt) {
    u.cdLeft = Math.max(0, u.cdLeft - dt);

    const target = findTarget(u);
    const dir = (u.side === "your") ? -1 : 1;

    let tx;
    if (target === "enemyBase") tx = GAME.leftBaseX;
    else if (target === "yourBase") tx = GAME.rightBaseX;
    else tx = target.x;

    const dist = Math.abs(u.x - tx);
    const canAttack = dist <= (u.range + (u.size * 0.4));

    if (canAttack) {
      if (u.cdLeft <= 0) {
        attack(u, target);
        u.cdLeft = u.atkCd;
      }
      return;
    }

    u.x += dir * u.speed * dt;
    u.x = clamp(u.x, GAME.leftBaseX, GAME.rightBaseX);
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;

      if (p.side === "your") {
        for (const e of enemyUnits) {
          if (Math.abs(p.x - e.x) < 16 && Math.abs(p.y - (e.y - 12)) < 24) {
            e.hp -= p.damage;
            addParticle(e.x, e.y - 12, 10);
            p.life = -1;
            break;
          }
        }
        if (p.life > 0 && p.x <= GAME.leftBaseX + 8) {
          enemyBaseHP -= Math.floor(p.damage * 0.8);
          addParticle(GAME.leftBaseX + 18, GAME.laneY - 12, 12);
          p.life = -1;
        }
      } else {
        for (const y of yourUnits) {
          if (Math.abs(p.x - y.x) < 16 && Math.abs(p.y - (y.y - 12)) < 24) {
            y.hp -= p.damage;
            addParticle(y.x, y.y - 12, 10);
            p.life = -1;
            break;
          }
        }
        if (p.life > 0 && p.x >= GAME.rightBaseX - 8) {
          yourBaseHP -= Math.floor(p.damage * 0.8);
          addParticle(GAME.rightBaseX - 18, GAME.laneY - 12, 12);
          p.life = -1;
        }
      }

      if (p.life <= 0) projectiles.splice(i, 1);
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

  function cleanupDead() {
    for (let i = enemyUnits.length - 1; i >= 0; i--) {
      const e = enemyUnits[i];
      if (e.hp > 0) continue;

      addParticle(e.x, e.y - 12, 16);

      if (e.split) {
        for (let k = 0; k < 2; k++) {
          enemyUnits.push({
            side: "enemy",
            name: "ちび影",
            x: e.x + rand(-14, 14),
            y: e.y,
            hp: 55,
            hpMax: 55,
            atk: 10,
            range: 22,
            speed: 62,
            atkCd: 0.58,
            cdLeft: 0,
            size: 20,
            split: false
          });
        }
      }

      enemyUnits.splice(i, 1);
      candy = clamp(candy + 18, 0, candyMax);
    }

    for (let i = yourUnits.length - 1; i >= 0; i--) {
      const u = yourUnits[i];
      if (u.hp > 0) continue;
      addParticle(u.x, u.y - 12, 14);
      yourUnits.splice(i, 1);
    }
  }

  function stepWaveLogic(dt) {
    spawnTimer += dt;

    const targetRate = Math.max(0.55, 1.6 - (wave - 1) * 0.12);
    spawnRate += (targetRate - spawnRate) * Math.min(1, dt * 2.0);

    if (spawnTimer >= spawnRate) {
      spawnTimer = 0;
      spawnEnemy();
      if (wave >= 3 && Math.random() < 0.15) spawnEnemy();
    }

    if (!gameEnded && enemyBaseHP <= 0) {
      gameEnded = true;
      openOverlay("WIN!", `Wave ${wave} を突破！ 次のWaveへ進みます。`, "次のWave");
    }
    if (!gameEnded && yourBaseHP <= 0) {
      gameEnded = true;
      openOverlay("LOSE…", `キャンディコアが壊れました。もう一回やる？`, "リトライ");
    }
  }

  function updateEconomy(dt) {
    candy = clamp(candy + candyRegen * dt, 0, candyMax);

    if (!skillReady) {
      skillLeft = Math.max(0, skillLeft - dt);
      if (skillLeft <= 0) skillReady = true;
    }
  }

  function castSkill() {
    if (!skillReady || gameEnded) return;

    skillReady = false;
    skillLeft = GAME.skillCd;

    const swingX = GAME.rightBaseX - 180;

    for (const e of enemyUnits) {
      if (e.x < swingX) continue;
      if (e.x > GAME.rightBaseX - 20) continue;
      e.hp -= 80;
      e.x -= 50;
      addParticle(e.x, e.y - 18, 18);
    }
    addParticle(swingX, GAME.laneY - 22, 26);
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
    ctx.moveTo(0, GAME.laneY + 18);
    ctx.lineTo(w, GAME.laneY + 18);
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

  function drawUnit(u) {
    const x = u.x;
    const y = u.y;

    if (u.side === "your") {
      const img = pickYourImg(u.key);
      if (img) {
        const s = u.size * 2.2;
        ctx.drawImage(img, x - s / 2, y - s, s, s);
      } else {
        ctx.fillStyle = "rgba(255,160,195,.75)";
        ctx.beginPath();
        ctx.arc(x, y - 24, u.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const img = pickEnemyImg(u.name);
      if (img) {
        const s = u.size * 2.1;
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
    ctx.fillStyle = (u.side === "enemy") ? "rgba(80,80,90,.9)" : "rgba(255,79,160,.9)";
    ctx.fillRect(x - 22, y - 64, 44 * p, 6);
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      ctx.fillStyle = (p.side === "your") ? "rgba(255,120,170,.95)" : "rgba(60,60,70,.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
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

  function render() {
    const rect = cv.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    drawBackground(w, h);
    drawBase(GAME.leftBaseX, GAME.laneY + 18, enemyBaseHP, GAME.enemyBaseHPMax, false);
    drawBase(GAME.rightBaseX, GAME.laneY + 18, yourBaseHP, GAME.yourBaseHPMax, true);

    for (const e of enemyUnits) drawUnit(e);
    for (const u of yourUnits) drawUnit(u);

    drawProjectiles();
    drawParticles();

    if (skillReady && !gameEnded) {
      ctx.save();
      ctx.fillStyle = "rgba(255,220,140,.18)";
      ctx.fillRect(GAME.rightBaseX - 260, GAME.laneY - 110, 220, 130);
      ctx.restore();
    }
  }

  function refreshUI() {
    $enemyHpText.textContent = `${Math.max(0, Math.floor(enemyBaseHP))}`;
    $yourHpText.textContent  = `${Math.max(0, Math.floor(yourBaseHP))}`;
    $waveText.textContent    = `${wave}`;

    $candyText.textContent = `${Math.floor(candy)}/${candyMax}`;
    $candyBar.style.width = `${(candy / candyMax) * 100}%`;

    for (const b of unitBtns) {
      const key = b.dataset.unit;
      const def = UNIT_DEFS[key];
      const ok = def && candy >= def.cost && !gameEnded;
      b.classList.toggle("disabled", !ok);
    }

    if (gameEnded) {
      $btnSkill.classList.add("disabled");
      $skillText.textContent = "locked";
    } else if (skillReady) {
      $btnSkill.classList.remove("disabled");
      $skillText.textContent = "ready";
    } else {
      $btnSkill.classList.add("disabled");
      $skillText.textContent = `${Math.ceil(skillLeft)}s`;
    }
  }

  function loop(tNow) {
    const dt = clamp((tNow - tPrev) / 1000, 0, 0.05);
    tPrev = tNow;

    if (!paused) {
      updateEconomy(dt);
      for (const u of yourUnits) updateUnit(u, dt);
      for (const e of enemyUnits) updateUnit(e, dt);
      updateProjectiles(dt);
      updateParticles(dt);
      cleanupDead();
      stepWaveLogic(dt);
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

  $btnSkill.addEventListener("click", () => {
    if ($btnSkill.classList.contains("disabled")) return;
    castSkill();
  });

  $btnPause.addEventListener("click", () => {
    paused = !paused;
    $btnPause.textContent = paused ? "▶" : "⏸";
  });

  $btnReset.addEventListener("click", () => resetGame());

  $btnAgain.addEventListener("click", () => resetGame());

  $btnNext.addEventListener("click", () => {
    if (yourBaseHP <= 0) {
      resetGame();
      return;
    }
    closeOverlay();
    gameEnded = false;
    wave += 1;

    yourBaseHP = Math.min(GAME.yourBaseHPMax, yourBaseHP + 450);
    enemyBaseHP = GAME.enemyBaseHPMax + Math.floor((wave - 1) * 160);

    candyMax = GAME.candyMaxBase + (wave - 1) * 40;
    candyRegen = GAME.candyRegenBase + (wave - 1) * 2.4;
    candy = clamp(candy + 220, 0, candyMax);

    enemyUnits.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    spawnTimer = 0;
  });

  /* =========================
   * Start
   * ========================= */
  fitCanvas();
  worldInitMetrics();

  openOverlay(
    "Candy Defense",
    "下のボタンでユニット出撃。Candyは時間で回復。敵の拠点を壊せば勝ち！",
    "スタート"
  );

  requestAnimationFrame((t) => {
    tPrev = t;
    requestAnimationFrame(loop);
  });
})();
