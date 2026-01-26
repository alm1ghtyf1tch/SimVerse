import Matter from "matter-js";
import type { WorldState } from "./createWorld";

// Fixed-ish timestep with clamp to avoid "exploding physics" when tab lags
const MAX_DT_MS = 33; // cap at ~30fps equivalent

export function stepWorld(state: WorldState, dtMs: number) {
  const clamped = Math.min(dtMs, MAX_DT_MS);
  Matter.Engine.update(state.engine, clamped);
}
