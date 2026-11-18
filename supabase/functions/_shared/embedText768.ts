import { requireEnv } from "./env.ts";
import { AppError } from "./errors.ts";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

export async function embedText768(text: string): Promise<number[]> {
  const apiKey = requireEnv("GOOGLE_API_KEY");

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          }],
        }),
      },
    );
  } catch {
    throw new AppError(
      503,
      "embedding_unavailable",
      "The AI service is temporarily unavailable.",
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError(
        503,
        "embedding_rate_limited",
        "The AI service is busy. Please try again shortly.",
      );
    }
    throw new AppError(
      502,
      "embedding_provider_error",
      "The AI service could not process the request.",
    );
  }

  const data = await response.json().catch(() => ({}));
  const vector = data.embeddings?.[0]?.values ?? [];
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new AppError(
      502,
      "embedding_invalid_response",
      "The AI service returned an invalid response.",
    );
  }
  return vector;
}
