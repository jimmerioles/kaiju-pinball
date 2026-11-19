export const TABLE = {
  halfWidth: 11.8,
  topZ: -19,
  bottomZ: 15,
  drainZ: 15.2,
  cell: 2.45,
  columns: 9,
  rows: 13,
  cityXStart: -9.8,
  cityZStart: -16.2,
} as const;

export const BALL = {
  radius: 0.66,
  gravityY: -38,
  gravityZ: 9,
  restitution: 0.46,
  wallRestitution: 0.82,
  maxSpeed: 40,
  steerForce: 26,
} as const;

export const GAME = {
  duration: 90,
  balls: 3,
  comboWindow: 2.6,
  maxMultiplier: 12,
  launchZ: 10.5,
  launchHeight: 2.1,
  respawnDelay: 1.05,
  ballSaveDuration: 5,
} as const;

export const PALETTE = {
  fragile: [0xf7c9b2, 0xa8e0c8, 0xf5e0a3, 0xc9b8f0, 0xa9c9ef, 0xf3a7a0, 0xdad3c6],
  solid: [0x9a93ad, 0x7f9c94, 0xb49a83, 0x8f8aa4, 0x9aa8a0],
  bumper: [0xffb347, 0xff8a6d, 0x9be3ff, 0xffd166],
} as const;
