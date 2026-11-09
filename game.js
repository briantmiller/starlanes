'use strict';
/* Star Lanes — a SkyRoads-style runner. No dependencies. */

const LANES = 7, RL = 1.8, GRAV = 30, JUMP_V = 9, BLOCK_H = 0.9, LAT = 9, VIEW = 34;
const DIFFS = [
  { key: 'easy',   name: 'Easy',   min: 9, max: 9,  maxGap: 3, minW: 3, maxW: 6, throttle: false },
  { key: 'medium', name: 'Medium', min: 5, max: 14, maxGap: 5, minW: 2, maxW: 5, throttle: true },
  { key: 'hard',   name: 'Hard',   min: 6, max: 18, maxGap: 7, minW: 2, maxW: 4, throttle: true }
];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Level generator ----------
   A level is an array of rows; each row has 7 cells: null (void) or {h, t}.
   h = surface height, t = 0 road, 1 burning, 2 block, 3 finish line. */
function genLevel(di, n) {
  const D = DIFFS[di];
  const rnd = mulberry32(di * 7919 + n * 104729 + 17);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const rows = [];
  let lo = 0, hi = LANES - 1;

  const add = (cnt, h = 0, t = 0) => {
    for (let i = 0; i < cnt; i++) {
      const r = new Array(LANES).fill(null);
      for (let l = lo; l <= hi; l++) r[l] = { h, t };
      rows.push(r);
    }
  };
  const voidRows = cnt => { for (let i = 0; i < cnt; i++) rows.push(new Array(LANES).fill(null)); };
  // Pick the next lane range, always overlapping the previous one so it is reachable.
  const range = (minW, maxW, shift) => {
    const pw = hi - lo + 1, w = ri(minW, maxW);
    let nl = lo + Math.round((pw - w) / 2) + ri(-shift, shift);
    nl = clamp(nl, 0, LANES - w);
    const need = Math.min(2, w, pw);
    for (let k = 0; k < LANES; k++) {
      const ov = Math.min(hi, nl + w - 1) - Math.max(lo, nl) + 1;
      if (ov >= need) break;
      nl += nl > lo ? -1 : 1;
    }
    lo = nl; hi = nl + w - 1;
  };
  const scatter = burn => {
    range(3, Math.max(4, D.maxW), 1);
    const start = rows.length, len = ri(12, 18), sp = [5, 4, 3][di];
    add(len);
    for (let r = start + 3, two; r < start + len - 3; r += ri(sp, sp + 1) + (two ? 1 : 0)) {
      const w = hi - lo + 1;
      const k = ri(1, w - (di === 0 ? 2 : 1));
      const lanes = [];
      for (let l = lo; l <= hi; l++) lanes.push(l);
      for (let i = lanes.length - 1; i > 0; i--) { const j = ri(0, i); [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
      two = burn && rnd() < 0.4;
      for (let i = 0; i < k; i++) {
        rows[r][lanes[i]] = burn ? { h: 0, t: 1 } : { h: BLOCK_H, t: 2 };
        if (two) rows[r + 1][lanes[i]] = { h: 0, t: 1 };
      }
    }
  };
  const segs = {
    road() { range(D.minW, D.maxW, 2); add(ri(5, 11)); },
    gap() {
      const g = di === 0 ? (rnd() < 0.65 ? 2 : 3) : ri(2, D.maxGap);
      voidRows(g);
      range(Math.max(2, D.minW), D.maxW, 1);
      add(ri(6, 9) + (g > 4 ? 4 : 0));
    },
    blocks() { scatter(false); },
    burn() { scatter(true); },
    wall() { add(4); add(1, BLOCK_H, 2); add(5); },
    raised() { add(3); range(D.minW, D.maxW, 1); add(ri(5, 9), BLOCK_H, 0); add(3); },
    islands() {
      const c = ri(3, 5);
      for (let i = 0; i < c; i++) {
        voidRows(ri(2, Math.min(3, D.maxGap)));
        range(2, 3, di === 0 ? 1 : 2);
        add(ri(4, 5));
      }
    }
  };
  const weights = [
    { road: 3, gap: 3, blocks: 2, wall: 1, raised: 1, islands: n >= 2 ? 1 : 0, burn: n >= 3 ? 1 : 0 },
    { road: 2, gap: 3, blocks: 3, burn: 2, wall: 1.5, raised: 1.5, islands: 2 },
    { road: 1, gap: 3.5, blocks: 3, burn: 3, wall: 2, raised: 2, islands: 3 }
  ][di];
  const keys = Object.keys(weights), total = keys.reduce((s, k) => s + weights[k], 0);
  const pick = () => { let x = rnd() * total; for (const k of keys) { x -= weights[k]; if (x < 0) return k; } return 'road'; };

  const target = Math.min(640, 260 + n * 40);
  add(14);
  lo = di === 0 ? 1 : 2; hi = di === 0 ? 5 : 4;   // gentle, centred opening
  add(8);
  let last = '';
  while (rows.length < target) {
    let s = pick();
    if (s === last) s = pick();
    segs[s](); last = s;
  }
  lo = 0; hi = LANES - 1;
  add(6);
  const finishRow = rows.length;
  add(1, 0, 3);
  add(16);
  return { rows, finishRow, hue: 160 + (di * 95 + n * 47) % 150 }   // green..magenta, never the red of burning tiles;
}

if (typeof module !== 'undefined') module.exports = { genLevel, DIFFS, LANES };

/* ====================================================================== */
if (typeof document !== 'undefined') (function () {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const elMenu = $('menu'), elOver = $('over'), elPause = $('pause'), elHud = $('hud'),
        elJump = $('jump'), elThr = $('throttle'), elKnob = $('knob'), elSpd = $('spd'),
        elBar = $('bar'), elLabel = $('label'), elHint = $('hint');

  /* ---------- saved progress (per browser; fine if unavailable) ---------- */
  let save = { unlocked: [1, 1, 1], mute: false };
  try { const s = JSON.parse(localStorage.getItem('starlanes.v1')); if (s && s.unlocked) save = s; } catch (e) {}
  const persist = () => { try { localStorage.setItem('starlanes.v1', JSON.stringify(save)); } catch (e) {} };
  const chosen = save.unlocked.slice();

  /* ---------- sound ---------- */
  let ac = null;
  function tone(freq, dur, type, vol, slide, delay) {
    if (save.mute) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(vol || 0.05, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur);
    } catch (e) {}
  }
  const sfx = {
    jump: () => tone(300, 0.16, 'square', 0.04, 620),
    crash: () => { tone(160, 0.5, 'sawtooth', 0.09, 30); tone(90, 0.6, 'square', 0.06, 25); },
    fall: () => tone(420, 0.8, 'sine', 0.06, 50),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.05, 0, i * 0.11))
  };

  /* ---------- state ---------- */
  let state = 'menu';           // menu | play | paused | dead | won
  let L = genLevel(0, 1), theme = makeTheme(L.hue);
  const S = { di: 0, n: 1, x: 3.5, tx: 3.5, y: 0, vy: 0, z: 2, speed: 0, throttle: 0.5, ground: true,
              coyote: 0, jbuf: 0, jheld: false, bank: 0, deadT: 0, time: 0 };
  const cam = { x: 3.5, y: 2.3 };
  const keys = {};
  let parts = [], shipScreen = [0, 0];

  function makeTheme(h) {
    const c = (dh, s, l) => `hsl(${(h + dh) % 360} ${s}% ${l}%)`;
    return {
      top: [c(0, 52, 50), c(0, 52, 43)], front: c(0, 48, 25), side: c(0, 48, 19),
      rtop: [c(28, 58, 62), c(28, 58, 55)], rfront: c(28, 50, 32), rside: c(28, 50, 25),
      btop: [c(260, 65, 64), c(260, 65, 64)], bfront: c(260, 55, 42), bside: c(260, 55, 32),
      glow: c(200, 70, 26)
    };
  }

  function startLevel(di, n) {
    S.di = di; S.n = n;
    L = genLevel(di, n); theme = makeTheme(L.hue);
    Object.assign(S, { x: 3.5, tx: 3.5, y: 0, vy: 0, z: 2, speed: DIFFS[di].min * 0.6, throttle: 0.5,
                       ground: true, coyote: 0, jbuf: 0, jheld: false, bank: 0, deadT: 0, time: 0 });
    cam.x = 3.5; cam.y = 2.3; parts = [];
    setThrottle(0.5);
    elThr.hidden = !DIFFS[di].throttle;
    elLabel.textContent = `${DIFFS[di].name} · Road ${n}`;
    elHint.textContent = DIFFS[di].throttle ? 'Slide to steer · Jump on the right · Speed on the left'
                                            : 'Slide anywhere to steer · Jump on the right';
    elHint.classList.remove('gone');
    setState('play');
  }

  function setState(s) {
    state = s;
    elMenu.hidden = s !== 'menu';
    elPause.hidden = s !== 'paused';
    elOver.hidden = true;
    const playing = s === 'play' || s === 'paused';
    elHud.hidden = s === 'menu';
    if (s === 'menu') elHint.classList.add('gone');
    elJump.hidden = !playing;
    if (!playing) elThr.hidden = true; else elThr.hidden = !DIFFS[S.di].throttle;
    if (s === 'menu') renderMenu();
  }

  function showOver(title, sub, primary, action) {
    $('overTitle').textContent = title; $('overSub').textContent = sub;
    const b = $('overPrimary'); b.textContent = primary; b.onclick = action;
    elOver.hidden = false;
  }

  function die(kind) {
    if (state !== 'play') return;
    state = 'dead'; S.deadT = 0; S.kind = kind; elHint.classList.add('gone');
    elJump.hidden = true; elThr.hidden = true;
    if (kind === 'crash') {
      sfx.crash();
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, v = (0.2 + Math.random()) * cv.height * 0.5;
        parts.push({ x: shipScreen[0], y: shipScreen[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - cv.height * 0.15,
                     life: 0.5 + Math.random() * 0.6, t: 0, hue: 15 + Math.random() * 40 });
      }
    } else sfx.fall();
  }

  function win() {
    state = 'won'; S.deadT = 0; sfx.win(); elHint.classList.add('gone');
    elJump.hidden = true; elThr.hidden = true;
    if (S.n >= save.unlocked[S.di]) { save.unlocked[S.di] = S.n + 1; persist(); }
    chosen[S.di] = S.n + 1;
  }

  /* ---------- physics ---------- */
  function cellAt(x, z) {
    const l = Math.floor(x), r = Math.floor(z);
    if (l < 0 || l >= LANES || r < 0 || r >= L.rows.length) return null;
    return L.rows[r][l];
  }

  function step(dt) {
    const D = DIFFS[S.di];
    S.time += dt;
    if (keys.ArrowUp && D.throttle) setThrottle(S.throttle + dt * 0.9);
    if (keys.ArrowDown && D.throttle) setThrottle(S.throttle - dt * 0.9);
    if (keys.ArrowLeft) S.tx = S.x - 1;
    if (keys.ArrowRight) S.tx = S.x + 1;
    S.tx = clamp(S.tx, 0.3, LANES - 0.3);

    const tgt = D.min + (D.max - D.min) * (D.throttle ? S.throttle : 0);
    S.speed += clamp(tgt - S.speed, -9 * dt, 7 * dt);

    // steering; walls taller than the ship stop sideways motion
    let nx = S.x + clamp(S.tx - S.x, -LAT * dt, LAT * dt);
    if (nx !== S.x) {
      const c = cellAt(nx + (nx > S.x ? 0.25 : -0.25), S.z);
      if (c && c.h > S.y + 0.3) { nx = S.x; S.tx = S.x; }
    }
    S.bank += ((nx - S.x) / dt / LAT - S.bank) * Math.min(1, dt * 12);
    S.x = nx;

    // forward; running nose-first into anything taller is a crash
    const nz = S.z + S.speed * dt;
    for (const p of [-0.2, 0.2]) {
      const c = cellAt(S.x + p, nz + 0.3);
      if (c && c.h > S.y + 0.3) { die('crash'); return; }
    }
    S.z = nz;

    // ground under the ship
    let g = -Infinity;
    for (const p of [-0.2, 0.2]) {
      const c = cellAt(S.x + p, S.z);
      if (c && c.h <= S.y + 0.3 && c.h > g) g = c.h;
    }
    if (S.y > g + 1e-6 || S.vy > 0) {
      S.vy -= GRAV * dt; S.y += S.vy * dt; S.ground = false;
      if (S.y <= g && S.vy <= 0) { S.y = g; S.vy = 0; S.ground = true; }
    } else { S.y = g; S.vy = 0; S.ground = true; }
    S.coyote = S.ground ? 0.08 : S.coyote - dt;
    S.jbuf -= dt;

    if ((S.jbuf > 0 || S.jheld || keys[' ']) && (S.ground || S.coyote > 0) && S.vy <= 0) {
      S.vy = JUMP_V; S.ground = false; S.coyote = 0; S.jbuf = 0; sfx.jump();
    }
    if (S.ground) { const c = cellAt(S.x, S.z); if (c && c.t === 1) { die('crash'); return; } }
    if (S.y < -6) { die('fall'); return; }
    if (S.z > L.finishRow + 1) win();
  }

  /* ---------- rendering ---------- */
  const stars = [];
  { const r = mulberry32(99); for (let i = 0; i < 140; i++) stars.push([r(), r(), 0.4 + r() * 1.4, r() * 6.28]); }
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.width = Math.round(window.innerWidth * dpr);
    H = cv.height = Math.round(window.innerHeight * dpr);
  }
  window.addEventListener('resize', resize); resize();

  function draw(now) {
    const f = Math.min(0.52 * W, 0.95 * H), hor = H * 0.36, hw = W / 2;
    const cx = cam.x, cy = cam.y, cz = S.z * RL - 4.4, near = cz + 0.9;
    const rows = L.rows;

    // space
    ctx.globalAlpha = 1;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04050d'); bg.addColorStop(0.36, theme.glow); bg.addColorStop(0.42, '#070a18'); bg.addColorStop(1, '#020309');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now * 0.002 + s[3]);
      const sx = ((s[0] * W - cx * 6 * dpr) % W + W) % W;
      ctx.fillRect(sx, s[1] * H, s[2] * dpr, s[2] * dpr);
    }
    ctx.globalAlpha = 1;
    const pr = Math.min(W, H) * 0.11, px = W * 0.8 - cx * 4 * dpr, py = H * 0.17;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, theme.rtop[0]); pg.addColorStop(1, theme.side);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.3); ctx.fill();

    ctx.lineWidth = dpr; ctx.lineJoin = 'round';
    function quad(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4, col, line) {
      let d = f / (z1 - cz);
      ctx.beginPath();
      ctx.moveTo(hw + (x1 - cx) * d, hor + (cy - y1) * d);
      d = f / (z2 - cz); ctx.lineTo(hw + (x2 - cx) * d, hor + (cy - y2) * d);
      d = f / (z3 - cz); ctx.lineTo(hw + (x3 - cx) * d, hor + (cy - y3) * d);
      d = f / (z4 - cz); ctx.lineTo(hw + (x4 - cx) * d, hor + (cy - y4) * d);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = line || col; ctx.stroke();
    }
    const burnA = `hsl(${12 + 14 * Math.sin(now * 0.012)} 100% ${52 + 8 * Math.sin(now * 0.02)}%)`;
    const GRID = 'rgba(0,0,0,.28)';

    function cell(r, l, c, row, z0, z1, clipped) {
      const x0 = l, x1 = l + 1, h = c.h, ck = (r + l) & 1;
      let top, front, side;
      if (c.t === 1) { top = burnA; front = '#6b1206'; side = '#4a0c04'; }
      else if (c.t === 2) { top = theme.btop[ck]; front = theme.bfront; side = theme.bside; }
      else if (c.t === 3) { top = ck ? '#f4f6ff' : '#1a1d2e'; front = theme.front; side = theme.side; }
      else if (h > 0) { top = theme.rtop[ck]; front = theme.rfront; side = theme.rside; }
      else { top = theme.top[ck]; front = theme.front; side = theme.side; }
      if (cx < x0) {
        const nb = l > 0 ? row[l - 1] : null, nh = nb ? nb.h : -0.3;
        if (nh < h) quad(x0, h, z0, x0, h, z1, x0, nh, z1, x0, nh, z0, side);
      } else if (cx > x1) {
        const nb = l < LANES - 1 ? row[l + 1] : null, nh = nb ? nb.h : -0.3;
        if (nh < h) quad(x1, h, z0, x1, h, z1, x1, nh, z1, x1, nh, z0, side);
      }
      if (!clipped) {
        const nb = r > 0 ? rows[r - 1][l] : null, nh = nb ? nb.h : -0.3;
        if (nh < h) quad(x0, h, z0, x1, h, z0, x1, nh, z0, x0, nh, z0, front);
      }
      quad(x0, h, z0, x1, h, z0, x1, h, z1, x0, h, z1, top, GRID);
    }

    const below = S.y < -0.05;
    const shipRow = below ? Math.floor(S.z + 0.5) : Math.floor(S.z - 0.3);
    const rFar = Math.min(rows.length - 1, Math.floor(S.z) + VIEW), rNear = Math.max(0, Math.floor(near / RL));
    const camLane = clamp(Math.floor(cx), 0, LANES - 1);
    let shipDrawn = state === 'dead' && S.kind === 'crash';
    for (let r = rFar; r >= rNear; r--) {
      const row = rows[r], z1 = (r + 1) * RL;
      if (z1 <= near) continue;
      const clipped = r * RL < near, z0 = clipped ? near : r * RL;
      if (below && r === shipRow && !shipDrawn) { drawShip(); shipDrawn = true; }
      ctx.globalAlpha = clamp((S.z + VIEW - r) / 9, 0, 1);
      for (let l = 0; l < camLane; l++) if (row[l]) cell(r, l, row[l], row, z0, z1, clipped);
      for (let l = LANES - 1; l > camLane; l--) if (row[l]) cell(r, l, row[l], row, z0, z1, clipped);
      if (row[camLane]) cell(r, camLane, row[camLane], row, z0, z1, clipped);
      ctx.globalAlpha = 1;
      if (!below && r === shipRow && !shipDrawn) { drawShip(); shipDrawn = true; }
    }
    if (!shipDrawn) drawShip();

    function drawShip() {
      const zc = S.z * RL, d0 = f / (zc - cz);
      shipScreen = [hw + (S.x - cx) * d0, hor + (cy - S.y - 0.15) * d0];
      const c = cellAt(S.x, S.z);
      if (c && c.h <= S.y + 0.3) {           // shadow
        const sy = hor + (cy - c.h) * d0, rx = 0.36 * d0;
        ctx.fillStyle = 'rgba(0,0,0,.38)';
        ctx.beginPath(); ctx.ellipse(shipScreen[0], sy, rx, rx * 0.3, 0, 0, 6.3); ctx.fill();
      }
      const a = -S.bank * 0.55, ca = Math.cos(a), sa = Math.sin(a);
      const P = (lx, ly, lz) => {
        const d = f / (zc + lz - cz);
        return [hw + (S.x + lx * ca - ly * sa - cx) * d, hor + (cy - (S.y + 0.14 + lx * sa + ly * ca)) * d];
      };
      const tri = (p, q, r2, col) => {
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(r2[0], r2[1]); ctx.closePath();
        ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      };
      const N = P(0, 0.04, 0.62), Lw = P(-0.4, 0, -0.38), Rw = P(0.4, 0, -0.38), T = P(0, 0.28, -0.32),
            C = P(0, 0.19, 0.05), Cl = P(-0.1, 0.16, -0.2), Cr = P(0.1, 0.16, -0.2);
      const fl = 0.35 + S.speed * 0.035 + Math.random() * 0.12;
      tri(P(-0.2, 0.08, -0.38), P(0.2, 0.08, -0.38), P(0, 0.08, -0.38 - fl), '#ff8a1e');
      tri(P(-0.1, 0.09, -0.38), P(0.1, 0.09, -0.38), P(0, 0.09, -0.38 - fl * 0.6), '#fff1a8');
      tri(N, Lw, T, '#e6ecff'); tri(N, Rw, T, '#aeb9e8');
      tri(Lw, Rw, T, '#39426e');
      tri(C, Cl, Cr, '#19b6ff');
      const e1 = P(-0.16, 0.09, -0.38), e2 = P(0.16, 0.09, -0.38), er = 0.06 * d0;
      ctx.fillStyle = '#ffd36a';
      ctx.beginPath(); ctx.arc(e1[0], e1[1], er, 0, 6.3); ctx.arc(e2[0], e2[1], er, 0, 6.3); ctx.fill();
    }

    // explosion
    for (const p of parts) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = `hsl(${p.hue} 100% ${50 + 30 * k}%)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, (3 + 9 * k) * dpr, 0, 6.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- main loop ---------- */
  let lastT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
    if (state === 'play') {
      let left = dt;
      while (left > 1e-5 && state === 'play') { const h = Math.min(left, 1 / 120); step(h); left -= h; }
      if (S.time > 4) elHint.classList.add('gone');
    } else if (state === 'dead') {
      S.deadT += dt;
      if (S.kind === 'fall') { S.vy -= GRAV * dt; S.y += S.vy * dt; S.z += S.speed * dt * 0.5; }
      if (S.deadT > 0.9 && elOver.hidden)
        showOver(S.kind === 'crash' ? 'Crashed' : 'Lost in space',
                 `${Math.floor(100 * clamp(S.z / L.finishRow, 0, 1))}% of Road ${S.n}`, 'Try again', () => startLevel(S.di, S.n));
    } else if (state === 'won') {
      S.deadT += dt; S.speed *= Math.pow(0.08, dt); S.z += S.speed * dt; S.bank *= 0.9;
      if (S.y > 0 || S.vy > 0) { S.vy -= GRAV * dt; S.y = Math.max(0, S.y + S.vy * dt); }
      if (S.deadT > 0.8 && elOver.hidden)
        showOver('Road complete', `${DIFFS[S.di].name} · Road ${S.n} in ${S.time.toFixed(1)}s`, 'Next road', () => startLevel(S.di, S.n + 1));
    }
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += H * 0.9 * dt; }
    parts = parts.filter(p => p.t < p.life);
    cam.x += (3.5 + (S.x - 3.5) * 0.75 - cam.x) * Math.min(1, dt * 8);
    cam.y += (2.3 + Math.max(S.y, -1) * 0.6 - cam.y) * Math.min(1, dt * 6);
    draw(now);
    elBar.style.width = (100 * clamp(S.z / L.finishRow, 0, 1)).toFixed(1) + '%';
    if (!elThr.hidden) elSpd.textContent = Math.round(S.speed * 10);
  }
  requestAnimationFrame(frame);

  /* ---------- input ---------- */
  let steerId = null, sx0 = 0, tx0 = 0;
  cv.addEventListener('pointerdown', e => {
    if (state !== 'play' || steerId !== null) return;
    steerId = e.pointerId; sx0 = e.clientX; tx0 = S.x; S.tx = S.x;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerId !== steerId || state !== 'play') return;
    S.tx = clamp(tx0 + (e.clientX - sx0) * LANES / (window.innerWidth * 0.5), 0.3, LANES - 0.3);
  });
  const endSteer = e => { if (e.pointerId === steerId) steerId = null; };
  cv.addEventListener('pointerup', endSteer); cv.addEventListener('pointercancel', endSteer);

  elJump.addEventListener('pointerdown', e => { e.preventDefault(); S.jbuf = 0.15; S.jheld = true; elJump.classList.add('on'); });
  const jumpUp = () => { S.jheld = false; elJump.classList.remove('on'); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => elJump.addEventListener(n, jumpUp));

  function setThrottle(v) {
    S.throttle = clamp(v, 0, 1);
    elKnob.style.bottom = (S.throttle * 100) + '%';
  }
  let thrId = null;
  const thrMove = e => {
    const r = $('track').getBoundingClientRect();
    setThrottle(1 - (e.clientY - r.top) / r.height);
  };
  elThr.addEventListener('pointerdown', e => { e.preventDefault(); thrId = e.pointerId; try { elThr.setPointerCapture(thrId); } catch (err) {} thrMove(e); });
  elThr.addEventListener('pointermove', e => { if (e.pointerId === thrId) thrMove(e); });
  ['pointerup', 'pointercancel'].forEach(n => elThr.addEventListener(n, e => { if (e.pointerId === thrId) thrId = null; }));

  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ' && state === 'play') { S.jbuf = 0.15; e.preventDefault(); }
    if ((e.key === 'p' || e.key === 'Escape') && (state === 'play' || state === 'paused')) togglePause();
    if (e.key === 'Enter' && !elOver.hidden) $('overPrimary').click();
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  function togglePause() {
    if (state === 'play') { state = 'paused'; elPause.hidden = false; }
    else if (state === 'paused') { state = 'play'; elPause.hidden = true; lastT = performance.now(); }
  }
  $('pauseBtn').onclick = togglePause;
  $('resume').onclick = togglePause;
  $('restart').onclick = () => startLevel(S.di, S.n);
  $('toMenu').onclick = () => setState('menu');
  $('overMenu').onclick = () => setState('menu');
  const elMute = $('mute');
  const showMute = () => { elMute.textContent = save.mute ? 'Sound off' : 'Sound on'; };
  elMute.onclick = () => { save.mute = !save.mute; persist(); showMute(); if (!save.mute) sfx.jump(); };
  showMute();
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

  // keep iOS from scrolling, zooming or selecting during play
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- menu ---------- */
  const BLURB = ['Fixed cruising speed. Short gaps, wide roads.',
                 'You set the speed. Longer gaps, burning tiles.',
                 'Faster ship, narrow roads, long jumps.'];
  function renderMenu() {
    const box = $('diffs'); box.textContent = '';
    DIFFS.forEach((D, i) => {
      const row = document.createElement('div'); row.className = 'diff d' + i;
      const info = document.createElement('div'); info.className = 'info';
      const h = document.createElement('h2'); h.textContent = D.name;
      const p = document.createElement('p'); p.textContent = BLURB[i];
      info.append(h, p);
      const stepper = document.createElement('div'); stepper.className = 'stepper';
      const dn = document.createElement('button'), up = document.createElement('button'), lab = document.createElement('span');
      dn.textContent = '‹'; up.textContent = '›';
      dn.setAttribute('aria-label', 'Previous road'); up.setAttribute('aria-label', 'Next road');
      const sync = () => {
        chosen[i] = clamp(chosen[i], 1, save.unlocked[i]);
        lab.textContent = 'Road ' + chosen[i];
        dn.disabled = chosen[i] <= 1; up.disabled = chosen[i] >= save.unlocked[i];
      };
      dn.onclick = () => { chosen[i]--; sync(); };
      up.onclick = () => { chosen[i]++; sync(); };
      stepper.append(dn, lab, up); sync();
      const play = document.createElement('button'); play.className = 'play'; play.textContent = 'Fly';
      play.onclick = () => startLevel(i, chosen[i]);
      row.append(info, stepper, play); box.append(row);
    });
  }
  setState('menu');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  }
  window.__game = { S, startLevel, step, cellAt, get L() { return L; }, get state() { return state; } };
})();
