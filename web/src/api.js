import { resolveApiBase } from "./apiBase.js";
import { supabase } from "./lib/supabase.js";
const CHAT_UI_CLEARED_KEY = "tailor_chat_ui_cleared";

const CHAT_TIMEOUT_MS = 90000;
const TRANSCRIBE_TIMEOUT_MS = 60000;
const SPEAK_TIMEOUT_MS = 120000;

function apiBase() {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  return resolveApiBase(import.meta.env.VITE_SERVER_API_URL, hostname);
}

async function authHeaders() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function throwApiError(response, fallback) {
  const payload = await response.json().catch(() => null);
  throw new Error(payload?.error?.message || payload?.error || fallback);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options?.signal;

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeout);
      throw new DOMException("Aborted", "AbortError");
    }
    externalSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function isChatUiCleared(userId) {
  return localStorage.getItem(`${CHAT_UI_CLEARED_KEY}:${userId}`) === "true";
}

export function setChatUiCleared(userId, cleared) {
  if (cleared) {
    localStorage.setItem(`${CHAT_UI_CLEARED_KEY}:${userId}`, "true");
  } else {
    localStorage.removeItem(`${CHAT_UI_CLEARED_KEY}:${userId}`);
  }
}

export async function checkServerHealth() {
  const res = await fetchWithTimeout(`${apiBase()}/api/health`, {}, 5000);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return true;
}

export async function fetchProfile() {
  const res = await fetchWithTimeout(`${apiBase()}/api/profile`, { headers: await authHeaders() }, 15000);
  if (!res.ok) await throwApiError(res, `Profile request failed (${res.status})`);
  return res.json();
}

export async function saveProfile(profile) {
  const res = await fetchWithTimeout(`${apiBase()}/api/profile`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(profile),
  }, 15000);
  if (!res.ok) await throwApiError(res, `Profile save failed (${res.status})`);
  return res.json();
}

export async function fetchChatHistory({ signal } = {}) {
  const res = await fetchWithTimeout(`${apiBase()}/api/history`, { headers: await authHeaders(), signal }, 15000);
  if (!res.ok) await throwApiError(res, `History fetch failed (${res.status})`);

  return res.json();
}

export async function sendChatMessage({ text, imageBase64, imageMimeType, signal }) {
  const res = await fetchWithTimeout(
    `${apiBase()}/api/chat`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        text,
        imageBase64: imageBase64 || null,
        imageMimeType: imageMimeType || null,
      }),
      signal,
    },
    CHAT_TIMEOUT_MS
  );

  if (!res.ok) {
    await throwApiError(res, `Server error (${res.status})`);
  }

  return res.json();
}

export async function transcribeAudio({ audioBase64, mimeType, signal }) {
  const res = await fetchWithTimeout(
    `${apiBase()}/api/transcribe`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        audioBase64,
        mimeType: mimeType || "audio/webm",
      }),
      signal,
    },
    TRANSCRIBE_TIMEOUT_MS
  );

  if (!res.ok) {
    await throwApiError(res, `Transcription failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.transcript?.trim()) {
    throw new Error("Empty transcript");
  }

  return data;
}

export async function fetchSpeechAudio({ text, signal }) {
  const res = await fetchWithTimeout(
    `${apiBase()}/api/speak`,
    {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ text }),
      signal,
    },
    SPEAK_TIMEOUT_MS
  );

  if (!res.ok) {
    await throwApiError(res, `Speech failed (${res.status})`);
  }

  return res.json();
}

/** Read a File as raw base64 (no data: prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
