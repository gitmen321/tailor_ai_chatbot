const DEFAULT_MODEL = "gemini-3.5-flash";

function getApiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY in environment");
  return apiKey;
}

function getModel(override) {
  return override ?? process.env.GEMINI_CHAT_MODEL ?? DEFAULT_MODEL;
}

function extractText(data) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("")
      .trim() ?? ""
  );
}

/**
 * @param {{
 *   model?: string,
 *   systemPrompt?: string,
 *   userParts: Array<{ text?: string, inlineData?: { mimeType: string, data: string } }>,
 *   maxOutputTokens?: number,
 * }} opts
 */
export async function generateGeminiContent({
  model,
  systemPrompt,
  userParts,
  maxOutputTokens = 8192,
}) {
  const apiKey = getApiKey();
  const modelName = getModel(model);

  const body = {
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
    }
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
