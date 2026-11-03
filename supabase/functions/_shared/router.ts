import { corsHeaders, isAllowedOrigin } from "./cors.ts";
import { errorResponse, isAuthorized, jsonResponse } from "./http.ts";
import { normalizeApiPath } from "./route.ts";
import {
  getOrCreateConversation,
  getOrCreateUser,
  getWebUserConversationId,
  loadChatHistory,
  loadRecentHistory,
  saveMessage,
} from "./db.ts";
import { runAgent } from "./agent.ts";
import { transcribeMalayalamAudio } from "./transcribe.ts";
import { synthesizeMalayalamSpeech } from "./speak.ts";

const MAX_JSON_BODY_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BASE64_LENGTH = 7 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = 10 * 1024 * 1024;

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw Object.assign(new Error("Content-Type must be application/json"), { status: 415 });
  }
  const contentLength = Number(req.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw Object.assign(new Error("Request body is too large"), { status: 413 });
  }
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large"), { status: 413 });
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("JSON body must be an object");
    }
    return data as Record<string, unknown>;
  } catch (err) {
    if ((err as { status?: number }).status) throw err;
    const message = err instanceof Error ? err.message : "Invalid JSON";
    throw Object.assign(new Error(message), { status: 400 });
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (!isAllowedOrigin(req)) {
    return errorResponse(req, 403, "Origin not allowed");
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  const url = new URL(req.url);
  const path = normalizeApiPath(url.pathname);

  try {
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return jsonResponse(req, {
        ok: true,
        ready: true,
        service: "tailor-assistant-api",
        runtime: "supabase-edge",
      });
    }

    if (!isAuthorized(req)) {
      return errorResponse(req, 401, "Unauthorized");
    }

    if (req.method === "GET" && path === "/history") {
      const webUserId = url.searchParams.get("webUserId") ?? "";
      if (!webUserId || webUserId.length > 128) return errorResponse(req, 400, "webUserId is required (max 128 characters)");
      const conversationId = await getWebUserConversationId(webUserId);
      const messages = await loadChatHistory(conversationId, 100);
      return jsonResponse(req, { messages });
    }

    if (req.method === "POST" && path === "/speak") {
      const body = await readJson(req);
      const text = asString(body.text);
      if (!text || text.length > 2000) {
        return errorResponse(req, 400, "text is required (max 2000 chars)");
      }
      const audio = await synthesizeMalayalamSpeech(text);
      return jsonResponse(req, audio);
    }

    if (req.method === "POST" && path === "/transcribe") {
      const body = await readJson(req);
      const audioBase64 = asString(body.audioBase64);
      if (!audioBase64) return errorResponse(req, 400, "audioBase64 is required");
      if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH || !/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64)) {
        return errorResponse(req, 400, "audioBase64 is invalid or too large");
      }
      const mimeType = asString(body.mimeType) ?? "audio/webm";
      if (!["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg"].includes(mimeType.split(";")[0].toLowerCase())) {
        return errorResponse(req, 400, "Unsupported audio mime type");
      }
      const transcript = await transcribeMalayalamAudio({ audioBase64, mimeType });
      return jsonResponse(req, { transcript });
    }

    if (req.method === "POST" && path === "/chat") {
      const body = await readJson(req);
      const whatsappNumber = asString(body.whatsappNumber);
      const webUserId = asString(body.webUserId);
      const text = asString(body.text);
      const imageBase64 = asString(body.imageBase64) ?? null;
      const imageMimeType = asString(body.imageMimeType) ?? null;

      if (!text || text.length > 4000) return errorResponse(req, 400, "text is required (max 4000 characters)");
      if (webUserId && webUserId.length > 128) return errorResponse(req, 400, "webUserId is too long");
      if (whatsappNumber && whatsappNumber.length > 32) return errorResponse(req, 400, "whatsappNumber is too long");
      if (imageBase64 && (imageBase64.length > MAX_IMAGE_BASE64_LENGTH || !/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64))) {
        return errorResponse(req, 400, "imageBase64 is invalid or too large");
      }
      if (imageMimeType && !["image/jpeg", "image/png", "image/webp"].includes(imageMimeType)) {
        return errorResponse(req, 400, "imageMimeType must be image/jpeg, image/png, or image/webp");
      }
      if (!whatsappNumber && !webUserId) {
        return errorResponse(req, 400, "whatsappNumber or webUserId is required");
      }

      const user = whatsappNumber
        ? await getOrCreateUser(whatsappNumber, { webUserId: null })
        : await getOrCreateUser(`web:${webUserId}`, { webUserId: webUserId ?? null });

      const conversation = await getOrCreateConversation(user.id);
      const conversationId = conversation.id;

      await saveMessage(conversationId, "user", text, imageBase64 ? "image" : null);

      const recentHistory = await loadRecentHistory(conversationId, 20);
      const { reply, videos } = await runAgent({
        text,
        recentHistory,
        imageBase64,
        imageMimeType,
      });

      await saveMessage(conversationId, "assistant", reply, null, {
        videos: videos ?? [],
      });

      return jsonResponse(req, { reply, videos: videos ?? [] });
    }

    return errorResponse(req, 404, `Not found: ${req.method} ${path}`);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("api error:", err);
    const message = status >= 500 ? "Internal server error" : err instanceof Error ? err.message : "Invalid request";
    return errorResponse(req, status, message);
  }
}
