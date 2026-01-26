import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { DEFAULT_PARAMS, type Params, type Vec2 } from "./models/Params";
import { drawWorld } from "./render/drawWorld";
import { drawOverlay } from "./render/drawOverlay";
import { resizeCanvasToDisplaySize } from "./render/resizeCanvas";
import { SimController } from "./controls/SimController";
import { PRESETS } from "./controls/presets";
import type { Annotation } from "./models/Annotation";

const LOGICAL_W = 900;
const LOGICAL_H = 600;

type Mode = "play" | "region" | "arrow" | "delete";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function pointInRegion(p: Vec2, center: Vec2, radius: number) {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return dx * dx + dy * dy <= radius * radius;
}
function length(v: Vec2) {
  return Math.hypot(v.x, v.y);
}
function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function nearestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  if (ab2 < 1e-9) return a;
  let t = (ap.x * ab.x + ap.y * ab.y) / ab2;
  t = clamp(t, 0, 1);
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);

  const controllerRef = useRef<SimController | null>(null);

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const paramsMemo = useMemo(() => params, [params]);

  const [mode, setMode] = useState<Mode>("play");

  // drawing state via refs (smooth)
  const isDrawingRef = useRef(false);
  const startRef = useRef<Vec2 | null>(null);
  const previewRef = useRef<Annotation | null>(null);
  const [previewTick, setPreviewTick] = useState(0); // tiny re-render trigger for UI if needed

  // Force sliders (still useful)
  const [windStrength, setWindStrength] = useState(0.55);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { ctx, dpr } = resizeCanvasToDisplaySize(canvas, LOGICAL_W, LOGICAL_H);

    controllerRef.current = new SimController(LOGICAL_W, LOGICAL_H, paramsMemo);

    lastTRef.current = performance.now();
    const loop = (t: number) => {
      const c = controllerRef.current;
      if (!c) return;

      const dt = t - lastTRef.current;
      lastTRef.current = t;

      c.step(dt);

      const worldState = c.getWorldState();
      drawWorld({ ctx, dpr }, worldState);
      drawOverlay(ctx, c.getAnnotations(), previewRef.current);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      controllerRef.current = null;
    };
  }, [paramsMemo]);

  function applyParams(next: Params) {
    setParams(next);
    // controller recreates via effect, kept simple for now
  }

  function canvasPosFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Vec2 {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = controllerRef.current;
    if (!c) return;

    const p = canvasPosFromEvent(e);

    if (mode === "delete") {
      // find nearest annotation
      const anns = c.getAnnotations();
      let bestId: string | null = null;
      let bestD = Infinity;

      for (const a of anns) {
        let d = Infinity;
        if (a.type === "region") d = Math.abs(dist(p, a.center) - a.radius);
        if (a.type === "spiral") d = Math.abs(dist(p, a.center) - a.radius);
        if (a.type === "arrow") {
          const q = nearestPointOnSegment(p, a.start, a.end);
          d = dist(p, q);
        }
        if (d < bestD) {
          bestD = d;
          bestId = a.id;
        }
      }

      if (bestId && bestD < 20) {
        c.removeAnnotation(bestId);
      }
      return;
    }

    if (mode === "play") return;

    // start drawing region/arrow
    isDrawingRef.current = true;
    startRef.current = p;
    previewRef.current = null;

    // capture pointer so move/up always fire
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const start = startRef.current;
    if (!start) return;

    const p = canvasPosFromEvent(e);

    if (mode === "region") {
      const r = clamp(dist(start, p), 10, 450);
      previewRef.current = {
        id: "preview",
        type: "region",
        center: start,
        radius: r,
      };
      setPreviewTick(t => t + 1);
    }

    if (mode === "arrow") {
      previewRef.current = {
        id: "preview",
        type: "arrow",
        start,
        end: p,
      };
      setPreviewTick(t => t + 1);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = controllerRef.current;
    if (!c) return;

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const start = startRef.current;
    startRef.current = null;

    const p = canvasPosFromEvent(e);
    const prev = previewRef.current;
    previewRef.current = null;
    setPreviewTick(t => t + 1);

    if (!start) return;

    if (mode === "region") {
      const r = clamp(dist(start, p), 20, 450);
      c.addRegionAnnotation(start, r);
      return;
    }

    if (mode === "arrow") {
      const v = sub(p, start);
      const L = length(v);
      if (L < 12) return;

      // create arrow annotation
      const arrowId = c.addArrowAnnotation(start, p);

      // map arrow length -> strength (tune later)
      const strength = clamp(L / 280, 0, 1);

      // region check: if midpoint inside any region, constrain wind
      const mid: Vec2 = { x: (start.x + p.x) / 2, y: (start.y + p.y) / 2 };
      const regions = c.getAnnotations().filter(a => a.type === "region") as Extract<Annotation, { type: "region" }>[];

      let chosen: Extract<Annotation, { type: "region" }> | null = null;
      for (const r of regions) {
        if (pointInRegion(mid, r.center, r.radius)) {
          if (!chosen || r.radius < chosen.radius) chosen = r; // prefer smallest containing region
        }
      }

      if (chosen) {
        c.addWind(v, strength, { center: chosen.center, radius: chosen.radius }, arrowId, chosen.id);
      } else {
        c.addWind(v, strength, undefined, arrowId);
      }

      return;
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, alignItems: "flex-start" }}>
      <div>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            touchAction: "none",
            cursor:
              mode === "play" ? "default" :
              mode === "delete" ? "crosshair" :
              "crosshair",
          }}
        />
      </div>

      <div style={{ width: 360 }}>
        <h2 style={{ marginTop: 0 }}>SimVerse (Phase 1 → Sketch)</h2>

        <div style={{ marginBottom: 12, padding: 10, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Interaction mode</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setMode("play")} style={{ padding: 10, cursor: "pointer", opacity: mode === "play" ? 1 : 0.7 }}>
              Play
            </button>
            <button onClick={() => setMode("region")} style={{ padding: 10, cursor: "pointer", opacity: mode === "region" ? 1 : 0.7 }}>
              Draw Region
            </button>
            <button onClick={() => setMode("arrow")} style={{ padding: 10, cursor: "pointer", opacity: mode === "arrow" ? 1 : 0.7 }}>
              Draw Arrow
            </button>
            <button onClick={() => setMode("delete")} style={{ padding: 10, cursor: "pointer", opacity: mode === "delete" ? 1 : 0.7 }}>
              Delete (X)
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            Region: drag to make a circle. Arrow: drag to apply wind. Arrow inside region → wind only in that region.
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Preset</label>
          <select
            style={{ width: "100%", padding: 8 }}
            onChange={(e) => {
              const p = PRESETS.find(x => x.name === e.target.value);
              if (p) applyParams(p.params);
            }}
            defaultValue=""
          >
            <option value="" disabled>Choose…</option>
            {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            Gravity Y: {params.gravity.y.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.01}
            value={params.gravity.y}
            onChange={(e) => applyParams({ ...params, gravity: { ...params.gravity, y: Number(e.target.value) } })}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            Air friction: {params.airFriction.toFixed(3)}
          </label>
          <input
            type="range"
            min={0}
            max={0.06}
            step={0.001}
            value={params.airFriction}
            onChange={(e) => applyParams({ ...params, airFriction: Number(e.target.value) })}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            Restitution: {params.restitution.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={params.restitution}
            onChange={(e) => applyParams({ ...params, restitution: Number(e.target.value) })}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <button style={{ padding: 10, cursor: "pointer" }} onClick={() => controllerRef.current?.spawnBalls(10)}>
            Spawn 10
          </button>
          <button
            style={{ padding: 10, cursor: "pointer" }}
            onClick={() => {
              controllerRef.current?.reset();
              setParams(controllerRef.current?.getParams() ?? params);
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            Wind strength (for sketch): {windStrength.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={windStrength}
            onChange={(e) => setWindStrength(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            (Currently arrow strength is auto from arrow length; we’ll fuse these in Phase 2.)
          </div>
        </div>

        <button style={{ width: "100%", padding: 10, cursor: "pointer" }} onClick={() => controllerRef.current?.clearForces()}>
          Clear forces
        </button>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Preview tick: {previewTick} {/* harmless; confirms preview updates */}
        </div>
      </div>
    </div>
  );
}
