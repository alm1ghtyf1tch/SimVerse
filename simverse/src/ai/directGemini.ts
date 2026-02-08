import type { GeminiLikeResponse } from "./types";

// Gemini 3 REST endpoint format is documented. :contentReference[oaicite:7]{index=7}
// API key header requirement is documented. :contentReference[oaicite:8]{index=8}
const DEFAULT_MODEL = "gemini-3-flash-preview";

function stripCodeFences(s: string) {
  return s.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
}

function extractJsonObject(text: string) {
  const t = stripCodeFences(text);
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model did not return a JSON object.");
  }
  const slice = t.slice(first, last + 1);
  return JSON.parse(slice);
}

export async function directGeminiRespond(input: {
  apiKey: string;              // DO NOT commit; use .env.local
  model?: string;              // default flash preview
  command: string;
  stateJson: string;           // annotations + params snapshot as JSON string
}) : Promise<GeminiLikeResponse> {
  const model = input.model ?? DEFAULT_MODEL;

  const prompt = [
    "You are SimVerse’s physics action planner.",
    "Return ONLY valid JSON matching this TypeScript type:",
    `{
  "prediction": string,
  "explanation": string,
  "actions": Array<
    | {"type":"set_param","key":"gravityY"|"airFriction"|"restitution","value":number}
    | {"type":"spawn_balls","count":number}
    | {"type":"clear_forces"}
    | {"type":"clear_annotations"}
    | {"type":"add_wind","direction":{"x":number,"y":number},"strength":number,"regionAnnotationId"?:string}
    | {"type":"add_attractor","center":{"x":number,"y":number},"strength":number,"regionAnnotationId"?:string}
    | {"type":"add_vortex","center":{"x":number,"y":number},"strength":number,"clockwise":boolean,"regionAnnotationId"?:string}
  >
}`,
    "",
    "Safety rules:",
    "- Keep strength in [0,1].",
    "- Keep gravityY in [0,0.8], airFriction in [0,0.08], restitution in [0,1].",
    "- Prefer using regionAnnotationId if user intent is local and a region exists.",
    "",
    "CURRENT STATE JSON:",
    input.stateJson,
    "",
    "USER COMMAND:",
    input.command,
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: "low" }, // documented for Gemini 3 :contentReference[oaicite:9]{index=9}
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
  if (!text) throw new Error("Empty response from Gemini.");

  return extractJsonObject(text) as GeminiLikeResponse;
}
