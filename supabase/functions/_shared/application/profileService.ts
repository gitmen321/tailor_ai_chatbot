import { getOrCreateAccountUser, updateAccountProfile } from "../db.ts";

export const getProfileUseCase = (userId: string) =>
  getOrCreateAccountUser(userId);

export const updateProfileUseCase = (
  userId: string,
  profile: { name: string; machineBrand: string; machineModel: string },
) => updateAccountProfile(userId, profile);
