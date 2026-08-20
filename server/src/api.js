import express from "express";
import { z } from "zod";
import { Boom } from "@hapi/boom";
import {
  getOrCreateUser,
  getOrCreateConversation,
  saveMessage,
  loadRecentHistory,
  loadChatHistory,
  getWebUserConversationId,
} from "./db/supabaseClient.js";
import { runAgent } from "./agent/graph.js";
import { transcribeMalayalamAudio } from "./transcribe.js";

const router = express.Router();

function authMiddleware(req, _res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const expected = process.env.API_AUTH_TOKEN;

  if (!expected || !token || token !== expected) {
    return next(Boom.unauthorized("Unauthorized"));
  }

  next();
}

router.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

router.get("/api/history", authMiddleware, async (req, res, next) => {
  try {
    const schema = z.object({
      webUserId: z.string().min(1),
    });
    const { webUserId } = schema.parse(req.query);
    const conversationId = await getWebUserConversationId(webUserId);
    const messages = await loadChatHistory(conversationId, 100);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/api/transcribe",
  authMiddleware,
  async (req, res, next) => {
    try {
      const schema = z.object({
        audioBase64: z.string().min(1),
        mimeType: z.string().min(1).optional(),
      });

      const { audioBase64, mimeType } = schema.parse(req.body);
      const transcript = await transcribeMalayalamAudio({
        audioBase64,
        mimeType: mimeType ?? "audio/webm",
      });

      res.json({ transcript });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/api/chat",
  authMiddleware,
  async (req, res, next) => {
    try {
      const schema = z
        .object({
          whatsappNumber: z.string().min(1).optional(),
          webUserId: z.string().min(1).optional(),
          text: z.string().min(1),
          imageBase64: z.string().optional().nullable(),
          imageMimeType: z.string().optional().nullable(),
        })
        .refine((d) => d.whatsappNumber || d.webUserId, {
          message: "whatsappNumber or webUserId is required",
        });

      const body = schema.parse(req.body);

      const { whatsappNumber, webUserId, text, imageBase64, imageMimeType } = body;

      // Both channels share the same users/conversations/messages tables.
      let user;
      if (whatsappNumber) {
        user = await getOrCreateUser(whatsappNumber, { webUserId: null });
      } else {
        // NOTE: whatsapp_number is NOT NULL in the current schema;
        // we store a deterministic placeholder derived from webUserId.
        user = await getOrCreateUser(`web:${webUserId}`, {
          webUserId,
        });
      }

      const conversation = await getOrCreateConversation(user.id);
      const conversationId = conversation.id;

      await saveMessage(conversationId, "user", text, imageBase64 ? "image" : null);

      const recentHistory = await loadRecentHistory(conversationId, 20);
      const { reply } = await runAgent({
        text,
        recentHistory,
        userId: user.id,
        conversationId,
        imageBase64,
        imageMimeType,
      });

      await saveMessage(conversationId, "assistant", reply, null);

      res.json({ reply });
    } catch (err) {
      next(err);
    }
  }
);

export function createApiRouter() {
  return router;
}

