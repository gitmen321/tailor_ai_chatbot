import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Node <22 has no global WebSocket; ws keeps Railway/Nixpacks boot working.
  realtime: { transport: ws },
});

const MACHINE_BRAND = process.env.MACHINE_BRAND;
const MACHINE_MODEL = process.env.MACHINE_MODEL;

/**
 * Find or create a user by WhatsApp number.
 * @param {string} whatsappNumber
 * @param {{
 *   name?: string,
 *   webUserId?: string | null,
 *   machineBrand?: string,
 *   machineModel?: string
 * }} [profile]
 * @returns {Promise<object>}
 */
export async function getOrCreateUser(whatsappNumber, profile = {}) {
  const {
    name = null,
    webUserId = null,
    machineBrand = MACHINE_BRAND,
    machineModel = MACHINE_MODEL,
  } = profile;

  if (!whatsappNumber) {
    throw new Error("whatsappNumber is required");
  }
  if (!machineBrand || !machineModel) {
    throw new Error(
      "Missing MACHINE_BRAND or MACHINE_MODEL in environment (server/.env)"
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("*")
    .eq("whatsapp_number", whatsappNumber)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("users")
    .insert({
      whatsapp_number: whatsappNumber,
      web_user_id: webUserId,
      name,
      machine_brand: machineBrand,
      machine_model: machineModel,
      preferred_language: "ml",
    })
    .select("*")
    .single();

  if (createError) throw createError;
  return created;
}

/**
 * Find an open conversation or start a new one for the user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getOrCreateConversation(userId) {
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (createError) throw createError;
  return created;
}

/**
 * Persist a message to the messages table.
 * @param {string} conversationId
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {'image'|'voice'|null} [mediaType]
 * @param {Record<string, unknown>} [metadata]
 * @returns {Promise<object>}
 */
export async function saveMessage(
  conversationId,
  role,
  content,
  mediaType = null,
  metadata = null
) {
  const row = {
    conversation_id: conversationId,
    role,
    content,
    media_type: mediaType,
  };
  if (metadata && Object.keys(metadata).length > 0) {
    row.metadata = metadata;
  }

  const { data, error } = await supabase.from("messages").insert(row).select("*").single();

  if (error) throw error;
  return data;
}

/**
 * Load recent conversation history for the agent context window.
 * @param {string} conversationId
 * @param {number} [limit=20]
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
export async function loadRecentHistory(conversationId, limit = 20) {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Supabase ordered desc, but agent prompt expects oldest -> newest.
  return (data ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Load messages for the web chat UI (newest last).
 * @param {string} conversationId
 * @param {number} [limit=100]
 */
export async function loadChatHistory(conversationId, limit = 100) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, media_type, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Resolve web user → conversation id (creates records if missing).
 * @param {string} webUserId
 */
export async function getWebUserConversationId(webUserId) {
  const user = await getOrCreateUser(`web:${webUserId}`, { webUserId });
  const conversation = await getOrCreateConversation(user.id);
  return conversation.id;
}

/**
 * RAG search over machine manual chunks via match_machine_docs().
 * @param {number[]} queryEmbedding — 768-dim vector from text-embedding-004
 * @param {string} machineModel
 * @param {number} [matchCount=4]
 * @returns {Promise<Array<{ id: number, content: string, similarity: number }>>}
 */
export async function searchMachineDocs(queryEmbedding, machineModel, matchCount = 4) {
  const { data, error } = await supabase.rpc("match_machine_docs", {
    query_embedding: queryEmbedding,
    match_machine_model: machineModel,
    match_count: matchCount,
  });

  if (error) throw error;
  return data ?? [];
}

/**
 * Remove all manual chunks for a machine model (idempotent re-ingest).
 * @param {string} machineModel
 * @returns {Promise<number>}
 */
export async function deleteMachineDocsForModel(machineModel) {
  const { error, count } = await supabase
    .from("machine_docs")
    .delete({ count: "exact" })
    .eq("machine_model", machineModel);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Insert manual chunks with embeddings into machine_docs.
 * @param {Array<{ machine_model: string, content: string, embedding: number[] }>} rows
 * @returns {Promise<number>}
 */
export async function insertMachineDocs(rows) {
  const { data, error } = await supabase
    .from("machine_docs")
    .insert(rows)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
