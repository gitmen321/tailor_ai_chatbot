import { getSupabase } from "../infrastructure/supabaseClient.ts";
import {
  getOrCreateAccountProfile,
  updateAccountProfile,
  type AccountProfileInput,
} from "../repositories/profileRepository.ts";

export const getProfileUseCase = (userId: string) =>
  getOrCreateAccountProfile(getSupabase(), userId);

export const updateProfileUseCase = (
  userId: string,
  profile: AccountProfileInput,
) => updateAccountProfile(getSupabase(), userId, profile);
