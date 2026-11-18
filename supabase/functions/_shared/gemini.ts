import { env, requireEnv } from "./env.ts";
import { AppError } from "./errors.ts";

const DEFAULT_MODEL = "gemini-3.5-flash";

function getModel(override?: string): string {
  return override ?? env("GEMINI_CHAT_MODEL") ?? DEFAULT_MODEL;
}

function extractText(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("")
      .trim() ?? ""
  );
}

export async function generateGeminiContent({
  model,
  systemPrompt,
  userParts,
  maxOutputTokens = 8192,
}: {
  model?: string;
  systemPrompt?: string;
  userParts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }>;
  maxOutputTokens?: number;
}): Promise<string> {
  const apiKey = requireEnv("GOOGLE_API_KEY");
  const modelName = getModel(model);

  const body: Record<string, unknown> = {
    contents: [{ parts: userParts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new AppError(
      503,
      "ai_provider_unavailable",
      "The AI service is temporarily unavailable.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError(
        503,
        "ai_provider_rate_limited",
        "The AI service is busy. Please try again shortly.",
      );
    }
    throw new AppError(
      502,
      "ai_provider_error",
      "The AI service could not complete the request.",
    );
  }

  const text = extractText(data);
  if (!text) {
    throw new AppError(
      502,
      "ai_empty_response",
      "The AI service returned an empty response.",
    );
  }

  return text;
}
