# Ping Pong CV

Et enkelt pingpong-spill laget som grunnlag for senere integrasjon med Computer Vision.

Spilleren styrer racketen med musen, mens CPU-en returnerer ballen og blir gradvis vanskeligere etter hvert som spillet fortsetter.

## Teknologi

- HTML5
- CSS
- Vanilla JavaScript
- HTML5 Canvas

## Funksjoner

- Mouse-controlled racket
- CPU-motstander
- Poengteller
- Gradvis økende CPU-vanskelighetsgrad
- Start, pause og restart
- Enkel pingpong-fysikk

## Videre utvikling

Målet er å erstatte mouse-input med en fysisk pingpong-racket som spores med kamera og OpenCV.

Planlagt dataflyt:

**Fysisk racket → Kamera → OpenCV → Input Controller → Spill**

Arkitekturen holder input separat fra game logic, slik at OpenCV kan kobles inn senere uten å bygge om selve spillet.
## Kjøring

Spillet bruker ES-moduler og må serveres over HTTP (ikke `file://`):

```
python -m http.server 5177
```

Åpne deretter http://localhost:5177

## Struktur

```
index.html      canvas, score og knapper
styles.css      minimal layout
src/config.js   alle tunbare konstanter + DEBUG-flagg
src/input.js    InputController + MouseInput (normalisert racket-state)
src/physics.js  ballbevegelse, sprett og racket-collision
src/cpu.js      CPU-paddle og difficulty basert på roundNumber
src/game.js     score, rundestate, serve og oppdateringsrekkefølge
src/renderer.js projeksjon world -> skjerm, all tegning
src/main.js     oppstart, knapper og requestAnimationFrame-loop
```

## Gameplay-detaljer

- Racket-hitboxen er den **samme ellipsen som tegnes** (pluss ballradius), så
  ballen treffer nøyaktig der den ser ut til å treffe. Racketen dekker raust
  vertikalt, siden spilleren ikke styrer høyde.
- Hvert slag beregner en ballistisk bue som **spretter på motstanderens
  halvdel** (`BOUNCE_AT`) og klarer nettet med margin (`NET_CLEARANCE`).
  Det er spretten som gir dybdefølelsen.
- Treffpunkt på racketen og racketens sidefart styrer retningen.
- Ball i nettet eller utenfor bordet gir poeng til motstanderen.
- `DEBUG = true` viser hitbox, kontaktpunkt, normalisert input, roundNumber,
  CPU-difficulty og FPS.

## Koordinatsystem

- `x`: -1 (venstre bordkant) .. +1 (høyre bordkant)
- `z`: 0 (spillerens side) .. 1 (CPU-siden)
- `y`: høyde over bordplaten

Kun `renderer.js` kjenner piksler.

## Input-arkitektur (klar for OpenCV)

`InputController` leverer en normalisert state til spillet:

```js
{ x, y, rotation, velocityX, velocityY, angularVelocity }
```

`MouseInput` er bare den første provideren. En framtidig `OpenCVInput`
(matet av WebSocket fra Python/OpenCV) trenger kun `attach/detach/update/getState`
og settes inn med `input.setSource(new OpenCVInput(...))` i `main.js` —
ball-fysikk, CPU og resten av spillogikken er uendret.
