import type { GeminiLikeResponse } from "./types";
import type { Params } from "../models/Params";
import type { Annotation } from "../models/Annotation";
import { mockGeminiRespond } from "./mockGemini";
import { directGeminiRespond } from "./directGemini";

type Mode = "mock" | "direct";

export async function getAIResponse(input: {
  command: string;
  params: Params;
  annotations: Annotation[];
  canvas: { width: number; height: number };
}): Promise<GeminiLikeResponse> {
  const mode = (import.meta.env.VITE_AI_MODE as Mode) ?? "mock";

  if (mode === "mock") {
    return mockGeminiRespond(input);
  }

  // direct (prototype)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env.local");

  const stateJson = JSON.stringify(
    { params: input.params, annotations: input.annotations, canvas: input.canvas },
    null,
    2
  );

  const model = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? "gemini-3-flash-preview";

  return directGeminiRespond({
    apiKey,
    model,
    command: input.command,
    stateJson,
  });
}
