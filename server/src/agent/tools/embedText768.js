const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

/**
 * Embed text into a vector compatible with Postgres `vector(768)` (pgvector).
 * We call the Gemini REST embedding endpoint directly so we can force 768 dims.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedText768(text) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY in environment");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `Embedding API failed (${response.status}): ${errBody.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const vector = data.embeddings?.[0]?.values ?? [];
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${vector.length}`
    );
  }
  return vector;
}

