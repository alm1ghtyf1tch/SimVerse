import type { Vec2 } from "./Params";

export type RegionCircle = {
  center: Vec2;
  radius: number;
};

export type ForceFieldType = "wind" | "attractor" | "vortex";

export type ForceField = {
  id: string;
  type: ForceFieldType;
  strength: number;     // 0..1 (we scale internally to Matter force units)
  direction?: Vec2;     // wind
  center?: Vec2;        // attractor/vortex center
  region?: RegionCircle; // optional region constraint
};
