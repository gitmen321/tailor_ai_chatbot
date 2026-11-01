import { env, requireEnv } from "./env.ts";

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
    throw new Error(`Gemini API failed (${response.status}): ${msg}`);
  }

  const text = extractText(data);
  if (!text) {
    const finishReason = data.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(`Gemini returned no text (finishReason=${finishReason})`);
  }

  return text;
}
