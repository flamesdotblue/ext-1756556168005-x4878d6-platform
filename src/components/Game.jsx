import { useEffect, useRef, useState } from 'react';

// Original retro palette
const PAL = {
  sky1: '#70c1ff',
  sky2: '#a9e1ff',
  cloud: '#ffffff',
  ground1: '#8b4513',
  ground2: '#c26a2d',
  brick1: '#b04a2f',
  brick2: '#e17752',
  box1: '#d1a23f',
  box2: '#f6d06c',
  pipe1: '#2aa14a',
  pipe2: '#4bd16c',
  bush1: '#2aa14a',
  bush2: '#72dd8e',
  flag: '#e74c3c',
  pole: '#f0f0f0',
  coin1: '#ffd15c',
  coin2: '#ffef99',
  text: '#1b1f2a',
  ui: '#ffffff',
  enemy1: '#783c1e',
  enemy2: '#e08a5b',
  hero1: '#2d77ff',
  hero2: '#6aa1ff',
};

const SCALE = 3; // pixel scale
const TILE = 16; // base tile size in pixels
const TS = TILE * SCALE; // on-canvas tile size
const WORLD_H_TILES = 15; // visible height in tiles
const CANVAS_H = WORLD_H_TILES * TS; // fixed canvas height

// Symbols for tiles in the map
// ' ' empty, 'G' ground, 'B' brick, 'Q' question box, 'P' pipe, 'F' flag pole, 'T' top of flag pole

