// Alle tunbare gameplay-konstanter samlet ett sted.
// Verdenskoordinater:
//   x : -1 (venstre bordkant) .. +1 (høyre bordkant)
//   z :  0 (spillerens kortside) .. 1 (CPU sin kortside)
//   y :  0 (bordplaten) og oppover (høyde)

export const DEBUG = false;

export const WORLD = {
  X_MIN: -1,
  X_MAX: 1,
  Z_MIN: 0,
  Z_MAX: 1,
  NET_Z: 0.5,
  NET_HEIGHT: 0.09,
};

// Ball
export const BALL_RADIUS = 0.035;
export const BALL_BASE_SPEED = 0.95;       // z-enheter per sekund ved serve
export const BALL_SPEED_GAIN = 0.03;       // fart lagt til per treff
export const BALL_MAX_SPEED = 1.8;
export const BALL_MAX_VX = 0.5;            // maks sideveis fart
export const GRAVITY = 6.0;                // y-enheter per sekund^2
export const BOUNCE_RESTITUTION = 0.72;

// Banen på returen: ballen slås i en bue som spretter på motstanderens
// halvdel, BOUNCE_AT av veien fra nettet til motstanderens racket-plan.
// Nettklaringen er en sikkerhetsgrense som sjelden slår inn.
export const BOUNCE_AT = 0.55;
export const NET_CLEARANCE = 0.06;

// Spillerens lovlige område (racket-senter)
export const PLAYER_AREA = {
  X_MIN: -0.9,
  X_MAX: 0.9,
  Z_MIN: 0.05,
  Z_MAX: 0.34,
};

// Racket. Hitboxen er den samme ellipsen som tegnes på skjermen.
// Høyden er raus fordi spilleren ikke styrer racketen vertikalt.
export const RACKET = {
  HALF_WIDTH: 0.14,
  HALF_HEIGHT: 0.17,
  CENTER_Y: 0.18,
  HANDLE_LENGTH: 0.14,
};

export const CPU_RACKET_Z = 0.94;
export const CPU_X_LIMIT = 0.9;

// Hvor mye treffpunkt / racketfart påvirker retningen
export const HIT_ANGLE_INFLUENCE = 0.5;    // treffpunkt på racket -> vx
export const RACKET_VELOCITY_INFLUENCE = 0.12;

// CPU difficulty (skaleres med roundNumber, alltid innenfor min/max)
export const CPU_BASE_SPEED = 1.05;        // world-x per sekund
export const CPU_MAX_SPEED = 2.3;
export const CPU_BASE_REACTION = 0.34;     // sekunder før CPU sikter på ny bane
export const CPU_MIN_REACTION = 0.08;
export const CPU_BASE_ERROR = 0.24;        // world-x avvik i sikting
export const CPU_MIN_ERROR = 0.04;
export const DIFFICULTY_INCREMENT = {
  SPEED: 0.06,
  REACTION: 0.015,
  ERROR: 0.012,
};

// Timing
export const SERVE_DELAY = 0.8;            // sekunder pause etter poeng
export const MAX_DELTA = 0.05;             // clamp av deltaTime (s)
export const PHYSICS_STEP = 1 / 240;       // fast fysikk-steg

// Visuelt (påvirker ikke spillogikk)
export const CAMERA_SWAY = 0.07;           // hvor mye scenen lener med spilleren
export const PADDLE_LEAN = 0.09;           // hvor mye racketen tipper av farten
export const TRAIL_LENGTH = 14;            // antall punkter i ballens hale
