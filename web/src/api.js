const STORAGE_KEY = "tailor_web_user_id";
const CHAT_UI_CLEARED_KEY = "tailor_chat_ui_cleared";

const CHAT_TIMEOUT_MS = 90000;
const TRANSCRIBE_TIMEOUT_MS = 60000;
const SPEAK_TIMEOUT_MS = 120000;

function apiBase() {
  const base = import.meta.env.VITE_SERVER_API_URL?.trim();
  // Empty = same-origin (/api/*). Netlify proxies that to Railway (see netlify.toml).
  if (!base) return "";
  return base.replace(/\/$/, "");
}

function apiToken() {
  const token = import.meta.env.VITE_API_AUTH_TOKEN;
  if (!token) throw new Error("VITE_API_AUTH_TOKEN is not set");
  return token;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiToken()}`,
  };
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

export function getOrCreateWebUserId() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

export function isChatUiCleared() {
  return localStorage.getItem(CHAT_UI_CLEARED_KEY) === "true";
}

export function setChatUiCleared(cleared) {
  if (cleared) {
    localStorage.setItem(CHAT_UI_CLEARED_KEY, "true");
  } else {
    localStorage.removeItem(CHAT_UI_CLEARED_KEY);
  }
}

export async function checkServerHealth() {
  const res = await fetchWithTimeout(`${apiBase()}/api/health`, {}, 5000);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return true;
}

export async function fetchChatHistory({ webUserId, signal }) {
  const url = `${apiBase()}/api/history?webUserId=${encodeURIComponent(webUserId)}`;
  const res = await fetchWithTimeout(url, { headers: authHeaders(), signal }, 15000);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `History fetch failed (${res.status})`);
  }

  return res.json();
}

export async function sendChatMessage({ webUserId, text, imageBase64, imageMimeType, signal }) {
  const res = await fetchWithTimeout(
    `${apiBase()}/api/chat`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        webUserId,
        text,
        imageBase64: imageBase64 || null,
        imageMimeType: imageMimeType || null,
      }),
      signal,
    },
    CHAT_TIMEOUT_MS
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `Server error (${res.status})`);
  }

  return res.json();
}

export async function transcribeAudio({ audioBase64, mimeType, signal }) {
  const res = await fetchWithTimeout(
    `${apiBase()}/api/transcribe`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        audioBase64,
        mimeType: mimeType || "audio/webm",
      }),
      signal,
    },
    TRANSCRIBE_TIMEOUT_MS
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `Transcription failed (${res.status})`);
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
      headers: authHeaders(),
      body: JSON.stringify({ text }),
      signal,
    },
    SPEAK_TIMEOUT_MS
  );

  if (!res.ok) {
    let errText = await res.text().catch(() => "");
    try {
      const parsed = JSON.parse(errText);
      errText = parsed.error || errText;
    } catch {
      /* use raw text */
    }
    throw new Error(errText || `Speech failed (${res.status})`);
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
