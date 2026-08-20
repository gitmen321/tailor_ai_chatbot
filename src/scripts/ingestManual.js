import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  deleteMachineDocsForModel,
  insertMachineDocs,
} from "../db/supabaseClient.js";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANUAL_PATH = join(
  __dirname,
  "../../knowledge/usha-quick-stitch-manual.md"
);

/**
 * Split markdown into coherent sections on ## and ### headings.
 * ### subsections include their parent ## heading for context.
 */
export function chunkMarkdownBySections(markdown) {
  const lines = markdown.split("\n");
  const chunks = [];
  let current = null;
  let parentH2 = null;

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (current?.trim()) chunks.push(current.trim());
      parentH2 = line;
      current = `${line}\n`;
      continue;
    }

    if (/^### /.test(line)) {
      if (current?.trim()) chunks.push(current.trim());
      current = parentH2 ? `${parentH2}\n\n${line}\n` : `${line}\n`;
      continue;
    }

    if (/^# /.test(line)) {
      continue;
    }

    if (current !== null) {
      current += `${line}\n`;
    }
  }

  if (current?.trim()) chunks.push(current.trim());

  return chunks.filter((chunk) => {
    const bodyLines = chunk
      .split("\n")
      .filter(
        (line) =>
          !/^#{1,3} /.test(line) && line.trim() !== "" && line.trim() !== "---"
      );
    return bodyLines.length > 0;
  });
}

/**
 * Embed document chunks at 768 dimensions via Gemini API.
 * Uses gemini-embedding-001 (text-embedding-004 is retired on the Gemini API;
 * same 768-dim target as the machine_docs vector column).
 */
async function embedDocuments768(texts, apiKey) {
  const batchSize = 100;
  const vectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
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
    for (const item of data.embeddings ?? []) {
      vectors.push(item.values ?? []);
    }
  }

  return vectors;
}

async function main() {
  const machineModel = process.env.MACHINE_MODEL;
  const googleApiKey = process.env.GOOGLE_API_KEY;

  if (!machineModel) {
    throw new Error("MACHINE_MODEL is required in environment");
  }
  if (!googleApiKey) {
    throw new Error("GOOGLE_API_KEY is required in environment");
  }

  const markdown = await readFile(MANUAL_PATH, "utf8");
  const chunks = chunkMarkdownBySections(markdown);

  if (chunks.length === 0) {
    throw new Error("No sections found in manual — check markdown headings");
  }

  console.log(`Read manual: ${chunks.length} section(s) to embed`);

  const deleted = await deleteMachineDocsForModel(machineModel);
  console.log(
    `Deleted ${deleted} existing row(s) for machine_model="${machineModel}"`
  );

  const vectors = await embedDocuments768(chunks, googleApiKey);
  console.log(`Generated ${vectors.length} embedding(s)`);

  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${vector.length} (${EMBEDDING_MODEL})`
      );
    }
  }

  const rows = chunks.map((content, index) => ({
    machine_model: machineModel,
    content,
    embedding: vectors[index],
  }));

  const inserted = await insertMachineDocs(rows);
  console.log(
    `Done — embedded and inserted ${inserted} chunk(s) into machine_docs`
  );
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
