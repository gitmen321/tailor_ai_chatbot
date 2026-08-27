import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchSpeechAudio } from "../api.js";

const STORAGE_KEY = "tailor_read_replies_aloud";

const VoiceSettingsContext = createContext(null);

/** Strip markdown-ish formatting for cleaner TTS. */
export function textForSpeech(text) {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpeechError(message) {
  const msg = String(message || "");
  if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
    return "ഓഡിയോ API പരിധി എത്തി. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ ടെക്സ്റ്റ് വായിക്കുക.";
  }
  if (msg.includes("abort") || msg.toLowerCase().includes("timeout")) {
    return "ഓഡിയോ ലോഡ് സമയം കഴിഞ്ഞു. വീണ്ടും ശ്രമിക്കുക.";
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "സെർവറിലേക്ക് കണക്ട് ചെയ്യാൻ കഴിഞ്ഞില്ല. സെർവർ ഓൺ ആണോ എന്ന് പരിശോധിക്കുക.";
  }
  return "ഓഡിയോ ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.";
}

function speakWithBrowser(text, { onStart, onEnd } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve(false);
  }

  const voices = window.speechSynthesis.getVoices();
  const mlVoice = voices.find(
    (v) => v.lang === "ml-IN" || v.lang.startsWith("ml-")
  );

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ml-IN";
    utterance.rate = 0.92;
    if (mlVoice) utterance.voice = mlVoice;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => {
      onEnd?.();
      resolve(true);
    };
    utterance.onerror = () => {
      onEnd?.();
      resolve(false);
    };
    window.speechSynthesis.speak(utterance);
  });
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function VoiceSettingsProvider({ children }) {
  const [readAloud, setReadAloudState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const [speechError, setSpeechError] = useState(null);

  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const abortRef = useRef(null);

  /** Must run synchronously inside a user click/tap handler. */
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return null;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }, []);

  const stopSpeaking = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        /* already stopped */
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    setIsLoadingSpeech(false);
  }, []);

  const cleanupOnUnmount = useCallback(() => {
    stopSpeaking();
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stopSpeaking]);

  useEffect(() => cleanupOnUnmount, [cleanupOnUnmount]);

  const setReadAloud = useCallback(
    (enabled) => {
      unlockAudio();
      setReadAloudState(enabled);
      localStorage.setItem(STORAGE_KEY, String(enabled));
      setSpeechError(null);
      if (!enabled) stopSpeaking();
    },
    [stopSpeaking, unlockAudio]
  );

  const speakText = useCallback(
    async (text) => {
      const spoken = textForSpeech(text);
      if (!spoken) return false;

      // Unlock audio in the same tick as the user gesture when possible.
      const ctx = unlockAudio();
      if (!ctx) {
        setSpeechError("ഈ ബ്രൗസർ ഓഡിയോ പ്ലേബാക്ക് പിന്തുണയ്ക്കുന്നില്ല.");
        return false;
      }

      stopSpeaking();
      setSpeechError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoadingSpeech(true);

      try {
        const { audioBase64 } = await fetchSpeechAudio({
          text: spoken,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return false;

        // Ensure context is still running after async fetch.
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const arrayBuffer = base64ToArrayBuffer(audioBase64);
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

        if (controller.signal.aborted) return false;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        sourceRef.current = source;

        source.onended = () => {
          sourceRef.current = null;
          setIsSpeaking(false);
        };

        setIsLoadingSpeech(false);
        setIsSpeaking(true);
        source.start(0);
        return true;
      } catch (err) {
        if (err?.name === "AbortError") return false;

        const msg = String(err?.message || "");
        setIsLoadingSpeech(false);

        // Fall back to browser voice when server TTS fails (e.g. API quota).
        const browserOk = await speakWithBrowser(spoken, {
          onStart: () => {
            setIsLoadingSpeech(false);
            setIsSpeaking(true);
          },
          onEnd: () => setIsSpeaking(false),
        });
        if (browserOk) {
          setSpeechError(null);
          return true;
        }

        setSpeechError(parseSpeechError(msg));
        stopSpeaking();
        return false;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [stopSpeaking, unlockAudio]
  );

  const speakReply = useCallback(
    (text) => {
      if (!readAloud) return;
      void speakText(text);
    },
    [readAloud, speakText]
  );

  const value = useMemo(
    () => ({
      readAloud,
      setReadAloud,
      ttsSupported: true,
      malayalamVoiceAvailable: true,
      usingFallbackVoice: false,
      isSpeaking,
      isLoadingSpeech,
      speechError,
      clearSpeechError: () => setSpeechError(null),
      unlockAudio,
      speakReply,
      speakText,
      stopSpeaking,
    }),
    [
      readAloud,
      setReadAloud,
      isSpeaking,
      isLoadingSpeech,
      speechError,
      unlockAudio,
      speakReply,
      speakText,
      stopSpeaking,
    ]
  );

  return (
    <VoiceSettingsContext.Provider value={value}>
      {children}
    </VoiceSettingsContext.Provider>
  );
}

export function useVoiceSettings() {
  const ctx = useContext(VoiceSettingsContext);
  if (!ctx) {
    throw new Error("useVoiceSettings must be used within VoiceSettingsProvider");
  }
  return ctx;
}
