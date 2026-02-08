import type { Vec2 } from "../models/Params";

export type ParamKey = "gravityY" | "airFriction" | "restitution";

export type Action =
  | { type: "set_param"; key: ParamKey; value: number }
  | { type: "spawn_balls"; count: number }
  | { type: "clear_forces" }
  | { type: "clear_annotations" }
  | { type: "add_wind"; direction: Vec2; strength: number; regionAnnotationId?: string }
  | { type: "add_attractor"; center: Vec2; strength: number; regionAnnotationId?: string }
  | { type: "add_vortex"; center: Vec2; strength: number; clockwise: boolean; regionAnnotationId?: string };

export type GeminiLikeResponse = {
  prediction: string;
  explanation: string;
  actions: Action[];
};
