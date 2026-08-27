import { useCallback, useEffect, useRef, useState } from "react";
import { mergeFloat32, wavToBase64 } from "../utils/wavEncoder.js";

const SAMPLE_RATE = 16000;
const MIN_DURATION_MS = 1200;

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
  const startTimeRef = useRef(0);
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef("");
  const speechFinalRef = useRef("");

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
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupRecognition();
      cleanupAudio();
    };
  }, [cleanupAudio, cleanupRecognition]);

  const startWavCapture = useCallback(async () => {
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
    setInputMode("wav");
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.lang = "ml-IN";
    recognition.continuous = true;
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
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        // Fall back silently — wav capture may still work
        setInputMode("wav");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setInputMode("speech-api");
    return true;
  }, [onInterimTranscript]);

  const startRecording = useCallback(async () => {
    setError(null);
    speechTranscriptRef.current = "";
    speechFinalRef.current = "";

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("ഈ ഉപകരണത്തിൽ മൈക്രോഫോൺ പിന്തുണയില്ല.");
      return null;
    }

    try {
      const speechStarted = startSpeechRecognition();
      await startWavCapture();

      if (!speechStarted) setInputMode("wav");

      startTimeRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      return true;
    } catch {
      cleanupRecognition();
      cleanupAudio();
      setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല. ക്രമീകരണങ്ങളിൽ മൈക്ക് ഓൺ ചെയ്യുക.");
      return null;
    }
  }, [cleanupAudio, cleanupRecognition, startSpeechRecognition, startWavCapture]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
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

          // Speech API empty — use WAV for server transcription
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

      // WAV-only path
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
  }, [cleanupAudio, cleanupRecognition]);

  const cancelRecording = useCallback(() => {
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
  }, [cleanupAudio, cleanupRecognition]);

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
