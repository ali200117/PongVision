// Tegning + projeksjon fra world- til skjermkoordinater.
// Kun denne fila kjenner piksler. All visuell tilstand (hale, sprett-ringer,
// kamera, racket-tipp) ligger her, slik at spillogikken forblir ren.
import * as C from './config.js';

const PERSPECTIVE = 1.25;
const SCALE_FAR = 1 / (1 + PERSPECTIVE);
const TABLE_THICKNESS = 0.05;

export function createRenderer(canvas) {
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    width: 0,
    height: 0,
    dpr: 1,
    camX: 0,
    lean: { player: 0, cpu: 0 },
    trail: [],
    rings: [],
    flash: { player: 0, cpu: 0 },
    seenHit: 0,
    seenBounce: 0,
    lastTime: 0,
  };
}

export function resize(r) {
  const dpr = window.devicePixelRatio || 1;
  r.width = r.canvas.clientWidth;
  r.height = r.canvas.clientHeight;
  r.dpr = dpr;
  r.canvas.width = Math.max(1, Math.round(r.width * dpr));
  r.canvas.height = Math.max(1, Math.round(r.height * dpr));
  r.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// world (x: -1..1, y: høyde, z: 0..1) -> skjerm-piksler
export function project(r, x, y, z) {
  const nearHalfW = Math.min(r.width * 0.42, r.height * 0.42);
  const span = Math.min(r.height * 0.62, nearHalfW * 2.5);
  const nearY = r.height * 0.5 + span * 0.55;
  const scale = 1 / (1 + PERSPECTIVE * z);
  const u = (1 - scale) / (1 - SCALE_FAR);       // 0 = nær, 1 = langt unna

  return {
    x: r.width / 2 + (x - r.camX) * nearHalfW * scale,
    y: nearY - span * u - y * nearHalfW * scale,
    scale,
    unit: nearHalfW * scale,                      // piksler per world-enhet
  };
}

export function render(r, game, fps) {
  const now = performance.now();
  const dt = r.lastTime ? Math.min((now - r.lastTime) / 1000, 0.05) : 0;
  r.lastTime = now;
  updateVisuals(r, game, dt);

  const { ctx } = r;
  ctx.clearRect(0, 0, r.width, r.height);
  drawBackground(r);
  drawTable(r);
  drawRings(r);

  // Enkel dybdesortering: det som er lengst unna tegnes først.
  const layers = [
    { z: game.cpu.z, draw: () => drawRacket(r, game.cpu, r.lean.cpu, r.flash.cpu, PADDLE_CPU) },
    { z: C.WORLD.NET_Z, draw: () => drawNet(r) },
    { z: game.ball.z, draw: () => drawBall(r, game.ball) },
    { z: game.player.z, draw: () => drawRacket(r, game.player, r.lean.player, r.flash.player, PADDLE_PLAYER) },
  ];
  layers.sort((a, b) => b.z - a.z);
  layers.forEach((layer) => layer.draw());

  drawVignette(r);

  if (game.state === 'idle') drawOverlay(r, 'Trykk Start', 'Styr racketen med musen');
  else if (game.state === 'paused') drawOverlay(r, 'Pause', 'Trykk Resume for å fortsette');

  if (C.DEBUG) drawDebug(r, game, fps);
}

/* ---------- visuell tilstand ---------- */

function updateVisuals(r, game, dt) {
  const ball = game.ball;

  // kamera lener forsiktig med spilleren
  r.camX += (game.player.x * C.CAMERA_SWAY - r.camX) * Math.min(1, dt * 6);

  // racketene tipper etter sidefarten
  r.lean.player = approach(r.lean.player, clamp(game.player.vx * C.PADDLE_LEAN, -0.5, 0.5), dt * 12);
  r.lean.cpu = approach(r.lean.cpu, clamp(game.cpu.vx * C.PADDLE_LEAN, -0.5, 0.5), dt * 12);

  // hale etter ballen
  const last = r.trail[r.trail.length - 1];
  if (!last || dist2(last, ball) > 0.09) r.trail.length = 0;   // serve/teleport
  r.trail.push({ x: ball.x, y: ball.y, z: ball.z });
  while (r.trail.length > C.TRAIL_LENGTH) r.trail.shift();
  if (game.state !== 'playing') r.trail.length = 0;

  // sprett-ring på bordet
  if (ball.lastBounce && ball.lastBounce.id !== r.seenBounce) {
    r.seenBounce = ball.lastBounce.id;
    r.rings.push({ x: ball.lastBounce.x, z: ball.lastBounce.z, life: 1 });
  }
  r.rings = r.rings.filter((ring) => (ring.life -= dt * 1.8) > 0);

  // blink på racketen ved treff
  if (ball.lastContact && ball.lastContact.id !== r.seenHit) {
    r.seenHit = ball.lastContact.id;
    if (ball.lastContact.by === 'player') r.flash.player = 1;
    else r.flash.cpu = 1;
  }
  r.flash.player = Math.max(0, r.flash.player - dt * 6);
  r.flash.cpu = Math.max(0, r.flash.cpu - dt * 6);
}

/* ---------- bakgrunn ---------- */

function drawBackground(r) {
  const { ctx } = r;
  const g = ctx.createLinearGradient(0, 0, 0, r.height);
  g.addColorStop(0, '#0a1a27');
  g.addColorStop(0.6, '#0c2131');
  g.addColorStop(1, '#050d15');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r.width, r.height);

  const c = project(r, 0, 0, 0.55);
  const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(r.width, r.height) * 0.5);
  glow.addColorStop(0, 'rgba(130, 200, 245, 0.14)');
  glow.addColorStop(1, 'rgba(130, 200, 245, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, r.width, r.height);
}

