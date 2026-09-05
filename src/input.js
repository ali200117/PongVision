// Input-system. Game logic spør KUN InputController om en normalisert
// racket-state, og vet ingenting om mus, kamera eller WebSocket.
//
// En input-source er et objekt med:
//   attach()      - koble til
//   detach()      - koble fra
//   update(dt)    - oppdater intern state
//   getState()    - { x, y, rotation, velocityX, velocityY, angularVelocity }
//
// x: -1 .. +1  (venstre .. høyre)
// y:  0 .. 1   (nærmest spiller .. lengst frem i spillerens område)

export function createInputState() {
  return {
    x: 0,
    y: 0.5,
    rotation: 0,
    velocityX: 0,
    velocityY: 0,
    angularVelocity: 0,
  };
}

export class MouseInput {
  constructor(element) {
    this.element = element;
    this.state = createInputState();
    this.rawX = 0;
    this.rawY = 0.5;
    this.prevX = 0;
    this.prevY = 0.5;
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  attach() {
    this.element.addEventListener('mousemove', this.onMouseMove);
  }

  detach() {
    this.element.removeEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(e) {
    // Bruk CSS-piksler fra elementets bounding rect => alltid korrekt etter resize.
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = (e.clientX - rect.left) / rect.width;   // 0..1
    const ny = (e.clientY - rect.top) / rect.height;   // 0..1 (0 = topp)

    this.rawX = clamp(nx * 2 - 1, -1, 1);
    // Nederst på skjermen = nærmest spilleren = y 0.
    this.rawY = clamp(1 - ny, 0, 1);
  }

  update(dt) {
    // Ingen smoothing: posisjonen følger musen direkte.
    const s = this.state;
    s.x = this.rawX;
    s.y = this.rawY;
    if (dt > 0) {
      s.velocityX = (s.x - this.prevX) / dt;
      s.velocityY = (s.y - this.prevY) / dt;
    } else {
      s.velocityX = 0;
      s.velocityY = 0;
    }
    s.rotation = 0;          // ikke i bruk med mus
    s.angularVelocity = 0;
    this.prevX = s.x;
    this.prevY = s.y;
  }

  getState() {
    return this.state;
  }
}

export class InputController {
  constructor(source) {
    this.source = null;
    this.state = createInputState();
    if (source) this.setSource(source);
  }

  // Bytt input-provider (f.eks. MouseInput -> OpenCVInput) uten at
  // resten av spillet berøres.
  setSource(source) {
    if (this.source && this.source.detach) this.source.detach();
    this.source = source;
    if (this.source && this.source.attach) this.source.attach();
  }

  update(dt) {
    if (!this.source) return;
    this.source.update(dt);
    Object.assign(this.state, this.source.getState());
  }

  getState() {
    return this.state;
  }

  // Bakoverkompatibel kortform.
  getTargetPosition() {
    return { x: this.state.x, y: this.state.y };
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
