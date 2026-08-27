import { generateGeminiContent } from "./gemini.js";

const TRANSCRIBE_MODEL =
  process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-3.5-flash";

const TRANSCRIBE_SYSTEM = [
  "You are a Malayalam speech-to-text engine for a tailoring assistant app.",
  "The speaker is Rasiya, a Malayalam-speaking tailor in Kerala.",
  "She asks about her Usha Quick Stitch sewing machine.",
  "",
  "Transcription rules:",
  "- Output ONLY the spoken words in Malayalam script (Unicode).",
  "- Keep brand names as spoken: Usha, Quick Stitch.",
  "- Common tailoring terms: തയ്യൽ, നാഡി, തൂക്കുനാഡി, ബോബിൻ, അസ്തമ്പ്, തുണി, എഞ്ചിൻ, വേഗത, ബട്ടൺ, തുന്നൽ",
  "- If audio is silence, noise, or unintelligible, output exactly: [UNCLEAR]",
  "- Do NOT invent or guess words. Do NOT output random single words.",
  "- No quotes, labels, English translation, or punctuation unless clearly spoken.",
].join("\n");

const TRANSCRIBE_USER = "Transcribe this voice message. Language: Malayalam (ml-IN).";

/** Gemini expects a base mime type without codec suffixes. */
function normalizeMimeType(mimeType) {
  const base = String(mimeType || "audio/wav").split(";")[0].trim().toLowerCase();
  const aliases = {
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/x-caf": "audio/mp4",
  };
  return aliases[base] ?? base;
}

function cleanTranscript(raw) {
  return String(raw || "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {{ audioBase64: string, mimeType?: string }} input
 * @returns {Promise<string>}
 */
export async function transcribeMalayalamAudio({ audioBase64, mimeType = "audio/wav" }) {
  const transcript = cleanTranscript(
    await generateGeminiContent({
      model: TRANSCRIBE_MODEL,
      systemPrompt: TRANSCRIBE_SYSTEM,
      userParts: [
        {
          inlineData: {
            mimeType: normalizeMimeType(mimeType),
            data: audioBase64,
          },
        },
        { text: TRANSCRIBE_USER },
      ],
      maxOutputTokens: 512,
    })
  );

  if (!transcript || transcript === "[UNCLEAR]") {
    throw new Error("Could not understand audio");
  }

  // Reject obvious hallucinations: single very short word on likely real speech
  const words = transcript.split(/\s+/);
  if (words.length === 1 && transcript.length <= 4) {
    throw new Error("Transcript too uncertain");
  }

  return transcript;
}
