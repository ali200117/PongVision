// Ball-fysikk og racket-collision. Alt i world-koordinater.
//
// Racket-hitboxen er en ellipse i planet z = racket.z, med senter i
// (racket.x, RACKET.CENTER_Y). Renderer tegner nøyaktig samme ellipse,
// slik at ballen treffer der den ser ut til å treffe.
import * as C from './config.js';

export function createBall() {
  return {
    x: 0, y: C.RACKET.CENTER_Y, z: 0.5,
    vx: 0, vy: 0, vz: 0,
    speed: C.BALL_BASE_SPEED,
    lastHitBy: null,          // 'player' | 'cpu'
    canHitPlayer: false,      // én retur per passering
    canHitCpu: false,
    hitCount: 0,              // teller opp ved hvert racket-treff
    bounceCount: 0,           // teller opp ved hvert sprett på bordet
    lastContact: null,        // siste racket-treff (world-punkt)
    lastBounce: null,         // siste sprett (world-punkt)
  };
}

export function serveBall(ball, towardCpu) {
  const fromZ = towardCpu ? 0.3 : 0.7;
  const targetZ = towardCpu ? C.CPU_RACKET_Z : 0.2;

  ball.x = 0;
  ball.y = C.RACKET.CENTER_Y;
  ball.z = fromZ;
  ball.speed = C.BALL_BASE_SPEED;
  ball.vx = (Math.random() * 2 - 1) * 0.12;
  ball.vz = towardCpu ? ball.speed : -ball.speed;
  ball.vy = launchVy(ball.y, fromZ, targetZ, ball.speed);
  ball.lastHitBy = towardCpu ? 'player' : 'cpu';
  ball.canHitPlayer = !towardCpu;
  ball.canHitCpu = towardCpu;
  ball.lastContact = null;
  ball.lastBounce = null;
}

// Ett fast fysikk-steg. Returnerer null, 'playerPoint' eller 'cpuPoint'.
export function stepBall(ball, player, cpu, dt) {
  const prevZ = ball.z;
  const prevY = ball.y;

  ball.vy -= C.GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  // Sprett på bordplaten.
  if (ball.y < C.BALL_RADIUS && ball.vy < 0 && onTable(ball)) {
    ball.y = C.BALL_RADIUS;
    ball.vy = Math.abs(ball.vy) * C.BOUNCE_RESTITUTION;
    ball.bounceCount++;
    ball.lastBounce = { x: ball.x, z: ball.z, id: ball.bounceCount };
  }

  // Tillat retur igjen når ballen har passert nettet mot en side.
  if (ball.vz < 0 && ball.z < C.WORLD.NET_Z) ball.canHitPlayer = true;
  if (ball.vz > 0 && ball.z > C.WORLD.NET_Z) ball.canHitCpu = true;

  // --- Racket-collision (swept: sjekk om ballen krysset racket-planet) ---
  if (ball.vz < 0 && ball.canHitPlayer && prevZ > player.z && ball.z <= player.z) {
    const t = crossingT(prevZ, ball.z, player.z);
    const hx = lerp(ball.x - ball.vx * dt, ball.x, t);
    const hy = lerp(prevY, ball.y, t);
    if (insideRacket(hx - player.x, hy)) {
      returnBall(ball, player.z, hx, hy, hx - player.x, 1, player.vx, C.CPU_RACKET_Z);
      ball.canHitPlayer = false;
      ball.lastHitBy = 'player';
      return null;
    }
  }

  if (ball.vz > 0 && ball.canHitCpu && prevZ < cpu.z && ball.z >= cpu.z) {
    const t = crossingT(prevZ, ball.z, cpu.z);
    const hx = lerp(ball.x - ball.vx * dt, ball.x, t);
    const hy = lerp(prevY, ball.y, t);
    if (insideRacket(hx - cpu.x, hy)) {
      returnBall(ball, cpu.z, hx, hy, hx - cpu.x, -1, cpu.vx, player.z);
      ball.canHitCpu = false;
      ball.lastHitBy = 'cpu';
      return null;
    }
  }

  // --- Nettet ---
  if ((prevZ - C.WORLD.NET_Z) * (ball.z - C.WORLD.NET_Z) < 0) {
    const t = crossingT(prevZ, ball.z, C.WORLD.NET_Z);
    const hy = lerp(prevY, ball.y, t);
    if (hy - C.BALL_RADIUS < C.WORLD.NET_HEIGHT) {
      ball.z = C.WORLD.NET_Z;
      ball.vz = 0;
      ball.vx *= 0.2;
      return ball.lastHitBy === 'player' ? 'cpuPoint' : 'playerPoint';
    }
  }

  // --- Poeng ---
  if (Math.abs(ball.x) > C.WORLD.X_MAX + 0.15) {
    // Ute på siden: den som slo sist taper poenget.
    return ball.lastHitBy === 'player' ? 'cpuPoint' : 'playerPoint';
  }
  if (ball.z < C.WORLD.Z_MIN - 0.12) return 'cpuPoint';
  if (ball.z > C.WORLD.Z_MAX + 0.12) return 'playerPoint';

  return null;
}