function makeLevel() {
  // Create a wide level inspired by classic 1-1, but original layout.
  const width = 360; // tiles
  const height = 15; // tiles
  const map = Array.from({ length: height }, () => Array(width).fill(' '));

  // Ground baseline
  for (let x = 0; x < width; x++) {
    for (let y = height - 2; y < height; y++) map[y][x] = 'G';
  }

  // Gentle hills (bush decor, no collision)
  // We'll render bushes procedurally; no tiles needed here.

  // A few pipes
  const pipes = [
    { x: 28, h: 3 },
    { x: 52, h: 4 },
    { x: 76, h: 3 },
    { x: 120, h: 5 },
  ];
  for (const p of pipes) {
    for (let y = 0; y < p.h; y++) {
      map[height - 3 - y][p.x] = 'P';
      map[height - 3 - y][p.x + 1] = 'P';
    }
  }

  // Platforms of bricks and boxes
  const placeBricks = (x, y, len) => {
    for (let i = 0; i < len; i++) map[y][x + i] = 'B';
  };
  const placeBoxes = (x, y, len) => {
    for (let i = 0; i < len; i++) map[y][x + i] = 'Q';
  };

  placeBricks(14, 7, 5);
  placeBoxes(20, 7, 1);
  placeBricks(24, 7, 3);

  placeBoxes(40, 6, 1);
  placeBricks(41, 6, 3);
  placeBoxes(44, 6, 1);

  placeBricks(60, 5, 5);
  placeBoxes(62, 9, 1);
  placeBoxes(64, 9, 1);

  // Stairs
  let sx = 90;
  for (let h = 1; h <= 5; h++) {
    for (let i = 0; i < h; i++) map[height - 3 - i][sx + h - 1] = 'B';
  }
  sx = 100;
  for (let h = 5; h >= 1; h--) {
    for (let i = 0; i < h; i++) map[height - 3 - i][sx + (5 - h)] = 'B';
  }

  // Mid-level fun
  placeBoxes(130, 6, 1);
  placeBricks(131, 6, 3);
  placeBoxes(134, 6, 1);

  // Final run and flag
  const flagX = 340;
  for (let y = 1; y < 10; y++) map[height - 3 - y][flagX] = 'F';
  map[height - 13][flagX] = 'T';

  return { map, width, height, flagX };
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function useKeys() {
  const keysRef = useRef({});
  useEffect(() => {
    const down = (e) => (keysRef.current[e.code] = true);
    const up = (e) => (keysRef.current[e.code] = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  return keysRef;
}

export default function Game() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [state, setState] = useState('title'); // title, playing, win, dead

  const keys = useKeys();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const level = makeLevel();

    // Responsive canvas width, fixed height
    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(960, Math.min(window.innerWidth - 32, 1400));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(CANVAS_H * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = CANVAS_H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();

    const onResize = () => setSize();
    window.addEventListener('resize', onResize);

    // Game objects
    const player = {
      x: TS * 2,
      y: TS * 8,
      w: TS * 0.8,
      h: TS * 0.95,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      coins: 0,
      lives: 3,
    };

    const enemies = [];
    function spawnEnemy(tx, ty) {
      enemies.push({
        x: tx * TS,
        y: ty * TS,
        w: TS * 0.9,
        h: TS * 0.9,
        vx: -1.0 * SCALE,
        vy: 0,
        alive: true,
      });
    }

    // Place a few enemies
    spawnEnemy(22, 12);
    spawnEnemy(58, 12);
    spawnEnemy(88, 12);
    spawnEnemy(150, 12);

    const coins = new Set();
    const coinAt = (x, y) => `${x},${y}`;

    // Preload coins in Q blocks; coins pop out upon bonk

    // Physics params
    const G = 0.6 * SCALE;
    const MAX_VX = 3.2 * SCALE;
    const ACC = 0.5 * SCALE;
    const FRICTION = 0.8;
    const JUMP_V = -10.5 * SCALE;

    // Camera
    let camX = 0;

    // Helpers
    const solidAt = (tx, ty) => {
      if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return true; // walls outside
      const c = level.map[ty][tx];
      return c === 'G' || c === 'B' || c === 'Q' || c === 'P' || c === 'F' || c === 'T';
    };

    const bonkBlock = (tx, ty) => {
      const c = level.map[ty][tx];
      if (c === 'Q') {
        level.map[ty][tx] = 'B';
        coins.add(coinAt(tx, ty - 1));
        sfx.coin();
        setScore((s) => s + 200);
      }
    };

    const aabbVsTiles = (rect, vx, vy) => {
      // Check only tiles around the rect
      const minTx = Math.floor(rect.x / TS) - 2;
      const maxTx = Math.floor((rect.x + rect.w) / TS) + 2;
      const minTy = Math.floor(rect.y / TS) - 2;
      const maxTy = Math.floor((rect.y + rect.h) / TS) + 2;

      let collidedBottom = false;

      // Horizontal
      if (vx !== 0) {
        rect.x += vx;
        for (let ty = minTy; ty <= maxTy; ty++) {
          for (let tx = minTx; tx <= maxTx; tx++) {
            if (!solidAt(tx, ty)) continue;
            const tileRect = { x: tx * TS, y: ty * TS, w: TS, h: TS };
            if (rectsIntersect(rect, tileRect)) {
              if (vx > 0) rect.x = tileRect.x - rect.w;
              else rect.x = tileRect.x + tileRect.w;
              vx = 0;
            }
          }
        }
      }

      // Vertical
      if (vy !== 0) {
        rect.y += vy;
        for (let ty = minTy; ty <= maxTy; ty++) {
          for (let tx = minTx; tx <= maxTx; tx++) {
            if (!solidAt(tx, ty)) continue;
            const tileRect = { x: tx * TS, y: ty * TS, w: TS, h: TS };
            if (rectsIntersect(rect, tileRect)) {
              if (vy > 0) {
                rect.y = tileRect.y - rect.h;
                collidedBottom = true;
              } else {
                rect.y = tileRect.y + tileRect.h;
                // Bonk if hitting from below
                bonkBlock(tx, ty);
              }
              vy = 0;
            }
          }
        }
      }

      return { vx, vy, collidedBottom };
    };

    // Simple sfx using WebAudio bleeps
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (freq, dur = 0.08, type = 'square', vol = 0.03) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    };
    const sfx = {
      coin: () => beep(880, 0.09, 'square', 0.05),
      jump: () => beep(620, 0.12, 'square', 0.05),
      stomp: () => beep(160, 0.06, 'square', 0.05),
      lose: () => beep(120, 0.6, 'sawtooth', 0.05),
      flag: () => beep(520, 0.3, 'triangle', 0.05),
    };

    let last = 0;
    let running = true;

    const startGame = () => {
      // reset player and world state
      player.x = TS * 2;
      player.y = TS * 8;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      player.facing = 1;
      camX = 0;
      enemies.forEach((e, i) => {
        // reposition initial enemies roughly back to their spots
        if (i === 0) { e.x = 22 * TS; e.y = 12 * TS; }
        if (i === 1) { e.x = 58 * TS; e.y = 12 * TS; }
        if (i === 2) { e.x = 88 * TS; e.y = 12 * TS; }
        if (i === 3) { e.x = 150 * TS; e.y = 12 * TS; }
        e.vx = -1.0 * SCALE; e.vy = 0; e.alive = true;
      });
      coins.clear();
      setScore(0);
      setState('playing');
    };

    const keyStartHandler = (e) => {
      if (e.code === 'Enter') {
        audioCtx.resume && audioCtx.resume();
        startGame();
      }
    };
    window.addEventListener('keydown', keyStartHandler);

    function step(ts) {
      if (!running) return;
      const dt = Math.min(33, ts - last);
      last = ts;

      // Input
      const k = keys.current || {};
      if (state === 'playing') {
        if (k.ArrowLeft || k.KeyA) { player.vx -= ACC; player.facing = -1; }
        if (k.ArrowRight || k.KeyD) { player.vx += ACC; player.facing = 1; }
        if ((k.Space || k.ArrowUp || k.KeyW) && player.onGround) {
          player.vy = JUMP_V;
          player.onGround = false;
          sfx.jump();
        }
      }

      // Apply physics
      player.vx *= FRICTION;
      if (player.vx > MAX_VX) player.vx = MAX_VX;
      if (player.vx < -MAX_VX) player.vx = -MAX_VX;
      player.vy += G;

      const rect = { x: player.x, y: player.y, w: player.w, h: player.h };
      const col = aabbVsTiles(rect, player.vx, player.vy);
      player.x = rect.x; player.y = rect.y;
      player.vx = col.vx; player.vy = col.vy;
      player.onGround = col.collidedBottom;

      // Prevent backtracking beyond camera start
      if (player.x < camX) player.x = camX;

      // Camera follows player
      const viewW = canvas.width / (window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1);
      const desired = Math.max(0, Math.min(player.x - viewW * 0.35, (level.width * TS) - viewW));
      camX += (desired - camX) * 0.15;

      // Enemies update
      for (const e of enemies) {
        if (!e.alive) continue;
        e.vy += G;
        // Basic AI: flip on wall or ledge
        let next = { x: e.x, y: e.y, w: e.w, h: e.h };
        // horizontal
        next.x += e.vx;
        const leftTile = Math.floor((next.x) / TS);
        const rightTile = Math.floor((next.x + e.w) / TS);
        const topTile = Math.floor((e.y) / TS);
        const bottomTile = Math.floor((e.y + e.h) / TS);
        let hitWall = false;
        for (let ty = topTile; ty <= bottomTile; ty++) {
          if (solidAt(e.vx < 0 ? leftTile : rightTile, ty)) hitWall = true;
        }
        // ledge check
        const frontX = e.vx < 0 ? Math.floor((e.x - 1) / TS) : Math.floor((e.x + e.w + 1) / TS);
        const footY = Math.floor((e.y + e.h + 1) / TS);
        const hasGround = solidAt(frontX, footY);
        if (hitWall || !hasGround) e.vx *= -1;

        // integrate with collisions
        // horizontal
        let rr = { x: e.x, y: e.y, w: e.w, h: e.h };
        const colE1 = aabbVsTiles(rr, e.vx, 0);
        e.x = rr.x; e.vx = colE1.vx;
        // vertical
        rr = { x: e.x, y: e.y, w: e.w, h: e.h };
        const colE2 = aabbVsTiles(rr, 0, e.vy);
        e.y = rr.y; e.vy = colE2.vy;

        // Stomp test
        const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
        if (rectsIntersect(pr, e)) {
          if (player.vy > 2) {
            e.alive = false; sfx.stomp();
            player.vy = JUMP_V * 0.6; // bounce
            setScore((s) => s + 100);
          } else {
            // player hit - lose
            sfx.lose();
            setState('dead');
          }
        }
      }

      // Coin pickups floating above bonked boxes
      for (const key of Array.from(coins)) {
        const [tx, ty] = key.split(',').map(Number);
        const cx = tx * TS + TS / 4;
        const cy = ty * TS + TS / 4;
        const cRect = { x: cx, y: cy, w: TS / 2, h: TS / 2 };
        const pRect = { x: player.x, y: player.y, w: player.w, h: player.h };
        if (rectsIntersect(cRect, pRect)) {
          coins.delete(key);
          sfx.coin();
          setScore((s) => s + 200);
        }
      }

      // Win condition: touch flag pole bottom area
      const flagWorldX = level.flagX * TS;
      const flagRect = { x: flagWorldX - 6, y: 0, w: 12, h: CANVAS_H };
      if (state === 'playing' && rectsIntersect(flagRect, { x: player.x, y: player.y, w: player.w, h: player.h })) {
        setState('win');
        sfx.flag();
      }

      // Render
      render(ctx, canvas, camX, player, enemies, coins, level, state, score);

      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', keyStartHandler);
    };
  }, [state]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-2 py-2 text-sm">
        <div className="font-semibold">Score: {score}</div>
        <div className="text-white/70">Reach the flag to win</div>
      </div>
      <canvas ref={canvasRef} className="w-full rounded-lg bg-[#83d8ff] shadow-inner" />
      <Overlay state={state} onStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))} />
    </div>
  );
}

