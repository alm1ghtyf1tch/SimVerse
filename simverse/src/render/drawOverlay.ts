import type { Annotation } from "../models/Annotation";

export function drawOverlay(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  ctx.save();
  ctx.lineWidth = 2;

  for (const a of annotations) {
    if (a.type === "region") {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(a.center.x, a.center.y, a.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (a.type === "arrow") {
      const { start, end } = a;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const ang = Math.atan2(dy, dx);
      const head = 12;

      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - head * Math.cos(ang - Math.PI / 6), end.y - head * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(end.x - head * Math.cos(ang + Math.PI / 6), end.y - head * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.stroke();
    }

    if (a.type === "spiral") {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      // Minimal spiral-ish drawing
      const turns = 2.5;
      const steps = 60;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * (Math.PI * 2 * turns);
        const r = (i / steps) * a.radius;
        const x = a.center.x + r * Math.cos(t);
        const y = a.center.y + r * Math.sin(t);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}
