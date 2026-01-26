export function uid(prefix = "id"): string {
  // modern browsers
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  // fallback
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