function Overlay({ state, onStart }) {
  if (state === 'playing') return null;
  const title = state === 'title' ? 'Pixel Plumber' : state === 'win' ? 'Stage Clear!' : 'You Died';
  const subtitle = state === 'title' ? 'Press Enter to Start' : 'Press Enter to Play Again';
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4 text-center">
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="text-white/70">{subtitle}</p>
      <button onClick={onStart} className="mt-3 rounded-md bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300">Enter</button>
    </div>
  );
}

function render(ctx, canvas, camX, player, enemies, coins, level, state, score) {
  // Sky gradient
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, PAL.sky2);
  grd.addColorStop(1, PAL.sky1);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camX, 0);

  // Clouds
  for (let i = 0; i < 12; i++) {
    const cx = i * 300 + 140;
    const cy = 40 + ((i % 3) * 20);
    drawCloud(ctx, cx, cy);
  }

  // Bushes
  for (let i = 0; i < 20; i++) {
    const bx = i * 520 + 200;
    drawBush(ctx, bx, CANVAS_H - TS * 2);
  }

  // Level tiles
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = Math.floor(camX / TS) - 2; tx < Math.floor((camX + canvas.width) / TS) + 2; tx++) {
      if (tx < 0 || tx >= level.width) continue;
      const c = level.map[ty][tx];
      if (c === 'G') drawGround(ctx, tx * TS, ty * TS);
      else if (c === 'B') drawBrick(ctx, tx * TS, ty * TS);
      else if (c === 'Q') drawBox(ctx, tx * TS, ty * TS);
      else if (c === 'P') drawPipe(ctx, tx * TS, ty * TS, level.map);
      else if (c === 'F' || c === 'T') drawFlag(ctx, tx * TS, ty * TS, c === 'T');
    }
  }

  // Coins floating from bonked blocks
  coins.forEach((key) => {
    const [tx, ty] = key.split(',').map(Number);
    drawCoin(ctx, tx * TS + TS / 2, ty * TS + TS / 2);
  });

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    drawEnemy(ctx, e.x, e.y, e.w, e.h);
  }

  // Player
  drawHero(ctx, player.x, player.y, player.w, player.h, player.facing);

  ctx.restore();

  // UI overlay
  ctx.fillStyle = PAL.ui;
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${score}`, 12, 22);
}

// Drawing helpers (pixel-art styled with rectangles)
function drawCloud(ctx, x, y) {
  ctx.fillStyle = PAL.cloud;
  roundedRect(ctx, x, y, 60, 18, 8);
  roundedRect(ctx, x + 20, y - 10, 40, 20, 10);
  roundedRect(ctx, x + 40, y, 40, 18, 8);
}
function drawBush(ctx, x, y) {
  ctx.fillStyle = PAL.bush2;
  roundedRect(ctx, x, y, 50, 20, 8);
  ctx.fillStyle = PAL.bush1;
  roundedRect(ctx, x + 15, y - 8, 40, 20, 10);
}
function drawGround(ctx, x, y) {
  ctx.fillStyle = PAL.ground1;
  ctx.fillRect(x, y, TS, TS);
  ctx.fillStyle = PAL.ground2;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i * (TS / 3), y + TS - 4, TS / 3 - 1, 4);
}
function drawBrick(ctx, x, y) {
  ctx.fillStyle = PAL.brick1;
  ctx.fillRect(x, y, TS, TS);
  ctx.fillStyle = PAL.brick2;
  ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
  ctx.fillStyle = PAL.brick1;
  ctx.fillRect(x + 2, y + TS / 2 - 2, TS - 4, 4);
  ctx.fillRect(x + TS / 2 - 2, y + 2, 4, TS - 4);
}
function drawBox(ctx, x, y) {
  ctx.fillStyle = PAL.box1;
  ctx.fillRect(x, y, TS, TS);
  ctx.fillStyle = PAL.box2;
  ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
  // question mark style star
  ctx.fillStyle = '#7a5b15';
  ctx.fillRect(x + TS / 2 - 2, y + 6, 4, 4);
  ctx.fillRect(x + TS / 2 - 6, y + 10, 12, 4);
}
function drawPipe(ctx, x, y, map) {
  // determine top by checking tile above
  const tileAbove = map[Math.floor(y / TS) - 1]?.[Math.floor(x / TS)] !== 'P';
  ctx.fillStyle = PAL.pipe2;
  ctx.fillRect(x, y, TS, TS);
  ctx.fillStyle = PAL.pipe1;
  ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
  if (tileAbove) {
    ctx.fillStyle = PAL.pipe2;
    ctx.fillRect(x - 2, y - 8, TS + 4, 10);
    ctx.fillStyle = PAL.pipe1;
    ctx.fillRect(x, y - 6, TS, 6);
  }
}
function drawFlag(ctx, x, y, top) {
  // pole
  ctx.fillStyle = PAL.pole;
  ctx.fillRect(x + TS / 2 - 2, y, 4, TS);
  // flag only at top tile
  if (top) {
    ctx.fillStyle = PAL.flag;
    ctx.beginPath();
    ctx.moveTo(x + TS / 2, y + 4);
    ctx.lineTo(x + TS / 2 + 20, y + 10);
    ctx.lineTo(x + TS / 2, y + 16);
    ctx.closePath();
    ctx.fill();
  }
}
function drawCoin(ctx, cx, cy) {
  ctx.fillStyle = PAL.coin1;
  roundedRect(ctx, cx - 6, cy - 10, 12, 20, 6);
  ctx.fillStyle = PAL.coin2;
  roundedRect(ctx, cx - 3, cy - 6, 6, 12, 3);
}
function drawEnemy(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.enemy2;
  roundedRect(ctx, x, y + h * 0.2, w, h * 0.8, 6);
  ctx.fillStyle = PAL.enemy1;
  roundedRect(ctx, x + 4, y + 4, w - 8, h * 0.6, 6);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 6, y + 8, 6, 6);
  ctx.fillRect(x + w - 12, y + 8, 6, 6);
}
function drawHero(ctx, x, y, w, h, facing) {
  // Body
  ctx.fillStyle = PAL.hero2;
  roundedRect(ctx, x, y + h * 0.15, w, h * 0.85, 6);
  // Head
  ctx.fillStyle = PAL.hero1;
  roundedRect(ctx, x + 3, y, w - 6, h * 0.35, 6);
  // Face
  ctx.fillStyle = '#ffd7b8';
  roundedRect(ctx, x + (facing > 0 ? w - 12 : 6), y + 8, 6, 6, 2);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
