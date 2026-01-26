import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { DEFAULT_PARAMS, type Params } from "./models/Params";
import { drawWorld } from "./render/drawWorld";
import { drawOverlay } from "./render/drawOverlay";
import { resizeCanvasToDisplaySize } from "./render/resizeCanvas";
import { SimController } from "./controls/SimController";
import { PRESETS } from "./controls/presets";

const LOGICAL_W = 900;
const LOGICAL_H = 600;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);

  const controllerRef = useRef<SimController | null>(null);

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [windStrength, setWindStrength] = useState(0.5);
  const [attractStrength, setAttractStrength] = useState(0.6);

  const paramsMemo = useMemo(() => params, [params]);

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
      drawOverlay(ctx, c.getAnnotations());

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
    // controller will be recreated by effect (stable and simple for now)
  }

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, alignItems: "flex-start" }}>
      <div>
        <canvas ref={canvasRef} />
      </div>

      <div style={{ width: 340 }}>
        <h2 style={{ marginTop: 0 }}>SimVerse (Phase 1)</h2>

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            style={{ padding: 10, cursor: "pointer" }}
            onClick={() => controllerRef.current?.spawnBalls(10)}
          >
            Spawn 10
          </button>

          <button
            style={{ padding: 10, cursor: "pointer" }}
            onClick={() => {
              controllerRef.current?.reset();
              // force re-render of controls to match controller’s params
              setParams(controllerRef.current?.getParams() ?? params);
            }}
          >
            Reset
          </button>
        </div>

        <hr style={{ margin: "16px 0", opacity: 0.25 }} />

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            Wind strength: {windStrength.toFixed(2)}
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
          <button
            style={{ width: "100%", padding: 10, cursor: "pointer", marginTop: 8 }}
            onClick={() => {
              const c = controllerRef.current;
              if (!c) return;
              // debug: annotate + apply wind to whole world
              c.addArrowAnnotation({ x: 120, y: 80 }, { x: 260, y: 80 });
              c.addWind({ x: 1, y: 0 }, windStrength);
            }}
          >
            Add wind → (global)
          </button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
            Attractor strength: {attractStrength.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={attractStrength}
            onChange={(e) => setAttractStrength(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <button
            style={{ width: "100%", padding: 10, cursor: "pointer", marginTop: 8 }}
            onClick={() => {
              const c = controllerRef.current;
              if (!c) return;
              const center = { x: LOGICAL_W / 2, y: LOGICAL_H / 2 };
              c.addRegionAnnotation(center, 160);
              c.addAttractor(center, attractStrength);
            }}
          >
            Add attractor (center)
          </button>
        </div>

        <button
          style={{ width: "100%", padding: 10, cursor: "pointer" }}
          onClick={() => {
            controllerRef.current?.clearForces();
          }}
        >
          Clear forces
        </button>

        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35, marginTop: 12 }}>
          Next milestone: mouse sketch capture → convert to annotations → Gemini outputs JSON actions that call controller methods.
        </p>
      </div>
    </div>
  );
}
