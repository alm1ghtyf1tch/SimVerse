import type { GeminiLikeResponse } from "./types";
import type { Params } from "../models/Params";
import type { Annotation } from "../models/Annotation";

function findLargestRegion(annotations: Annotation[]) {
  const regions = annotations.filter(a => a.type === "region") as Extract<Annotation, { type: "region" }>[];
  if (regions.length === 0) return null;
  return regions.reduce((best, r) => (r.radius > best.radius ? r : best), regions[0]);
}

function findAnyRegion(annotations: Annotation[]) {
  const regions = annotations.filter(a => a.type === "region") as Extract<Annotation, { type: "region" }>[];
  return regions[0] ?? null;
}

export async function mockGeminiRespond(input: {
  command: string;
  params: Params;
  annotations: Annotation[];
  canvas: { width: number; height: number };
}): Promise<GeminiLikeResponse> {
  const text = input.command.toLowerCase();
  const { width, height } = input.canvas;

  const region = findAnyRegion(input.annotations);
  const biggest = findLargestRegion(input.annotations);

  const actions: GeminiLikeResponse["actions"] = [];
  let prediction = "No major change.";
  let explanation = "Mock Gemini did not detect a strong intent.";

  // quick intent heuristics
  const wantsChaos = /chaos|chaotic|wild|faster|more energy|aggressive/.test(text);
  const wantsStable = /stable|stabilize|calm|settle|less jitter|damp/.test(text);
  const wantsSwirl = /swirl|vortex|spin|rotate/.test(text);
  const wantsPull = /pull|attract|gather|cluster/.test(text);
  const wantsWind = /wind|drift|push|blow|move right|move left/.test(text);
  const wantsZeroG = /zero[- ]?g|no gravity|weightless/.test(text);
  const wantsSpawn = /spawn|add.*balls|more balls|more particles/.test(text);

  if (wantsZeroG) {
    actions.push({ type: "set_param", key: "gravityY", value: 0 });
    prediction = "Objects will stop falling and continue mainly from existing velocities.";
    explanation = "Interpreted as a request for weightlessness (gravityY → 0).";
  }

  if (wantsStable) {
    actions.push({ type: "set_param", key: "airFriction", value: Math.max(input.params.airFriction, 0.02) });
    actions.push({ type: "set_param", key: "restitution", value: Math.min(input.params.restitution, 0.9) });
    prediction = "Motion will damp out faster and bounces will lose energy more quickly.";
    explanation = "Interpreted as stabilization: increased air friction and slightly reduced restitution.";
  }

  if (wantsChaos && !wantsStable) {
    actions.push({ type: "set_param", key: "airFriction", value: Math.max(0.002, input.params.airFriction * 0.6) });
    actions.push({ type: "set_param", key: "restitution", value: 0.98 });
    prediction = "Objects will retain energy longer and collisions will feel more lively.";
    explanation = "Interpreted as increasing chaos: lower damping and higher bounciness.";
  }

  if (wantsSpawn) {
    actions.push({ type: "spawn_balls", count: 12 });
    prediction = "More bodies will be added, increasing interactions and complexity.";
    explanation = "Detected request to add more balls.";
  }

  if (wantsSwirl) {
    const center = biggest?.center ?? { x: width / 2, y: height / 2 };
    actions.push({
      type: "add_vortex",
      center,
      strength: 0.65,
      clockwise: !/counter|ccw|anticlockwise/.test(text),
      regionAnnotationId: biggest?.id
    });
    prediction = "A swirling field will induce rotation; nearby objects will orbit and spiral.";
    explanation = biggest
      ? "Applied a vortex constrained to your largest region sketch."
      : "Applied a vortex centered in the scene (no region found).";
  }

  if (wantsPull) {
    const center = region?.center ?? { x: width / 2, y: height / 2 };
    actions.push({
      type: "add_attractor",
      center,
      strength: 0.6,
      regionAnnotationId: region?.id
    });
    prediction = "Objects will drift toward the attractor center and cluster over time.";
    explanation = region
      ? "Applied an attractor constrained to the region you drew."
      : "Applied an attractor at the scene center (no region found).";
  }

  if (wantsWind) {
    // basic direction guessing
    const direction =
      /left/.test(text) ? { x: -1, y: 0 } :
      /up/.test(text) ? { x: 0, y: -1 } :
      /down/.test(text) ? { x: 0, y: 1 } :
      { x: 1, y: 0 };

    actions.push({
      type: "add_wind",
      direction,
      strength: 0.55,
      regionAnnotationId: region?.id
    });

    prediction = "A steady drift will push objects in the wind direction; collisions will concentrate near a wall.";
    explanation = region
      ? "Applied wind constrained to your region sketch."
      : "Applied global wind (no region found).";
  }

  if (actions.length === 0) {
    // helpful default suggestion
    const fallbackCenter = { x: width / 2, y: height / 2 };
    actions.push({ type: "add_attractor", center: fallbackCenter, strength: 0.4 });
    prediction = "A gentle attractor will create more structured motion.";
    explanation = "No strong intent detected, so I proposed a gentle attractor to make motion interesting.";
  }

  return { prediction, explanation, actions };
}
