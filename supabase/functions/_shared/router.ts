import { corsHeaders, isAllowedOrigin } from "./cors.ts";
import { jsonResponse } from "./http.ts";
import { normalizeApiPath } from "./route.ts";
import {
  getAccountConversationId,
  getOrCreateConversation,
  getOrCreateUser,
  loadChatHistory,
  loadRecentHistory,
  saveMessage,
} from "./db.ts";
import { runAgent } from "./agent.ts";
import { transcribeMalayalamAudio } from "./transcribe.ts";
import { synthesizeMalayalamSpeech } from "./speak.ts";
import { authenticateRequest, type RequestIdentity } from "./auth.ts";
import { AppError, toAppError } from "./errors.ts";
import { logRequest } from "./logger.ts";
import { clientIp, enforceRateLimits } from "./rateLimit.ts";
import { runChatUseCase } from "./application/chatService.ts";
import {
  getProfileUseCase,
  updateProfileUseCase,
} from "./application/profileService.ts";
import { getHistoryUseCase } from "./application/historyService.ts";

const MAX_JSON_BODY_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BASE64_LENGTH = 7 * 1024 * 1024;
const MAX_AUDIO_BASE64_LENGTH = 10 * 1024 * 1024;

type Profile = {
  name: string | null;
  machine_brand: string | null;
  machine_model: string | null;
  preferred_language?: string | null;
};
type Dependencies = {
  authenticate: (req: Request) => Promise<RequestIdentity>;
  enforceRateLimits: (
    identity: string,
    ip: string,
    category: "chat" | "media" | "profile",
  ) => Promise<void>;
  getProfile: (userId: string) => Promise<Record<string, unknown>>;
  getOrCreateConversation: typeof getOrCreateConversation;
  getAccountConversationId: (
    userId: string,
  ) => Promise<{ user: Profile & { id: string }; conversationId: string }>;
  getHistory: (userId: string) => Promise<unknown[]>;
  updateProfile: (
    userId: string,
    profile: { name: string; machineBrand: string; machineModel: string },
  ) => Promise<Profile>;
  getOrCreateUser: typeof getOrCreateUser;
  loadChatHistory: typeof loadChatHistory;
  loadRecentHistory: typeof loadRecentHistory;
  saveMessage: typeof saveMessage;
  runAgent: typeof runAgent;
  runChat: (
    input: {
      conversationId: string;
      text: string;
      imageBase64: string | null;
      imageMimeType: string | null;
      userProfile?: Profile;
      requestId?: string;
      ownerAuthUserId?: string;
    },
  ) => Promise<{ reply: string; videos: unknown[] }>;
  transcribeMalayalamAudio: typeof transcribeMalayalamAudio;
  synthesizeMalayalamSpeech: typeof synthesizeMalayalamSpeech;
  logRequest: typeof logRequest;
};