function drawVignette(r) {
  const { ctx } = r;
  const g = ctx.createRadialGradient(
    r.width / 2, r.height / 2, Math.min(r.width, r.height) * 0.35,
    r.width / 2, r.height / 2, Math.max(r.width, r.height) * 0.75
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r.width, r.height);
}

/* ---------- bord ---------- */

function drawTable(r) {
  const { ctx } = r;
  const X = C.WORLD.X_MAX;
  const nl = project(r, -X, 0, C.WORLD.Z_MIN);
  const nr = project(r, X, 0, C.WORLD.Z_MIN);
  const fr = project(r, X, 0, C.WORLD.Z_MAX);
  const fl = project(r, -X, 0, C.WORLD.Z_MAX);
  const nlb = project(r, -X, -TABLE_THICKNESS, C.WORLD.Z_MIN);
  const nrb = project(r, X, -TABLE_THICKNESS, C.WORLD.Z_MIN);
  const frb = project(r, X, -TABLE_THICKNESS, C.WORLD.Z_MAX);
  const flb = project(r, -X, -TABLE_THICKNESS, C.WORLD.Z_MAX);

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#02070c';
  polygon(ctx, [
    { x: nlb.x - 16, y: nlb.y + 10 },
    { x: nrb.x + 16, y: nrb.y + 10 },
    { x: frb.x + 5, y: frb.y + 5 },
    { x: flb.x - 5, y: flb.y + 5 },
  ]);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#06304a';
  polygon(ctx, [nl, nr, nrb, nlb]);
  ctx.fill();
  ctx.fillStyle = '#05283c';
  polygon(ctx, [nl, nlb, flb, fl]);
  ctx.fill();
  polygon(ctx, [nr, nrb, frb, fr]);
  ctx.fill();

  const top = ctx.createLinearGradient(0, fl.y, 0, nl.y);
  top.addColorStop(0, '#12688f');
  top.addColorStop(0.55, '#0e577a');
  top.addColorStop(1, '#0a4462');
  ctx.fillStyle = top;
  polygon(ctx, [nl, nr, fr, fl]);
  ctx.fill();

  const lineWidth = Math.max(1.5, r.width * 0.0026);
  ctx.strokeStyle = 'rgba(238, 247, 255, 0.9)';
  ctx.lineWidth = lineWidth;
  polygon(ctx, [nl, nr, fr, fl]);
  ctx.stroke();

  const a = project(r, 0, 0, C.WORLD.Z_MIN);
  const b = project(r, 0, 0, C.WORLD.Z_MAX);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = lineWidth * 0.7;
  ctx.strokeStyle = 'rgba(238, 247, 255, 0.4)';
  ctx.stroke();
}

