import { getAccountConversationId, loadChatHistory } from "../db.ts";

export async function getHistoryUseCase(userId: string) {
  const { conversationId } = await getAccountConversationId(userId);
  return loadChatHistory(conversationId, 100);
}
