import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Find or create a user by WhatsApp number.
 * @param {string} whatsappNumber
 * @param {{ name?: string, machineBrand?: string, machineModel?: string }} [profile]
 * @returns {Promise<object>}
 */
export async function getOrCreateUser(whatsappNumber, profile = {}) {
  // TODO: upsert on whatsapp_number, return user row
  void whatsappNumber;
  void profile;
  throw new Error("getOrCreateUser not implemented");
}

/**
 * Find an open conversation or start a new one for the user.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getOrCreateConversation(userId) {
  // TODO: return latest conversation or insert new row
  void userId;
  throw new Error("getOrCreateConversation not implemented");
}

/**
 * Persist a message to the messages table.
 * @param {string} conversationId
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {'image'|'voice'|null} [mediaType]
 * @returns {Promise<object>}
 */
export async function saveMessage(conversationId, role, content, mediaType = null) {
  // TODO: insert into messages
  void conversationId;
  void role;
  void content;
  void mediaType;
  throw new Error("saveMessage not implemented");
}

/**
 * Load recent conversation history for the agent context window.
 * @param {string} conversationId
 * @param {number} [limit=20]
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
export async function loadRecentHistory(conversationId, limit = 20) {
  // TODO: select recent messages ordered by created_at
  void conversationId;
  void limit;
  throw new Error("loadRecentHistory not implemented");
}

/**
 * RAG search over machine manual chunks via match_machine_docs().
 * @param {number[]} queryEmbedding — 768-dim vector from text-embedding-004
 * @param {string} machineModel
 * @param {number} [matchCount=4]
 * @returns {Promise<Array<{ id: number, content: string, similarity: number }>>}
 */
export async function searchMachineDocs(queryEmbedding, machineModel, matchCount = 4) {
  // TODO: call supabase.rpc('match_machine_docs', { ... })
  void queryEmbedding;
  void machineModel;
  void matchCount;
  throw new Error("searchMachineDocs not implemented");
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
