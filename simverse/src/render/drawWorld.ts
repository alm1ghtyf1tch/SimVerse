import type { WorldState } from "../engine/createWorld";

export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  dpr: number;
};

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}

export function drawWorld(render: RenderContext, state: WorldState) {
  const { ctx } = render;

  // Background
  ctx.save();
  ctx.fillStyle = "#0b0f1a"; // dark "space" background
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();

  // Walls
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  for (const w of state.walls) {
    const v = w.vertices;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  // Balls
  ctx.save();
  ctx.fillStyle = "rgba(120, 200, 255, 0.95)";
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;

  for (const b of state.balls) {
    const x = b.position.x;
    const y = b.position.y;

    // Matter stores circle radius as `circleRadius` (only for circle bodies)
    const r = (b as any).circleRadius ?? 10;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
