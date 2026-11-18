import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, requireEnv } from "./env.ts";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export async function getOrCreateUser(
  whatsappNumber: string,
  profile: { name?: string | null; webUserId?: string | null } = {},
) {
  const supabase = getSupabase();
  const machineBrand = env("MACHINE_BRAND");
  const machineModel = env("MACHINE_MODEL");
  const { name = null, webUserId = null } = profile;

  if (!whatsappNumber) throw new Error("whatsappNumber is required");
  if (!machineBrand || !machineModel) {
    throw new Error("Missing MACHINE_BRAND or MACHINE_MODEL in environment");
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

export async function getOrCreateAccountUser(authUserId: string) {
  const supabase = getSupabase();
  const { data: existing, error: findError } = await supabase
    .from("users")
    .select(
      "id, auth_user_id, name, machine_brand, machine_model, preferred_language",
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUserId,
      whatsapp_number: null,
      preferred_language: "ml",
    })
    .select(
      "id, auth_user_id, name, machine_brand, machine_model, preferred_language",
    )
    .single();
  if (error) {
    // Concurrent first requests can race on the unique Auth identity.
    const { data: raced, error: racedError } = await supabase
      .from("users")
      .select(
        "id, auth_user_id, name, machine_brand, machine_model, preferred_language",
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (racedError || !raced) throw error;
    return raced;
  }
  return data;
}

export async function updateAccountProfile(
  authUserId: string,
  profile: { name: string; machineBrand: string; machineModel: string },
) {
  const user = await getOrCreateAccountUser(authUserId);
  const { data, error } = await getSupabase()
    .from("users")
    .update({
      name: profile.name,
      machine_brand: profile.machineBrand,
      machine_model: profile.machineModel,
    })
    .eq("id", user.id)
    .eq("auth_user_id", authUserId)
    .select(
      "id, auth_user_id, name, machine_brand, machine_model, preferred_language",
    )
    .single();
  if (error) throw error;
  return data;
}

export async function getOrCreateConversation(userId: string) {
  const supabase = getSupabase();
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

  if (createError) {
    // The unique owner index makes concurrent first chats converge on one row.
    const { data: raced, error: racedError } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (racedError || !raced) throw createError;
    return raced;
  }
  return created;
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  mediaType: "image" | "voice" | null = null,
  metadata: Record<string, unknown> | null = null,
) {
  const supabase = getSupabase();
  const row: Record<string, unknown> = {
    conversation_id: conversationId,
    role,
    content,
    media_type: mediaType,
  };
  if (metadata && Object.keys(metadata).length > 0) {
    row.metadata = metadata;
  }

  const { data, error } = await supabase.from("messages").insert(row).select(
    "*",
  ).single();
  if (error) throw error;
  return data;
}

export async function loadRecentHistory(conversationId: string, limit = 20) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse().map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function loadChatHistory(conversationId: string, limit = 100) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, media_type, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getAccountConversationId(authUserId: string) {
  const user = await getOrCreateAccountUser(authUserId);
  const conversation = await getOrCreateConversation(user.id);
  return { user, conversationId: conversation.id };
}

export async function searchMachineDocs(
  queryEmbedding: number[],
  machineModel: string,
  matchCount = 4,
  ownerAuthUserId?: string,
) {
  const supabase = getSupabase();
  const { data, error } = ownerAuthUserId
    ? await supabase.rpc("match_machine_docs_for_account", {
      query_embedding: queryEmbedding,
      match_machine_model: machineModel,
      match_count: matchCount,
      requesting_user_id: ownerAuthUserId,
    })
    : await supabase.rpc("match_machine_docs", {
      query_embedding: queryEmbedding,
      match_machine_model: machineModel,
      match_count: matchCount,
    });

  if (error) throw error;
  return data ?? [];
}