const defaults: Dependencies = {
  authenticate: authenticateRequest,
  enforceRateLimits,
  getProfile: getProfileUseCase,
  getOrCreateConversation,
  getAccountConversationId,
  getHistory: getHistoryUseCase,
  updateProfile: updateProfileUseCase,
  getOrCreateUser,
  loadChatHistory,
  loadRecentHistory,
  saveMessage,
  runAgent,
  runChat: (input) =>
    runChatUseCase({ saveMessage, loadRecentHistory, runAgent }, input),
  transcribeMalayalamAudio,
  synthesizeMalayalamSpeech,
  logRequest,
};

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }
  const contentLength = Number(req.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new AppError(413, "payload_too_large", "Request body is too large.");
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    throw new AppError(413, "payload_too_large", "Request body is too large.");
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("JSON body must be an object");
    }
    return data as Record<string, unknown>;
  } catch {
    throw new AppError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function requiredProfile(profile: Profile) {
  if (
    !profile.name?.trim() || !profile.machine_brand?.trim() ||
    !profile.machine_model?.trim()
  ) {
    throw new AppError(
      409,
      "profile_incomplete",
      "Complete your name and machine details before chatting.",
    );
  }
  return profile;
}

function errorResponse(req: Request, error: unknown) {
  const appError = toAppError(error);
  const response = jsonResponse(req, {
    error: { code: appError.code, message: appError.message },
  }, appError.status);
  if (appError.status === 429 && appError.retryAfterSeconds) {
    response.headers.set("Retry-After", String(appError.retryAfterSeconds));
  }
  return response;
}

function withRequestId(response: Response, requestId: string) {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createHandler(overrides: Partial<Dependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  return async function handleRequest(req: Request): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const url = new URL(req.url);
    const path = normalizeApiPath(url.pathname);
    let response: Response;
    let identityKind = "anonymous";
    let errorCode: string | undefined;
    let errorType: string | undefined;

    try {
      if (!isAllowedOrigin(req)) {
        throw new AppError(403, "origin_not_allowed", "Origin not allowed.");
      }
      if (req.method === "OPTIONS") {
        return withRequestId(
          new Response("ok", { headers: corsHeaders(req) }),
          requestId,
        );
      }
      if (req.method === "GET" && (path === "/" || path === "/health")) {
        response = jsonResponse(req, {
          ok: true,
          ready: true,
          service: "tailor-assistant-api",
          runtime: "supabase-edge",
        });
      } else {
        const identity = await deps.authenticate(req);
        identityKind = identity.kind;
        const ip = clientIp(req);

        if (req.method === "GET" && path === "/profile") {
          if (identity.kind !== "account") {
            throw new AppError(
              403,
              "forbidden",
              "This endpoint is for signed-in accounts.",
            );
          }
          await deps.enforceRateLimits(
            `user:${identity.userId}`,
            ip,
            "profile",
          );
          const profile = await deps.getProfile(identity.userId) as Profile;
          response = jsonResponse(req, {
            profile: {
              name: profile.name ?? "",
              machineBrand: profile.machine_brand ?? "",
              machineModel: profile.machine_model ?? "",
              preferredLanguage: profile.preferred_language ?? "ml",
            },
          });
        } else if (req.method === "PUT" && path === "/profile") {
          if (identity.kind !== "account") {
            throw new AppError(
              403,
              "forbidden",
              "This endpoint is for signed-in accounts.",
            );
          }
          await deps.enforceRateLimits(
            `user:${identity.userId}`,
            ip,
            "profile",
          );
          const body = await readJson(req);
          const name = asString(body.name);
          const machineBrand = asString(body.machineBrand);
          const machineModel = asString(body.machineModel);
          if (!name || name.length > 100) {
            throw new AppError(
              400,
              "invalid_profile",
              "Name is required and must be at most 100 characters.",
            );
          }
          if (!machineBrand || machineBrand.length > 80) {
            throw new AppError(
              400,
              "invalid_profile",
              "Machine brand is required and must be at most 80 characters.",
            );
          }
          if (!machineModel || machineModel.length > 120) {
            throw new AppError(
              400,
              "invalid_profile",
              "Machine model is required and must be at most 120 characters.",
            );
          }
          if ([name, machineBrand, machineModel].some(hasControlCharacters)) {
            throw new AppError(
              400,
              "invalid_profile",
              "Profile fields must not contain control characters.",
            );
          }
          const profile = await deps.updateProfile(identity.userId, {
            name,
            machineBrand,
            machineModel,
          });
          response = jsonResponse(req, {
            profile: {
              name: profile.name,
              machineBrand: profile.machine_brand,
              machineModel: profile.machine_model,
            },
          });
        } else if (req.method === "GET" && path === "/history") {
          if (identity.kind !== "account") {
            throw new AppError(
              403,
              "forbidden",
              "History is available to signed-in accounts only.",
            );
          }
          await deps.enforceRateLimits(
            `user:${identity.userId}`,
            ip,
            "profile",
          );
          response = jsonResponse(req, {
            messages: await deps.getHistory(identity.userId),
          });
        } else if (req.method === "POST" && path === "/speak") {
          if (identity.kind !== "account") {
            throw new AppError(
              403,
              "forbidden",
              "This endpoint is for signed-in accounts.",
            );
          }
          await deps.enforceRateLimits(
            identity.kind === "account"
              ? `user:${identity.userId}`
              : "whatsapp",
            ip,
            "media",
          );
          const body = await readJson(req);
          const text = asString(body.text);
          if (!text || text.length > 2000) {
            throw new AppError(
              400,
              "invalid_text",
              "Text is required and must be at most 2000 characters.",
            );
          }
          response = jsonResponse(
            req,
            await deps.synthesizeMalayalamSpeech(text),
          );
        } else if (req.method === "POST" && path === "/transcribe") {
          if (identity.kind !== "account") {
            throw new AppError(
              403,
              "forbidden",
              "This endpoint is for signed-in accounts.",
            );
          }
          await deps.enforceRateLimits(
            identity.kind === "account"
              ? `user:${identity.userId}`
              : "whatsapp",
            ip,
            "media",
          );
          const body = await readJson(req);
          const audioBase64 = asString(body.audioBase64);
          if (
            !audioBase64 || audioBase64.length > MAX_AUDIO_BASE64_LENGTH ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64)
          ) {
            throw new AppError(
              400,
              "invalid_audio",
              "Audio data is missing, invalid, or too large.",
            );
          }
          const mimeType = asString(body.mimeType) ?? "audio/webm";
          if (
            !["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg"]
              .includes(mimeType.split(";")[0].toLowerCase())
          ) {
            throw new AppError(
              400,
              "unsupported_audio_type",
              "Unsupported audio format.",
            );
          }
          response = jsonResponse(req, {
            transcript: await deps.transcribeMalayalamAudio({
              audioBase64,
              mimeType,
            }),
          });
        } else if (req.method === "POST" && path === "/chat") {
          const body = await readJson(req);
          const text = asString(body.text);
          const imageBase64 = asString(body.imageBase64) ?? null;
          const imageMimeType = asString(body.imageMimeType) ?? null;
          if (!text || text.length > 4000) {
            throw new AppError(
              400,
              "invalid_text",
              "Message is required and must be at most 4000 characters.",
            );
          }
          if (
            imageBase64 &&
            (imageBase64.length > MAX_IMAGE_BASE64_LENGTH ||
              !/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64))
          ) {
            throw new AppError(
              400,
              "invalid_image",
              "Image data is invalid or too large.",
            );
          }
          if (
            imageMimeType &&
            !["image/jpeg", "image/png", "image/webp"].includes(imageMimeType)
          ) {
            throw new AppError(
              400,
              "unsupported_image_type",
              "Unsupported image format.",
            );
          }

          let conversationId: string;
          let userProfile: Profile | undefined;
          if (identity.kind === "account") {
            if (
              body.whatsappNumber !== undefined || body.webUserId !== undefined
            ) {
              throw new AppError(
                400,
                "invalid_identity",
                "User identity is determined by your signed-in account.",
              );
            }
            await deps.enforceRateLimits(`user:${identity.userId}`, ip, "chat");
            const account = await deps.getAccountConversationId(
              identity.userId,
            );
            userProfile = requiredProfile(account.user);
            conversationId = account.conversationId;
          } else {
            const whatsappNumber = asString(body.whatsappNumber);
            if (!whatsappNumber || whatsappNumber.length > 32) {
              throw new AppError(
                400,
                "invalid_whatsapp_identity",
                "A valid WhatsApp sender is required.",
              );
            }
            await deps.enforceRateLimits(
              `whatsapp:${whatsappNumber}`,
              ip,
              "chat",
            );
            const user = await deps.getOrCreateUser(whatsappNumber, {
              webUserId: null,
            });
            const conversation = await deps.getOrCreateConversation(user.id);
            conversationId = conversation.id;
          }
          const result = await deps.runChat({
            conversationId,
            text,
            imageBase64,
            imageMimeType,
            userProfile,
            requestId,
            ...(identity.kind === "account"
              ? { ownerAuthUserId: identity.userId }
              : {}),
          });
          response = jsonResponse(req, result);
        } else {
          throw new AppError(404, "not_found", "API route not found.");
        }
      }
    } catch (error) {
      const appError = toAppError(error);
      errorCode = appError.code;
      errorType = error instanceof Error ? error.name : "unknown";
      response = errorResponse(req, appError);
    }

    deps.logRequest({
      requestId,
      method: req.method,
      route: path,
      status: response!.status,
      durationMs: Date.now() - startedAt,
      identityKind,
      errorCode,
      errorType,
    });
    return withRequestId(response!, requestId);
  };
}

export const handleRequest = createHandler();
