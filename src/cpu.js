// Enkel CPU-paddle. Ingen ML, ingen teleportering: maks fart, reaksjonstid
// og et siktefeil som begge krymper med roundNumber (med harde grenser).
import * as C from './config.js';

export function createCpu() {
  return {
    x: 0,
    z: C.CPU_RACKET_Z,
    vx: 0,
    targetX: 0,
    aimError: 0,
    reactionTimer: 0,
    approaching: false,
  };
}

// Nullstill CPU-ens siktesyklus (kalles ved hver serve).
export function resetCpuAim(cpu) {
  cpu.approaching = false;
  cpu.aimError = 0;
  cpu.targetX = 0;
  cpu.reactionTimer = 0;
}

export function getDifficulty(roundNumber) {
  const r = Math.max(0, roundNumber - 1);
  const I = C.DIFFICULTY_INCREMENT;
  return {
    speed: Math.min(C.CPU_BASE_SPEED + r * I.SPEED, C.CPU_MAX_SPEED),
    reaction: Math.max(C.CPU_BASE_REACTION - r * I.REACTION, C.CPU_MIN_REACTION),
    error: Math.max(C.CPU_BASE_ERROR - r * I.ERROR, C.CPU_MIN_ERROR),
  };
}

export function updateCpu(cpu, ball, difficulty, dt) {
  const incoming = ball.vz > 0;

  if (incoming && !cpu.approaching) {
    // Ny innkommende ball: start reaksjonstiden på nytt.
    cpu.approaching = true;
    cpu.reactionTimer = difficulty.reaction;
  } else if (!incoming) {
    cpu.approaching = false;
    cpu.targetX = 0; // gå rolig mot midten mellom slagene
  }

  if (incoming) {
    if (cpu.reactionTimer > 0) {
      cpu.reactionTimer -= dt;
      if (cpu.reactionTimer <= 0) {
        cpu.aimError = (Math.random() * 2 - 1) * difficulty.error;
        cpu.targetX = aimTarget(cpu, ball);
      }
    } else {
      // Følg ballen videre, men behold siktefeilen for denne ballvekslingen.
      cpu.targetX = aimTarget(cpu, ball);
    }
  }

  const maxStep = difficulty.speed * dt;
  const delta = cpu.targetX - cpu.x;
  const step = clamp(delta, -maxStep, maxStep);
  cpu.x = clamp(cpu.x + step, -C.CPU_X_LIMIT, C.CPU_X_LIMIT);
  cpu.vx = dt > 0 ? step / dt : 0;
}

function timeToPlane(cpu, ball) {
  if (ball.vz <= 0) return 0;
  return Math.max(0, (cpu.z - ball.z) / ball.vz);
}

function aimTarget(cpu, ball) {
  const predicted = ball.x + ball.vx * timeToPlane(cpu, ball);
  return clamp(predicted + cpu.aimError, -C.CPU_X_LIMIT, C.CPU_X_LIMIT);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
