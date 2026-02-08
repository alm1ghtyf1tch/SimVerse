import type { Action, GeminiLikeResponse, ParamKey } from "./types";

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isStr(s: unknown): s is string {
  return typeof s === "string";
}

function hasKeys(o: Record<string, unknown>, keys: string[]) {
  return keys.every(k => k in o);
}

function isParamKey(k: unknown): k is ParamKey {
  return k === "gravityY" || k === "airFriction" || k === "restitution";
}

function isVec2(v: unknown): v is { x: number; y: number } {
  return isObj(v) && isNum(v.x) && isNum(v.y);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function validateResponse(raw: unknown): { ok: true; value: GeminiLikeResponse } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: "Response is not an object." };
  if (!isStr(raw.prediction) || !isStr(raw.explanation) || !Array.isArray(raw.actions)) {
    return { ok: false, error: "Response must have prediction, explanation, actions." };
  }

  const actions: Action[] = [];
  for (const a of raw.actions) {
    if (!isObj(a) || !isStr(a.type)) return { ok: false, error: "Invalid action format." };

    switch (a.type) {
      case "set_param": {
        if (!hasKeys(a, ["key", "value"])) return { ok: false, error: "set_param missing key/value." };
        if (!isParamKey(a.key) || !isNum(a.value)) return { ok: false, error: "set_param invalid key/value." };
        // soft safety clamps
        const v =
          a.key === "gravityY" ? clamp(a.value, 0, 0.8) :
          a.key === "airFriction" ? clamp(a.value, 0, 0.08) :
          clamp(a.value, 0, 1);
        actions.push({ type: "set_param", key: a.key, value: v });
        break;
      }

      case "spawn_balls": {
        if (!hasKeys(a, ["count"]) || !isNum(a.count)) return { ok: false, error: "spawn_balls invalid count." };
        actions.push({ type: "spawn_balls", count: Math.floor(clamp(a.count, 1, 200)) });
        break;
      }

      case "clear_forces": {
        actions.push({ type: "clear_forces" });
        break;
      }

      case "clear_annotations": {
        actions.push({ type: "clear_annotations" });
        break;
      }

      case "add_wind": {
        if (!hasKeys(a, ["direction", "strength"])) return { ok: false, error: "add_wind missing fields." };
        if (!isVec2(a.direction) || !isNum(a.strength)) return { ok: false, error: "add_wind invalid direction/strength." };
        actions.push({
          type: "add_wind",
          direction: a.direction,
          strength: clamp(a.strength, 0, 1),
          regionAnnotationId: isStr(a.regionAnnotationId) ? a.regionAnnotationId : undefined
        });
        break;
      }

      case "add_attractor": {
        if (!hasKeys(a, ["center", "strength"])) return { ok: false, error: "add_attractor missing fields." };
        if (!isVec2(a.center) || !isNum(a.strength)) return { ok: false, error: "add_attractor invalid center/strength." };
        actions.push({
          type: "add_attractor",
          center: a.center,
          strength: clamp(a.strength, 0, 1),
          regionAnnotationId: isStr(a.regionAnnotationId) ? a.regionAnnotationId : undefined
        });
        break;
      }

      case "add_vortex": {
        if (!hasKeys(a, ["center", "strength", "clockwise"])) return { ok: false, error: "add_vortex missing fields." };
        if (!isVec2(a.center) || !isNum(a.strength) || typeof a.clockwise !== "boolean") {
          return { ok: false, error: "add_vortex invalid fields." };
        }
        actions.push({
          type: "add_vortex",
          center: a.center,
          strength: clamp(a.strength, 0, 1),
          clockwise: a.clockwise,
          regionAnnotationId: isStr(a.regionAnnotationId) ? a.regionAnnotationId : undefined
        });
        break;
      }

      default:
        return { ok: false, error: `Unknown action type: ${String(a.type)}` };
    }
  }

  return {
    ok: true,
    value: {
      prediction: raw.prediction,
      explanation: raw.explanation,
      actions
    }
  };
}
