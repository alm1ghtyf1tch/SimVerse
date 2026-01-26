import type { Vec2 } from "./Params";

export type AnnotationType = "arrow" | "region" | "spiral";

export type ArrowAnnotation = {
  id: string;
  type: "arrow";
  start: Vec2;
  end: Vec2;
};

export type RegionAnnotation = {
  id: string;
  type: "region";
  center: Vec2;
  radius: number;
};

export type SpiralAnnotation = {
  id: string;
  type: "spiral";
  center: Vec2;
  radius: number;
  clockwise: boolean;
};

export type Annotation = ArrowAnnotation | RegionAnnotation | SpiralAnnotation;
