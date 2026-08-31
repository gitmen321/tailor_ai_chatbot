import { useCallback, useEffect, useRef, useState } from "react";
import { mergeFloat32, wavToBase64 } from "../utils/wavEncoder.js";

const SAMPLE_RATE = 16000;
const MIN_DURATION_MS = 1200;
/** If mobile speech API is silent, start WAV backup after this delay. */
const MOBILE_WAV_FALLBACK_MS = 2500;

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Phones/tablets — cannot share mic between Speech API and getUserMedia. */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  if (isIosDevice()) return true;
  return /Android/i.test(navigator.userAgent);
}

export function useVoiceRecorder({ onInterimTranscript } = {}) {
  const [phase, setPhase] = useState("idle"); // idle | recording
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [inputMode, setInputMode] = useState(null); // speech-api | wav | null

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const samplesRef = useRef([]);
  const timerRef = useRef(null);
  const wavFallbackTimerRef = useRef(null);
  const startTimeRef = useRef(0);
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");
  const speechFinalRef = useRef("");
  const isRecordingRef = useRef(false);

  const clearWavFallbackTimer = useCallback(() => {
    if (wavFallbackTimerRef.current) {
      clearTimeout(wavFallbackTimerRef.current);
      wavFallbackTimerRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        /* ignore */
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      clearWavFallbackTimer();
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupRecognition();
      cleanupAudio();
    };
  }, [cleanupAudio, cleanupRecognition, clearWavFallbackTimer]);

  const startWavCapture = useCallback(async ({ background = false } = {}) => {
    if (streamRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    streamRef.current = stream;
    samplesRef.current = [];

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = ctx;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      samplesRef.current.push(
        new Float32Array(event.inputBuffer.getChannelData(0))
      );
    };

    source.connect(processor);
    processor.connect(ctx.destination);

    // Keep speech-api UI when WAV is only a silent desktop fallback.
    if (!background) {
      setInputMode("wav");
    }
  }, []);

  const scheduleMobileWavFallback = useCallback(() => {
    clearWavFallbackTimer();
    wavFallbackTimerRef.current = setTimeout(() => {
      if (!isRecordingRef.current || streamRef.current) return;
      if (speechTranscriptRef.current.trim().length > 0) return;

      startWavCapture({ background: Boolean(recognitionRef.current) }).catch(() => {
        setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല. ക്രമീകരണങ്ങളിൽ മൈക്ക് ഓൺ ചെയ്യുക.");
      });
    }, MOBILE_WAV_FALLBACK_MS);
  }, [clearWavFallbackTimer, startWavCapture]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return false;

    const ios = isIosDevice();
    const mobile = isMobileDevice();
    const recognition = new SpeechRecognition();
    recognition.lang = "ml-IN";
    // Mobile browsers often break continuous=true; restart manually on onend.
    recognition.continuous = !mobile;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    speechTranscriptRef.current = "";
    speechFinalRef.current = "";

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = speechFinalRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (event.results[i].isFinal) {
          finalText = `${finalText} ${piece}`.trim();
        } else {
          interim = `${interim} ${piece}`.trim();
        }
      }

      speechFinalRef.current = finalText;
      const combined = `${finalText} ${interim}`.trim();
      speechTranscriptRef.current = combined;
      onInterimTranscript?.(combined);

      if (combined) clearWavFallbackTimer();
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല.");
        return;
      }

      if (event.error === "aborted" || event.error === "no-speech") return;

      if (mobile && !streamRef.current) {
        startWavCapture({ background: Boolean(recognitionRef.current) }).catch(() => {
          setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല. ക്രമീകരണങ്ങളിൽ മൈക്ക് ഓൺ ചെയ്യുക.");
        });
        return;
      }

      if (!mobile && streamRef.current) {
        setInputMode("wav");
      }
    };

    recognition.onend = () => {
      if (mobile && isRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          /* already running */
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setInputMode("speech-api");
    return true;
  }, [clearWavFallbackTimer, onInterimTranscript, startWavCapture]);

  const startRecording = useCallback(async () => {
    setError(null);
    speechTranscriptRef.current = "";
    speechFinalRef.current = "";
    clearWavFallbackTimer();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("ഈ ഉപകരണത്തിൽ മൈക്രോഫോൺ പിന്തുണയില്ല.");
      return null;
    }

    try {
      const mobile = isMobileDevice();
      const speechStarted = startSpeechRecognition();

      if (speechStarted && mobile) {
        // Android/iOS: speech only — parallel WAV steals the mic and kills live text.
        scheduleMobileWavFallback();
      } else if (speechStarted) {
        // Desktop: live speech + silent WAV fallback for Gemini.
        await startWavCapture({ background: true });
      } else {
        await startWavCapture();
      }

      isRecordingRef.current = true;
      startTimeRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      return true;
    } catch {
      isRecordingRef.current = false;
      clearWavFallbackTimer();
      cleanupRecognition();
      cleanupAudio();
      setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല. ക്രമീകരണങ്ങളിൽ മൈക്ക് ഓൺ ചെയ്യുക.");
      return null;
    }
  }, [
    cleanupAudio,
    cleanupRecognition,
    clearWavFallbackTimer,
    scheduleMobileWavFallback,
    startSpeechRecognition,
    startWavCapture,
  ]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      isRecordingRef.current = false;
      clearWavFallbackTimer();
      const durationMs = Date.now() - startTimeRef.current;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const finish = (payload) => {
        cleanupRecognition();
        cleanupAudio();
        setPhase("idle");
        setInputMode(null);
        resolve(payload);
      };

      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = () => {
          const speechText = (
            speechFinalRef.current || speechTranscriptRef.current
          ).trim();

          if (speechText.length >= 2 && durationMs >= MIN_DURATION_MS) {
            finish({
              transcript: speechText,
              source: "speech-api",
            });
            return;
          }

          const merged = mergeFloat32(samplesRef.current);
          samplesRef.current = [];

          if (durationMs < MIN_DURATION_MS) {
            finish({ error: "too_short" });
            return;
          }

          if (merged.length < SAMPLE_RATE * 0.8) {
            finish({ error: "too_small" });
            return;
          }

          finish({
            base64: wavToBase64(merged, SAMPLE_RATE),
            mimeType: "audio/wav",
            source: "gemini",
          });
        };

        try {
          recognition.stop();
        } catch {
          recognition.onend?.();
        }
        return;
      }

      const merged = mergeFloat32(samplesRef.current);
      samplesRef.current = [];

      if (durationMs < MIN_DURATION_MS) {
        finish({ error: "too_short" });
        return;
      }

      if (merged.length < SAMPLE_RATE * 0.8) {
        finish({ error: "too_small" });
        return;
      }

      finish({
        base64: wavToBase64(merged, SAMPLE_RATE),
        mimeType: "audio/wav",
        source: "gemini",
      });
    });
  }, [cleanupAudio, cleanupRecognition, clearWavFallbackTimer]);

  const cancelRecording = useCallback(() => {
    isRecordingRef.current = false;
    clearWavFallbackTimer();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    cleanupRecognition();
    cleanupAudio();
    samplesRef.current = [];
    speechTranscriptRef.current = "";
    speechFinalRef.current = "";
    setPhase("idle");
    setInputMode(null);
  }, [cleanupAudio, cleanupRecognition, clearWavFallbackTimer]);

  return {
    phase,
    elapsed,
    elapsedLabel: formatElapsed(elapsed),
    error,
    inputMode,
    clearError: () => setError(null),
    isRecording: phase === "recording",
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
