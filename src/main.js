// Oppstart, knapper og game-loop.
import * as C from './config.js';
import { InputController, MouseInput } from './input.js';
import { createGame, update, restart, pause, togglePause } from './game.js';
import { createRenderer, render, resize } from './renderer.js';

const canvas = document.getElementById('game');
const scoreEl = document.getElementById('score');
const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');

const renderer = createRenderer(canvas);
// MouseInput er bare den første input-provideren. Bytt til f.eks.
// OpenCVInput senere med input.setSource(new OpenCVInput(...)).
const input = new InputController(new MouseInput(canvas));
const game = createGame(input);

// Gjør spill-state tilgjengelig i konsollen når DEBUG er på.
if (C.DEBUG) window.game = game;

resize(renderer);
window.addEventListener('resize', () => {
  resize(renderer);
  render(renderer, game, fps);   // tegn med en gang, uten å vente på neste frame
});

btnStart.addEventListener('click', () => {
  restart(game);
  btnStart.textContent = 'Restart';
  syncButtons();
});

btnPause.addEventListener('click', () => {
  togglePause(game);
  syncButtons();
});

// Pause automatisk hvis vinduet mister fokus, så man ikke taper poeng
// mens musen er et annet sted.
window.addEventListener('blur', () => {
  pause(game);
  syncButtons();
});

function syncButtons() {
  btnPause.disabled = game.state === 'idle';
  btnPause.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
}

let lastTime = performance.now();
let fps = 60;

function frame(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > C.MAX_DELTA) dt = C.MAX_DELTA;
  if (dt < 0) dt = 0;
  if (dt > 0) fps = fps * 0.9 + (1 / dt) * 0.1;

  update(game, dt);
  render(renderer, game, fps);
  updateScore();

  requestAnimationFrame(frame);
}

let lastScore = '0 : 0';   // samme som i index.html
function updateScore() {
  const text = `${game.playerScore} : ${game.cpuScore}`;
  if (text !== lastScore) {
    scoreEl.textContent = text;
    lastScore = text;
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;      // restart animasjonen
    scoreEl.classList.add('pop');
  }
}

updateScore();
syncButtons();
requestAnimationFrame(frame);
