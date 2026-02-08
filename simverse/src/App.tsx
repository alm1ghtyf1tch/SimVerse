import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { DEFAULT_PARAMS, type Params, type Vec2 } from "./models/Params";
import { drawWorld } from "./render/drawWorld";
import { drawOverlay } from "./render/drawOverlay";
import { resizeCanvasToDisplaySize } from "./render/resizeCanvas";
import { SimController } from "./controls/SimController";
import { PRESETS } from "./controls/presets";
import type { Annotation } from "./models/Annotation";
import { mockGeminiRespond } from "./ai/mockGemini";
import { validateResponse } from "./ai/validate";
import { executeActions } from "./ai/execute";
import type { GeminiLikeResponse } from "./ai/types";
import { getAIResponse } from "./ai/adapter";
import FloatingLines from "./FloatingLines";



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

  const [command, setCommand] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "thinking" | "error" | "ok">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastAI, setLastAI] = useState<GeminiLikeResponse | null>(null);
  const [executedActions, setExecutedActions] = useState<any[]>([]);
  const [aiMode, setAiMode] = useState<"direct" | "mock">(() => {
    const saved = localStorage.getItem("simverse-ai-mode") as "direct" | "mock" | null;
    return saved || "direct";
  });


  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const paramsMemo = useMemo(() => params, [params]);

  const [mode, setMode] = useState<Mode>("play");

  // drawing state via refs (smooth)
  const isDrawingRef = useRef(false);
  const startRef = useRef<Vec2 | null>(null);
  const previewRef = useRef<Annotation | null>(null);

  // Force sliders (still useful)
const [windStrength, setWindStrength] = useState(0.55);

