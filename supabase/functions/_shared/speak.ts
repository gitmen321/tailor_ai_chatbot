import { env, requireEnv } from "./env.ts";
import { AppError } from "./errors.ts";

const MAX_CHARS = 600;
type GeminiSpeechResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
    };
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanForSpeech(text: string) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

function parsePcmMime(mimeType: string) {
  const rateMatch = /rate=(\d+)/i.exec(mimeType || "");
  const channelsMatch = /channels=(\d+)/i.exec(mimeType || "");
  return {
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    channels: channelsMatch ? Number(channelsMatch[1]) : 1,
    bitsPerSample: 16,
  };
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pcmToWav(
  pcm: Uint8Array,
  { sampleRate, channels, bitsPerSample }: {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
  },
) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const wav = new Uint8Array(44 + pcm.length);
  const view = new DataView(wav.buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);
  return wav;
}

async function callGeminiTts(spoken: string, model: string) {
  const apiKey = requireEnv("GOOGLE_API_KEY");
  const voice = env("GEMINI_TTS_VOICE") ?? "Kore";

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: spoken }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
      },
    );
  } catch {
    throw new AppError(
      503,
      "speech_provider_unavailable",
      "Speech is temporarily unavailable.",
    );
  }

  let data: GeminiSpeechResponse;
  try {
    data = await response.json() as GeminiSpeechResponse;
  } catch {
    throw new AppError(
      502,
      "speech_provider_error",
      "Speech service returned an invalid response.",
    );
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError(
        429,
        "speech_rate_limited",
        "Speech service is busy. Please try again shortly.",
      );
    }
    throw new AppError(
      502,
      "speech_provider_error",
      "Speech service could not complete the request.",
    );
  }

  const inline = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData,
  );
  const rawMime = inline?.inlineData?.mimeType ?? "";
  const rawB64 = inline?.inlineData?.data;

  if (!rawB64) {
    throw new AppError(
      502,
      "speech_provider_error",
      "Speech service returned no audio.",
    );
  }

  const pcm = base64ToBytes(rawB64);
  const wav = pcmToWav(pcm, parsePcmMime(rawMime));
  return {
    audioBase64: bytesToBase64(wav),
    mimeType: "audio/wav",
  };
}

export async function synthesizeMalayalamSpeech(text: string) {
  const spoken = cleanForSpeech(text);
  if (!spoken) {
    throw new AppError(400, "invalid_text", "Text is required for speech.");
  }
  const model = env("GEMINI_TTS_MODEL") ?? "gemini-3.1-flash-tts-preview";

  try {
    return await callGeminiTts(spoken, model);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429 || status === 503) {
      await sleep(4000);
      try {
        return await callGeminiTts(spoken, model);
      } catch (retryError) {
        if (retryError instanceof AppError) throw retryError;
        throw new AppError(
          503,
          "speech_provider_unavailable",
          "Speech is temporarily unavailable.",
        );
      }
    }
    if (err instanceof AppError) throw err;
    throw new AppError(
      503,
      "speech_provider_unavailable",
      "Speech is temporarily unavailable.",
    );
  }
}