function drawNet(r) {
  const { ctx } = r;
  const z = C.WORLD.NET_Z;
  const h = C.WORLD.NET_HEIGHT;
  const X = C.WORLD.X_MAX + 0.05;
  const bl = project(r, -X, 0, z);
  const br = project(r, X, 0, z);
  const tl = project(r, -X, h, z);
  const tr = project(r, X, h, z);

  ctx.fillStyle = 'rgba(220, 238, 250, 0.12)';
  polygon(ctx, [bl, br, tr, tl]);
  ctx.fill();

  ctx.save();
  polygon(ctx, [bl, br, tr, tl]);
  ctx.clip();
  ctx.strokeStyle = 'rgba(220, 238, 250, 0.2)';
  ctx.lineWidth = 1;
  const cols = 40;
  for (let i = 1; i < cols; i++) {
    const x = bl.x + (br.x - bl.x) * (i / cols);
    ctx.beginPath();
    ctx.moveTo(x, bl.y);
    ctx.lineTo(x, tl.y);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const y = bl.y + (tl.y - bl.y) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(bl.x, y);
    ctx.lineTo(br.x, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(245, 251, 255, 0.95)';
  ctx.lineWidth = Math.max(2, r.width * 0.0026);
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(190, 215, 232, 0.75)';
  ctx.lineWidth = Math.max(1.5, r.width * 0.002);
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y); ctx.lineTo(tl.x, tl.y);
  ctx.moveTo(br.x, br.y); ctx.lineTo(tr.x, tr.y);
  ctx.stroke();
}

function drawRings(r) {
  const { ctx } = r;
  r.rings.forEach((ring) => {
    const p = project(r, ring.x, 0, ring.z);
    const grow = 1 - ring.life;
    const rad = C.BALL_RADIUS * p.unit * (1 + grow * 4);
    ctx.save();
    ctx.globalAlpha = ring.life * 0.5;
    ctx.strokeStyle = '#dff2ff';
    ctx.lineWidth = Math.max(1, p.unit * 0.012);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rad, rad * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

/* ---------- ball ---------- */

function drawBall(r, ball) {
  const { ctx } = r;

  // skygge rett under ballen
  if (ball.z >= C.WORLD.Z_MIN - 0.05 && ball.z <= C.WORLD.Z_MAX + 0.05 && Math.abs(ball.x) <= 1.1) {
    const s = project(r, ball.x, 0, ball.z);
    const height = Math.max(0, ball.y);
    const rad = C.BALL_RADIUS * s.unit * (1 + height * 0.9);
    ctx.save();
    ctx.globalAlpha = 0.45 / (1 + height * 4);
    ctx.fillStyle = '#010a12';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, rad * 1.2, rad * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const p = project(r, ball.x, ball.y, ball.z);
  // minste synlige størrelse, slik at ballen kan følges også langt unna
  const rad = Math.max(r.width * 0.0075, C.BALL_RADIUS * p.unit);

  // hale
  if (r.trail.length > 2) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 1; i < r.trail.length; i++) {
      const a = project(r, r.trail[i - 1].x, r.trail[i - 1].y, r.trail[i - 1].z);
      const b = project(r, r.trail[i].x, r.trail[i].y, r.trail[i].z);
      const t = i / r.trail.length;
      ctx.globalAlpha = t * 0.28;
      ctx.strokeStyle = '#fff6d0';
      ctx.lineWidth = rad * 1.5 * t;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const g = ctx.createRadialGradient(
    p.x - rad * 0.35, p.y - rad * 0.4, rad * 0.1,
    p.x, p.y, rad
  );
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#fbf3d4');
  g.addColorStop(1, '#d9be6a');
  ctx.save();
  ctx.shadowColor = 'rgba(255, 244, 200, 0.75)';
  ctx.shadowBlur = rad * 2.2;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- racketer ---------- */

const PADDLE_PLAYER = { face: '#3f8fdf', faceDark: '#1a4d85', rim: '#f2f7fb', handle: '#c99553' };
const PADDLE_CPU = { face: '#e0533f', faceDark: '#8f2c1e', rim: '#f8ece7', handle: '#c99553' };

function drawRacket(r, racket, lean, flash, colors) {
  const { ctx } = r;
  const center = project(r, racket.x, C.RACKET.CENTER_Y, racket.z);
  const unit = center.unit;
  const rx = C.RACKET.HALF_WIDTH * unit;
  const ry = C.RACKET.HALF_HEIGHT * unit;
  const pop = 1 + flash * 0.08;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(lean);
  ctx.scale(pop, pop);

  // håndtak
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, rx * 0.3);
  ctx.strokeStyle = colors.handle;
  ctx.beginPath();
  ctx.moveTo(0, ry * 0.5);
  ctx.lineTo(0, ry + C.RACKET.HANDLE_LENGTH * unit);
  ctx.stroke();

  // slagflate
  const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, rx * 0.1, 0, 0, rx * 1.25);
  g.addColorStop(0, colors.face);
  g.addColorStop(1, colors.faceDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(1.5, rx * 0.09);
  ctx.strokeStyle = colors.rim;
  ctx.stroke();

  if (flash > 0) {
    ctx.globalAlpha = flash * 0.5;
    ctx.lineWidth = Math.max(2, rx * 0.16);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (C.DEBUG) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(
      0, 0,
      (C.RACKET.HALF_WIDTH + C.BALL_RADIUS) * unit,
      (C.RACKET.HALF_HEIGHT + C.BALL_RADIUS) * unit,
      0, 0, Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- overlay ---------- */

function drawOverlay(r, title, subtitle) {
  const { ctx } = r;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 12, 20, 0.6)';
  ctx.fillRect(0, 0, r.width, r.height);
  ctx.textAlign = 'center';
  const base = Math.min(r.width, r.height);
  ctx.fillStyle = '#eef6fc';
  ctx.font = `700 ${Math.round(base * 0.068)}px system-ui, sans-serif`;
  ctx.fillText(title, r.width / 2, r.height * 0.47);
  ctx.fillStyle = 'rgba(238, 246, 252, 0.65)';
  ctx.font = `400 ${Math.round(base * 0.026)}px system-ui, sans-serif`;
  ctx.fillText(subtitle, r.width / 2, r.height * 0.53);
  ctx.restore();
}

function drawDebug(r, game, fps) {
  const { ctx } = r;
  const s = game.input.getState();
  const d = game.difficulty;
  const b = game.ball;
  const lines = [
    `fps: ${fps.toFixed(0)}`,
    `state: ${game.state}`,
    `round: ${game.roundNumber}`,
    `input x/y: ${s.x.toFixed(2)} / ${s.y.toFixed(2)}`,
    `input vx/vy: ${s.velocityX.toFixed(2)} / ${s.velocityY.toFixed(2)}`,
    `player x/z: ${game.player.x.toFixed(2)} / ${game.player.z.toFixed(2)}`,
    `ball x/y/z: ${b.x.toFixed(2)} / ${b.y.toFixed(2)} / ${b.z.toFixed(2)}`,
    `ball speed: ${b.speed.toFixed(2)}  bounces: ${b.bounceCount}`,
    `cpu speed: ${d.speed.toFixed(2)}  reaction: ${d.reaction.toFixed(2)}  error: ${d.error.toFixed(2)}`,
  ];
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = '#8ef7c1';
  lines.forEach((line, i) => ctx.fillText(line, 12, 20 + i * 15));

  if (b.lastContact) {
    const p = project(r, b.lastContact.x, b.lastContact.y, b.lastContact.z);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- småting ---------- */

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function approach(value, target, t) {
  return value + (target - value) * Math.min(1, Math.max(0, t));
}

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
