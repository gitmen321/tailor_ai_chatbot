import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "tailor_read_replies_aloud";

const VoiceSettingsContext = createContext(null);

function findMalayalamVoice(voices) {
  return voices.find(
    (v) => v.lang === "ml-IN" || v.lang.startsWith("ml-")
  );
}

export function VoiceSettingsProvider({ children }) {
  const [readAloud, setReadAloudState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [malayalamVoice, setMalayalamVoice] = useState(null);
  const [voicesReady, setVoicesReady] = useState(false);

  const refreshVoices = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setMalayalamVoice(null);
      setVoicesReady(true);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    const ml = findMalayalamVoice(voices);
    setMalayalamVoice(ml ?? null);
    setVoicesReady(voices.length > 0 || ml !== null);

    if (voices.length > 0 && !ml && readAloud) {
      setReadAloudState(false);
      localStorage.setItem(STORAGE_KEY, "false");
    }
  }, [readAloud]);

  useEffect(() => {
    refreshVoices();
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [refreshVoices]);

  const setReadAloud = useCallback(
    (enabled) => {
      if (enabled && !malayalamVoice) return;
      setReadAloudState(enabled);
      localStorage.setItem(STORAGE_KEY, String(enabled));
    },
    [malayalamVoice]
  );

  const speakReply = useCallback(
    (text) => {
      if (!readAloud || !malayalamVoice || !text?.trim()) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = malayalamVoice;
      utterance.lang = malayalamVoice.lang || "ml-IN";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    },
    [readAloud, malayalamVoice]
  );

  const value = useMemo(
    () => ({
      readAloud,
      setReadAloud,
      malayalamVoiceAvailable: Boolean(malayalamVoice),
      voicesReady,
      speakReply,
    }),
    [readAloud, setReadAloud, malayalamVoice, voicesReady, speakReply]
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
