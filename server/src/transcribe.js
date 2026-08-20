import { generateGeminiContent } from "./gemini.js";

const TRANSCRIBE_MODEL =
  process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-3.5-flash";

const TRANSCRIBE_PROMPT = [
  "Transcribe the spoken audio accurately in Malayalam using Malayalam script.",
  "If the speaker uses English words, write them as spoken.",
  "Output ONLY the transcribed text — no quotes, labels, or translation.",
  "If speech is unclear, transcribe your best guess.",
].join(" ");

/** Gemini expects a base mime type without codec suffixes. */
function normalizeMimeType(mimeType) {
  const base = String(mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
  const aliases = {
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/x-caf": "audio/mp4",
  };
  return aliases[base] ?? base;
}

/**
 * @param {{ audioBase64: string, mimeType?: string }} input
 * @returns {Promise<string>}
 */
export async function transcribeMalayalamAudio({ audioBase64, mimeType = "audio/webm" }) {
  return generateGeminiContent({
    model: TRANSCRIBE_MODEL,
    userParts: [
      {
        inlineData: {
          mimeType: normalizeMimeType(mimeType),
          data: audioBase64,
        },
      },
      { text: TRANSCRIBE_PROMPT },
    ],
    maxOutputTokens: 1024,
  });
}
