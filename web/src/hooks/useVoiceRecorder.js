import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "",
];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_CANDIDATES) {
    if (mime && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder() {
  const [phase, setPhase] = useState("idle"); // idle | recording
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef("audio/webm");
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("ഈ ഉപകരണത്തിൽ മൈക്രോഫോൺ പിന്തുണയില്ല.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      mimeTypeRef.current = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      // No timeslice — one complete container on stop (more reliable on desktop Chrome).
      recorder.start();
      startTimeRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      return true;
    } catch {
      cleanupStream();
      setError("മൈക്രോഫോൺ അനുമതി നൽകിയില്ല. ക്രമീകരണങ്ങളിൽ മൈക്ക് ഓൺ ചെയ്യുക.");
      return null;
    }
  }, [cleanupStream]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(null);
        return;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Flush the final chunk before stopping (required on some browsers).
      if (typeof recorder.requestData === "function") {
        try {
          recorder.requestData();
        } catch {
          /* ignore */
        }
      }

      const durationMs = Date.now() - startTimeRef.current;

      recorder.onstop = async () => {
        cleanupStream();
        setPhase("idle");

        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });
        chunksRef.current = [];

        if (durationMs < 900) {
          resolve({ error: "too_short" });
          return;
        }

        if (blob.size < 1000) {
          resolve({ error: "too_small" });
          return;
        }

        const base64 = await blobToBase64(blob);
        resolve({
          blob,
          base64,
          mimeType: mimeTypeRef.current || "audio/webm",
        });
      };

      recorder.stop();
    });
  }, [cleanupStream]);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.onstop = () => {
        cleanupStream();
        chunksRef.current = [];
        setPhase("idle");
      };
      recorder.stop();
    } else {
      cleanupStream();
      setPhase("idle");
    }
  }, [cleanupStream]);

  return {
    phase,
    elapsed,
    elapsedLabel: formatElapsed(elapsed),
    error,
    clearError: () => setError(null),
    isRecording: phase === "recording",
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
