import type { Params } from "../models/Params";

export type Preset = {
  name: string;
  params: Params;
};

export const PRESETS: Preset[] = [
  {
    name: "Calm Drift",
    params: {
      gravity: { x: 0, y: 0.08 },
      airFriction: 0.02,
      restitution: 0.85,
      ballRadius: 14,
      ballCount: 20,
    },
  },
  {
    name: "Chaotic Pinball",
    params: {
      gravity: { x: 0.0, y: 0.35 },
      airFriction: 0.004,
      restitution: 0.98,
      ballRadius: 12,
      ballCount: 28,
    },
  },
  {
    name: "Zero-G",
    params: {
      gravity: { x: 0, y: 0 },
      airFriction: 0.006,
      restitution: 0.92,
      ballRadius: 14,
      ballCount: 20,
    },
  },
];
