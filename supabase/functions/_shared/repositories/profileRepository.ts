import type { SupabaseClient } from "@supabase/supabase-js";

const ACCOUNT_PROFILE_COLUMNS =
  "id, auth_user_id, name, machine_brand, machine_model, preferred_language";

export type AccountProfileInput = {
  name: string;
  machineBrand: string;
  machineModel: string;
};

/** Database operations for the profile row owned by one Supabase Auth user. */
export async function getOrCreateAccountProfile(
  supabase: SupabaseClient,
  authUserId: string,
) {
  const { data: existing, error: findError } = await supabase
    .from("users")
    .select(ACCOUNT_PROFILE_COLUMNS)
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
    .select(ACCOUNT_PROFILE_COLUMNS)
    .single();
  if (!error) return data;

  // Concurrent first requests can race on the unique Auth identity.
  const { data: raced, error: racedError } = await supabase
    .from("users")
    .select(ACCOUNT_PROFILE_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (racedError || !raced) throw error;
  return raced;
}

export async function updateAccountProfile(
  supabase: SupabaseClient,
  authUserId: string,
  profile: AccountProfileInput,
) {
  const user = await getOrCreateAccountProfile(supabase, authUserId);
  const { data, error } = await supabase
    .from("users")
    .update({
      name: profile.name,
      machine_brand: profile.machineBrand,
      machine_model: profile.machineModel,
    })
    .eq("id", user.id)
    .eq("auth_user_id", authUserId)
    .select(ACCOUNT_PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}
