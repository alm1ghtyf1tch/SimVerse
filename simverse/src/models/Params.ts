export type Vec2 = { x: number; y: number };

export type Params = {
  gravity: Vec2;        // world gravity
  airFriction: number;  // Matter's frictionAir (0..~0.1)
  restitution: number;  // bounciness (0..1)
  ballRadius: number;
  ballCount: number;
};

export const DEFAULT_PARAMS: Params = {
  gravity: { x: 0, y: 0.2 },   // "spacey-ish" but still lively; set y=0 for true zero-g
  airFriction: 0.01,
  restitution: 0.9,
  ballRadius: 14,
  ballCount: 20,
};