async function runAIPipeline() {
  const c = controllerRef.current;
  if (!c) return;

  setAiStatus("thinking");
  setAiError(null);

  try {
    const raw = aiMode === "direct"
      ? await getAIResponse({
          command,
          params: c.getParams(),
          annotations: c.getAnnotations(),
          canvas: { width: LOGICAL_W, height: LOGICAL_H },
        })
      : await mockGeminiRespond({
          command,
          params: c.getParams(),
          annotations: c.getAnnotations(),
          canvas: { width: LOGICAL_W, height: LOGICAL_H },
        });

    const validated = validateResponse(raw);
    if (!validated.ok) {
      setAiStatus("error");
      setAiError(validated.error);
      return;
    }

    const executed = executeActions(c, validated.value.actions);

    setLastAI(validated.value);
    setExecutedActions(executed);
    setAiStatus("ok");
  } catch (e: any) {
    setAiStatus("error");
    setAiError(e?.message ?? "Unknown error");
  }
}

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
    }

    if (mode === "arrow") {
      previewRef.current = {
        id: "preview",
        type: "arrow",
        start,
        end: p,
      };
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
    previewRef.current = null;

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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", margin: 0, padding: 0, backgroundColor: "#0a0a0a" }}>
      {/* Top Bar */}
      <div style={{ 
        padding: "16px 24px", 
        borderBottom: "1px solid rgba(255,255,255,0.1)", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.3)"
      }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: "#fff" }}>SimVerse</h1>
        <div style={{ fontSize: 12, opacity: 0.6 }}> </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", flex: 1, gap: 0, overflow: "hidden" }}>
        {/* Canvas Area with Floating Lines Background */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#000", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
            <FloatingLines 
              enabledWaves={useMemo(() => ["top","middle","bottom"], [])}
              lineCount={5}
              lineDistance={5}
              bendRadius={5}
              bendStrength={-0.5}
              interactive={true}
              parallax={true}
            />
          </div>
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
              maxWidth: "100%",
              maxHeight: "100%",
              position: "relative",
              zIndex: 10
            }}
          />
        </div>

        {/* Right Sidebar */}
        <div style={{ width: 380, backgroundColor: "rgba(20,20,20,0.8)", borderLeft: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Interaction Mode Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Interaction Mode</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setMode("play")} style={{ padding: 10, cursor: "pointer", opacity: mode === "play" ? 1 : 0.5, backgroundColor: mode === "play" ? "rgba(100,200,255,0.2)" : "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 12, transition: "all 0.2s" }}>
                Play
              </button>
              <button onClick={() => setMode("region")} style={{ padding: 10, cursor: "pointer", opacity: mode === "region" ? 1 : 0.5, backgroundColor: mode === "region" ? "rgba(100,200,255,0.2)" : "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 12, transition: "all 0.2s" }}>
                Draw Region
              </button>
              <button onClick={() => setMode("arrow")} style={{ padding: 10, cursor: "pointer", opacity: mode === "arrow" ? 1 : 0.5, backgroundColor: mode === "arrow" ? "rgba(100,200,255,0.2)" : "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 12, transition: "all 0.2s" }}>
                Draw Arrow
              </button>
              <button onClick={() => setMode("delete")} style={{ padding: 10, cursor: "pointer", opacity: mode === "delete" ? 1 : 0.5, backgroundColor: mode === "delete" ? "rgba(100,200,255,0.2)" : "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 12, transition: "all 0.2s" }}>
                Delete
              </button>
            </div>
          </div>

          {/* AI Command Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>AI Command</div>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder='e.g., "Create a swirling motion"'
              rows={3}
              style={{ width: "100%", padding: 8, resize: "vertical", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 12 }}
            />
            <button
              onClick={runAIPipeline}
              disabled={!command.trim() || aiStatus === "thinking"}
              style={{ width: "100%", padding: 10, cursor: "pointer", marginTop: 8, opacity: (!command.trim() || aiStatus === "thinking") ? 0.5 : 1, backgroundColor: "rgba(100,200,255,0.15)", border: "1px solid rgba(100,200,255,0.3)", borderRadius: 4, color: "#fff", fontWeight: 500 }}
            >
              {aiStatus === "thinking" ? "Thinking…" : "Run"}
            </button>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                onClick={() => setCommand("Create a swirling motion inside the region, then stabilize it by reducing the energy")}
                style={{ padding: 8, cursor: "pointer", backgroundColor: "rgba(100,150,255,0.1)", border: "1px solid rgba(100,150,255,0.2)", borderRadius: 4, color: "#fff", fontSize: 10, lineHeight: 1.2 }}
              >
                Swirl + Stabilize
              </button>
              <button
                onClick={() => setCommand("Apply a rightward wind force inside the region to make the balls drift to the right")}
                style={{ padding: 8, cursor: "pointer", backgroundColor: "rgba(100,150,255,0.1)", border: "1px solid rgba(100,150,255,0.2)", borderRadius: 4, color: "#fff", fontSize: 10, lineHeight: 1.2 }}
              >
                Drift Right
              </button>
              <button
                onClick={() => {
                  setCommand("Create chaotic motion with strong forces but contained within a circular region boundary");
                  controllerRef.current?.spawnBalls(10);
                }}
                style={{ padding: 8, cursor: "pointer", backgroundColor: "rgba(100,150,255,0.1)", border: "1px solid rgba(100,150,255,0.2)", borderRadius: 4, color: "#fff", fontSize: 10, lineHeight: 1.2 }}
              >
                Chaos + Spawn
              </button>
              <button
                onClick={() => {
                  applyParams({ ...params, airFriction: 0.05, restitution: 0.1 });
                  controllerRef.current?.clearForces();
                  setCommand("Reset to calm state");
                }}
                style={{ padding: 8, cursor: "pointer", backgroundColor: "rgba(100,150,255,0.1)", border: "1px solid rgba(100,150,255,0.2)", borderRadius: 4, color: "#fff", fontSize: 10, lineHeight: 1.2 }}
              >
                Calm Reset
              </button>
            </div>
            {aiStatus === "error" && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#ffb3b3" }}>
                {aiError}
              </div>
            )}
            {aiStatus === "ok" && lastAI && (
              <div style={{ marginTop: 10, fontSize: 11, opacity: 0.85, lineHeight: 1.4 }}>
                <div><b>Prediction:</b> {lastAI.prediction}</div>
                <div style={{ marginTop: 6 }}><b>Why:</b> {lastAI.explanation}</div>
                <div style={{ marginTop: 6 }}><b>Executed:</b> {executedActions.length} action(s)</div>
              </div>
            )}
          </div>

          {/* Physics Settings Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Physics</div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
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

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
                Air Friction: {params.airFriction.toFixed(3)}
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

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
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

            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
                Wind Strength: {windStrength.toFixed(2)}
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
            </div>
          </div>

          {/* Presets Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Preset</div>
            <select
              style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 12 }}
              onChange={(e) => {
                const p = PRESETS.find(x => x.name === e.target.value);
                if (p) applyParams(p.params);
              }}
              defaultValue=""
            >
              <option value="" disabled>Choose a preset…</option>
              {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          {/* Controls Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Controls</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <button style={{ padding: 10, cursor: "pointer", backgroundColor: "rgba(100,200,255,0.1)", border: "1px solid rgba(100,200,255,0.2)", borderRadius: 4, color: "#fff", fontSize: 11 }} onClick={() => controllerRef.current?.spawnBalls(10)}>
                Spawn 10
              </button>
              <button style={{ padding: 10, cursor: "pointer", backgroundColor: "rgba(100,200,255,0.1)", border: "1px solid rgba(100,200,255,0.2)", borderRadius: 4, color: "#fff", fontSize: 11 }} onClick={() => { controllerRef.current?.reset(); setParams(controllerRef.current?.getParams() ?? params); }}>
                Reset
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button style={{ padding: 10, cursor: "pointer", backgroundColor: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 4, color: "#fff", fontSize: 11 }} onClick={() => controllerRef.current?.clearForces()}>
                Clear Forces
              </button>
              <button style={{ padding: 10, cursor: "pointer", backgroundColor: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 4, color: "#fff", fontSize: 11 }} onClick={() => { const c = controllerRef.current; if (!c) return; for (const a of c.getAnnotations()) c.removeAnnotation(a.id); setAiStatus("idle"); setLastAI(null); setExecutedActions([]); }}>
                Clear Anno.
              </button>
            </div>
          </div>

          {/* AI Status & Stats Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Status</div>
            <div style={{ marginBottom: 10, padding: 6, backgroundColor: "rgba(100,200,255,0.1)", border: "1px solid rgba(100,200,255,0.2)", borderRadius: 4, fontSize: 10, fontFamily: "monospace", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                AI: <span style={{ fontWeight: 600, color: "#64c8ff" }}>{aiMode.toUpperCase()}</span> | Latency: <span style={{ fontWeight: 600 }}>—ms</span>
              </div>
              <button
                onClick={() => {
                  const newMode = aiMode === "direct" ? "mock" : "direct";
                  setAiMode(newMode);
                  localStorage.setItem("simverse-ai-mode", newMode);
                }}
                style={{ padding: "2px 6px", fontSize: 8, backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 3, color: "#fff", cursor: "pointer", transition: "all 0.2s", fontWeight: 600 }}
                title="Toggle between Direct (Gemini API) and Mock (simulated) responses"
              >
                Switch
              </button>
            </div>
            <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 10, lineHeight: 1.4 }}>
              <div><b>Direct:</b> Uses real Gemini 3 API (requires API key)</div>
              <div><b>Mock:</b> Simulated responses (no API key needed, great for demos)</div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              Balls: <b>{controllerRef.current?.getWorldState().balls.length ?? 0}</b> | Sketches: <b>{controllerRef.current?.getAnnotations().length ?? 0}</b> | Forces: <b>{controllerRef.current?.getForceFields().length ?? 0}</b>
            </div>
          </div>

          {/* API Configuration Section */}
          <div style={{ padding: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.2)", marginTop: "auto" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>API Key</div>
            <input
              type="password"
              placeholder="Paste your Gemini 3 API key"
              defaultValue=""
              style={{ width: "100%", padding: 8, boxSizing: "border-box", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 11 }}
            />
            <div style={{ fontSize: 9, opacity: 0.6, marginTop: 6 }}>Get your API key from <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#64c8ff", textDecoration: "none" }}>Google AI Studio</a></div>
          </div>

        </div>
      </div>
    </div>
  );
}