function onTable(ball) {
  return ball.z >= C.WORLD.Z_MIN && ball.z <= C.WORLD.Z_MAX &&
         Math.abs(ball.x) <= C.WORLD.X_MAX;
}

// Startfart oppover. Ballen skal sprette på bordet et stykke inne på
// motstanderens halvdel, og alltid klare nettet med margin.
function launchVy(height, fromZ, targetZ, speed) {
  const v = Math.max(speed, 0.01);
  const netBetween = (fromZ - C.WORLD.NET_Z) * (targetZ - C.WORLD.NET_Z) < 0;

  // Der ballen skal treffe bordet.
  const bounceZ = netBetween
    ? C.WORLD.NET_Z + (targetZ - C.WORLD.NET_Z) * C.BOUNCE_AT
    : (fromZ + targetZ) / 2;

  const bounceTime = Math.max(Math.abs(bounceZ - fromZ) / v, 0.05);
  let vy = (C.GRAVITY * bounceTime * bounceTime / 2 - height) / bounceTime;

  if (netBetween) {
    const netTime = Math.abs(C.WORLD.NET_Z - fromZ) / v;
    const needed = C.WORLD.NET_HEIGHT + C.BALL_RADIUS + C.NET_CLEARANCE;
    const vyNet = (needed - height + C.GRAVITY * netTime * netTime / 2) / netTime;
    vy = Math.max(vy, vyNet);
  }
  return vy;
}

// Ellipse-test med ballradius lagt til.
export function insideRacket(offsetX, height) {
  const nx = offsetX / (C.RACKET.HALF_WIDTH + C.BALL_RADIUS);
  const ny = (height - C.RACKET.CENTER_Y) / (C.RACKET.HALF_HEIGHT + C.BALL_RADIUS);
  return nx * nx + ny * ny <= 1;
}

// dir = +1 (mot CPU) eller -1 (mot spiller).
function returnBall(ball, planeZ, hx, hy, offsetX, dir, racketVx, targetZ) {
  ball.speed = Math.min(ball.speed + C.BALL_SPEED_GAIN, C.BALL_MAX_SPEED);

  const normalized = clamp(offsetX / C.RACKET.HALF_WIDTH, -1, 1);
  let vx = normalized * C.HIT_ANGLE_INFLUENCE * ball.speed;
  vx += clamp(racketVx, -3, 3) * C.RACKET_VELOCITY_INFLUENCE;

  // Sett ballen nøyaktig i kontaktpunktet, men litt forbi racket-planet
  // slik at samme kontakt ikke kan registreres to ganger.
  ball.x = hx;
  ball.y = Math.max(hy, C.BALL_RADIUS);
  ball.z = planeZ + dir * (C.BALL_RADIUS * 0.5);

  ball.vx = clamp(vx, -C.BALL_MAX_VX, C.BALL_MAX_VX);
  ball.vz = dir * ball.speed;
  ball.vy = launchVy(ball.y, ball.z, targetZ, ball.speed);

  ball.hitCount++;
  ball.lastContact = { x: hx, y: ball.y, z: planeZ, id: ball.hitCount, by: dir > 0 ? 'player' : 'cpu' };
}

function crossingT(prevZ, z, planeZ) {
  const denom = z - prevZ;
  if (Math.abs(denom) < 1e-9) return 1;
  return clamp((planeZ - prevZ) / denom, 0, 1);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
