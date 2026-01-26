import Matter from "matter-js";
import type { Params, Vec2 } from "../models/Params";
import type { ForceField, RegionCircle } from "../models/ForceField";
import type { Annotation } from "../models/Annotation";
import { uid } from "../utils/id";
import { createWorld, type WorldState } from "../engine/createWorld";
import { stepWorld } from "../engine/stepWorld";

const FORCE_SCALE_WIND = 0.00035;
const FORCE_SCALE_ATTRACT = 0.00045;
const FORCE_SCALE_VORTEX = 0.00035;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function len(v: Vec2) {
  return Math.hypot(v.x, v.y);
}
function norm(v: Vec2): Vec2 {
  const l = len(v);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}
function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function mul(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}
function insideRegion(p: Vec2, region?: RegionCircle) {
  if (!region) return true;
  const dx = p.x - region.center.x;
  const dy = p.y - region.center.y;
  return dx * dx + dy * dy <= region.radius * region.radius;
}

export class SimController {
  private width: number;
  private height: number;

  private params: Params;
  private worldState: WorldState;

  private forceFields: ForceField[] = [];
  private annotations: Annotation[] = [];

  constructor(width: number, height: number, params: Params) {
    this.width = width;
    this.height = height;
    this.params = structuredClone(params);
    this.worldState = createWorld(width, height, this.params);
  }

  getParams() {
    return structuredClone(this.params);
  }

  getForceFields() {
    return structuredClone(this.forceFields);
  }

  getAnnotations() {
    return structuredClone(this.annotations);
  }

  reset(paramsOverride?: Partial<Params>) {
    const next: Params = { ...this.params, ...(paramsOverride ?? {}) };
    if (paramsOverride?.gravity) next.gravity = { ...paramsOverride.gravity };

    this.params = structuredClone(next);

    // Reset in Phase 1: clear everything for deterministic behavior
    this.forceFields = [];
    this.annotations = [];

    this.worldState = createWorld(this.width, this.height, this.params);
  }

  setGravity(g: Vec2) {
    this.params.gravity = { x: g.x, y: g.y };
    this.worldState.engine.gravity.x = g.x;
    this.worldState.engine.gravity.y = g.y;
  }

  setAirFriction(value: number) {
    const v = clamp(value, 0, 0.08);
    this.params.airFriction = v;
    for (const b of this.worldState.balls) b.frictionAir = v;
  }

  setRestitution(value: number) {
    const v = clamp(value, 0, 1);
    this.params.restitution = v;
    for (const b of this.worldState.balls) b.restitution = v;
  }

  spawnBalls(count: number) {
    const maxAdd = 200;
    const n = clamp(Math.floor(count), 1, maxAdd);

    const r = this.params.ballRadius;
    const options = {
      restitution: this.params.restitution,
      friction: 0,
      frictionStatic: 0,
      frictionAir: this.params.airFriction,
    };

    const balls: Matter.Body[] = [];
    for (let i = 0; i < n; i++) {
      const x = this.width * (0.2 + Math.random() * 0.6);
      const y = this.height * (0.15 + Math.random() * 0.35);
      const ball = Matter.Bodies.circle(x, y, r, options);
      Matter.Body.setVelocity(ball, {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4,
      });
      balls.push(ball);
    }

    Matter.World.add(this.worldState.world, balls);
    this.worldState.balls.push(...balls);
  }

  // IMPORTANT: clear forces only (do NOT nuke annotations)
  clearForces() {
    this.forceFields = [];
  }

  removeAnnotation(annotationId: string) {
    // remove the annotation
    this.annotations = this.annotations.filter(a => a.id !== annotationId);

    // remove any forces created by that annotation OR constrained by that region annotation
    this.forceFields = this.forceFields.filter(ff =>
      ff.annotationId !== annotationId && ff.regionAnnotationId !== annotationId
    );
  }

  // --- Force Field creators (linkable) ---
  addWind(
    direction: Vec2,
    strength01: number,
    region?: RegionCircle,
    annotationId?: string,
    regionAnnotationId?: string
  ) {
    const dir = norm(direction);
    const field: ForceField = {
      id: uid("ff"),
      type: "wind",
      strength: clamp(strength01, 0, 1),
      direction: dir,
      region,
      annotationId,
      regionAnnotationId,
    };
    this.forceFields.push(field);
    return field.id;
  }

  addAttractor(center: Vec2, strength01: number, region?: RegionCircle, annotationId?: string, regionAnnotationId?: string) {
    const field: ForceField = {
      id: uid("ff"),
      type: "attractor",
      strength: clamp(strength01, 0, 1),
      center,
      region,
      annotationId,
      regionAnnotationId,
    };
    this.forceFields.push(field);
    return field.id;
  }

  addVortex(center: Vec2, strength01: number, clockwise: boolean, region?: RegionCircle, annotationId?: string, regionAnnotationId?: string) {
    const field: ForceField = {
      id: uid("ff"),
      type: "vortex",
      strength: clamp(strength01, 0, 1) * (clockwise ? 1 : -1),
      center,
      region,
      annotationId,
      regionAnnotationId,
    };
    this.forceFields.push(field);
    return field.id;
  }

  // --- Annotation helpers (mouse drawing will call these) ---
  addRegionAnnotation(center: Vec2, radius: number) {
    const ann: Annotation = { id: uid("ann"), type: "region", center, radius: clamp(radius, 20, 450) };
    this.annotations.push(ann);
    return ann.id;
  }

  addArrowAnnotation(start: Vec2, end: Vec2) {
    const ann: Annotation = { id: uid("ann"), type: "arrow", start, end };
    this.annotations.push(ann);
    return ann.id;
  }

  addSpiralAnnotation(center: Vec2, radius: number, clockwise: boolean) {
    const ann: Annotation = { id: uid("ann"), type: "spiral", center, radius: clamp(radius, 20, 450), clockwise };
    this.annotations.push(ann);
    return ann.id;
  }

  step(dtMs: number) {
    this.applyForceFields();
    stepWorld(this.worldState, dtMs);
  }

  getWorldState() {
    return this.worldState;
  }

  private applyForceFields() {
    if (this.forceFields.length === 0) return;

    for (const b of this.worldState.balls) {
      const p = { x: b.position.x, y: b.position.y };

      for (const f of this.forceFields) {
        if (!insideRegion(p, f.region)) continue;

        if (f.type === "wind" && f.direction) {
          const force = mul(f.direction, f.strength * FORCE_SCALE_WIND);
          Matter.Body.applyForce(b, b.position, force);
        }

        if (f.type === "attractor" && f.center) {
          const toC = sub(f.center, p);
          const dist = clamp(len(toC), 30, 800);
          const dir = norm(toC);
          const mag = (f.strength * FORCE_SCALE_ATTRACT) * (200 / dist);
          Matter.Body.applyForce(b, b.position, mul(dir, mag));
        }

        if (f.type === "vortex" && f.center) {
          const toC = sub(p, f.center);
          const dist = clamp(len(toC), 40, 900);
          const tangential = norm({ x: -toC.y, y: toC.x });
          const mag = (Math.abs(f.strength) * FORCE_SCALE_VORTEX) * (250 / dist);
          const signed = f.strength >= 0 ? 1 : -1;
          Matter.Body.applyForce(b, b.position, mul(tangential, mag * signed));
        }
      }
    }
  }
}
