export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, logicalWidth: number, logicalHeight: number) {
  const dpr = window.devicePixelRatio || 1;

  // Set CSS size (logical)
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  // Set actual pixel size
  canvas.width = Math.floor(logicalWidth * dpr);
  canvas.height = Math.floor(logicalHeight * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");

  // Map logical coords -> pixel coords
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { ctx, dpr };
}
