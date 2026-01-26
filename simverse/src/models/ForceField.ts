import type { Vec2 } from "./Params";

export type RegionCircle = {
  center: Vec2;
  radius: number;
};

export type ForceFieldType = "wind" | "attractor" | "vortex";

export type ForceField = {
  id: string;
  type: ForceFieldType;

  // normalized 0..1 (we scale internally)
  strength: number;

  // wind
  direction?: Vec2;

  // attractor/vortex
  center?: Vec2;

  // region constraint (circle for Phase 1/2)
  region?: RegionCircle;

  // linkage so Delete works cleanly
  annotationId?: string;        // e.g. arrow annotation that created this force
  regionAnnotationId?: string;  // e.g. region annotation that constrains this force
};
