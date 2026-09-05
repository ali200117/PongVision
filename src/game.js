// Spill-state: score, runde, serve og oppdatering av alle deler.
import * as C from './config.js';
import { createBall, serveBall, stepBall } from './physics.js';
import { createCpu, updateCpu, getDifficulty, resetCpuAim } from './cpu.js';

export function createGame(input) {
  const game = {
    input,
    state: 'idle',            // 'idle' | 'serving' | 'playing' | 'paused'
    playerScore: 0,
    cpuScore: 0,
    roundNumber: 1,
    serveTimer: 0,
    serveTowardCpu: true,
    ball: createBall(),
    cpu: createCpu(),
    player: { x: 0, z: 0.15, vx: 0, vz: 0 },
    difficulty: getDifficulty(1),
    accumulator: 0,
  };
  return game;
}

export function restart(game) {
  game.playerScore = 0;
  game.cpuScore = 0;
  game.roundNumber = 1;
  game.difficulty = getDifficulty(1);
  game.cpu.x = 0;
  game.cpu.targetX = 0;
  game.serveTowardCpu = true;
  beginServe(game);
}

export function pause(game) {
  if (game.state === 'playing' || game.state === 'serving') {
    game.pausedFrom = game.state;
    game.state = 'paused';
  }
}

export function resume(game) {
  if (game.state === 'paused') game.state = game.pausedFrom || 'playing';
}

export function togglePause(game) {
  if (game.state === 'paused') resume(game);
  else pause(game);
}

function beginServe(game) {
  game.state = 'serving';
  game.serveTimer = C.SERVE_DELAY;
  game.accumulator = 0;
  resetCpuAim(game.cpu);
  serveBall(game.ball, game.serveTowardCpu);
  game.ball.vx = 0;
  game.ball.vy = 0;
  game.ball.vz = 0;
}

function launchServe(game) {
  serveBall(game.ball, game.serveTowardCpu);
  game.state = 'playing';
}

function scorePoint(game, who) {
  if (who === 'player') game.playerScore++;
  else game.cpuScore++;
  game.roundNumber++;
  game.difficulty = getDifficulty(game.roundNumber);
  // Taperen av ballvekslingen server neste ball mot motstanderen.
  game.serveTowardCpu = who === 'player';
  beginServe(game);
}

export function update(game, dt) {
  // Input og spillerens racket oppdateres alltid, slik at racketen
  // følger musen også før start og under pause.
  game.input.update(dt);
  updatePlayerRacket(game, dt);

  if (game.state === 'serving') {
    game.serveTimer -= dt;
    if (game.serveTimer <= 0) launchServe(game);
    return;
  }
  if (game.state !== 'playing') return;

  // Fast fysikk-steg => uavhengig av skjermens FPS.
  game.accumulator += dt;
  let guard = 0;
  while (game.accumulator >= C.PHYSICS_STEP && guard++ < 500) {
    game.accumulator -= C.PHYSICS_STEP;
    updateCpu(game.cpu, game.ball, game.difficulty, C.PHYSICS_STEP);
    const result = stepBall(game.ball, game.player, game.cpu, C.PHYSICS_STEP);
    if (result === 'playerPoint') { scorePoint(game, 'player'); return; }
    if (result === 'cpuPoint') { scorePoint(game, 'cpu'); return; }
  }
}

function updatePlayerRacket(game, dt) {
  const s = game.input.getState();
  const A = C.PLAYER_AREA;
  const nx = clamp(s.x, -1, 1);
  const ny = clamp(s.y, 0, 1);

  const x = A.X_MIN + (nx + 1) * 0.5 * (A.X_MAX - A.X_MIN);
  const z = A.Z_MIN + ny * (A.Z_MAX - A.Z_MIN);

  const p = game.player;
  if (dt > 0) {
    p.vx = (x - p.x) / dt;
    p.vz = (z - p.z) / dt;
  }
  p.x = x;
  p.z = z;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
