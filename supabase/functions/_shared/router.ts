import { corsHeaders } from "./cors.ts";
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

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    if (!data || typeof data !== "object") {
      throw new Error("JSON body must be an object");
    }
    return data as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    throw Object.assign(new Error(message), { status: 400 });
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function handleRequest(req: Request): Promise<Response> {
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
      if (!webUserId) return errorResponse(req, 400, "webUserId is required");
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
      const mimeType = asString(body.mimeType) ?? "audio/webm";
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

      if (!text) return errorResponse(req, 400, "text is required");
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
    const message = err instanceof Error ? err.message : "Error";
    console.error("api error:", message);
    return errorResponse(req, status, message);
  }
}
