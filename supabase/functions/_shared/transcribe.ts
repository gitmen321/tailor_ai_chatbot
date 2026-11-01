import { env } from "./env.ts";
import { generateGeminiContent } from "./gemini.ts";

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

function normalizeMimeType(mimeType?: string) {
  const base = String(mimeType || "audio/wav").split(";")[0].trim().toLowerCase();
  const aliases: Record<string, string> = {
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/x-caf": "audio/mp4",
  };
  return aliases[base] ?? base;
}

function cleanTranscript(raw: string) {
  return String(raw || "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function transcribeMalayalamAudio({
  audioBase64,
  mimeType = "audio/wav",
}: {
  audioBase64: string;
  mimeType?: string;
}) {
  const model = env("GEMINI_TRANSCRIBE_MODEL") ?? env("GEMINI_CHAT_MODEL") ?? "gemini-3.5-flash";
  const transcript = cleanTranscript(
    await generateGeminiContent({
      model,
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
    }),
  );

  if (!transcript || transcript === "[UNCLEAR]") {
    throw new Error("Could not understand audio");
  }

  const words = transcript.split(/\s+/);
  if (words.length === 1 && transcript.length <= 4) {
    throw new Error("Transcript too uncertain");
  }

  return transcript;
}
