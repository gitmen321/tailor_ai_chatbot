import type { runAgent as runAgentFunction } from "../agent.ts";
import type {
  loadRecentHistory as loadHistoryFunction,
  saveMessage as saveMessageFunction,
} from "../db.ts";
import { logRequest } from "../logger.ts";

type ChatProfile = {
  name: string | null;
  machine_brand: string | null;
  machine_model: string | null;
  preferred_language?: string | null;
};
type ChatDependencies = {
  saveMessage: typeof saveMessageFunction;
  loadRecentHistory: typeof loadHistoryFunction;
  runAgent: typeof runAgentFunction;
};

export async function runChatUseCase(
  deps: ChatDependencies,
  input: {
    conversationId: string;
    text: string;
    imageBase64: string | null;
    imageMimeType: string | null;
    requestId?: string;
    ownerAuthUserId?: string;
    userProfile?: ChatProfile;
  },
) {
  const {
    conversationId,
    text,
    imageBase64,
    imageMimeType,
    requestId,
    ownerAuthUserId,
    userProfile,
  } = input;
  await deps.saveMessage(
    conversationId,
    "user",
    text,
    imageBase64 ? "image" : null,
  );
  const recentHistory = await deps.loadRecentHistory(conversationId, 20);
  const { reply, videos } = await deps.runAgent({
    text,
    recentHistory,
    imageBase64,
    imageMimeType,
    requestId,
    ownerAuthUserId,
    userProfile,
  });
  try {
    await deps.saveMessage(conversationId, "assistant", reply, null, {
      videos: videos ?? [],
    });
  } catch (error) {
    // The generated answer is still useful; persistence trouble must not turn it
    // into a failed chat response. Keep user content out of production logs.
    logRequest({
      event: "assistant_message_save_failed",
      requestId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
  return { reply, videos: videos ?? [] };
}
