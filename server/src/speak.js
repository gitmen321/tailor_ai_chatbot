const PRIMARY_MODEL =
  process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";
const MAX_CHARS = 600;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanForSpeech(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

function parsePcmMime(mimeType) {
  const rateMatch = /rate=(\d+)/i.exec(mimeType || "");
  const channelsMatch = /channels=(\d+)/i.exec(mimeType || "");
  return {
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    channels: channelsMatch ? Number(channelsMatch[1]) : 1,
    bitsPerSample: 16,
  };
}

function pcmToWav(pcm, { sampleRate, channels, bitsPerSample }) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const wav = Buffer.alloc(44 + pcm.length);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + pcm.length, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);

  return wav;
}

async function callGeminiTts(spoken, model) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY in environment");

  const response = await fetch(
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
              prebuiltVoiceConfig: { voiceName: TTS_VOICE },
            },
          },
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
    const err = new Error(`TTS API failed (${response.status}): ${msg}`);
    err.status = response.status;
    throw err;
  }

  const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  const rawMime = inline?.inlineData?.mimeType ?? "";
  const rawB64 = inline?.inlineData?.data;

  if (!rawB64) {
    throw new Error("TTS returned no audio");
  }

  const pcm = Buffer.from(rawB64, "base64");
  const wav = pcmToWav(pcm, parsePcmMime(rawMime));

  return {
    audioBase64: wav.toString("base64"),
    mimeType: "audio/wav",
  };
}

/**
 * @param {string} text
 * @returns {Promise<{ audioBase64: string, mimeType: string }>}
 */
export async function synthesizeMalayalamSpeech(text) {
  const spoken = cleanForSpeech(text);
  if (!spoken) throw new Error("Nothing to speak");

  try {
    return await callGeminiTts(spoken, PRIMARY_MODEL);
  } catch (err) {
    // Retry once on rate-limit / transient errors.
    if (err.status === 429 || err.status === 503) {
      await sleep(4000);
      return await callGeminiTts(spoken, PRIMARY_MODEL);
    }
    throw err;
  }
}
