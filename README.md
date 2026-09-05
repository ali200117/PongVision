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