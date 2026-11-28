import { env } from "./env.ts";
import { getSupabase } from "./infrastructure/supabaseClient.ts";
import { embedText768 } from "./embedText768.ts";

export async function saveLearnedAnswer({
  question,
  answer,
  machineModel: requestedMachineModel,
  ownerAuthUserId,
}: {
  question: string;
  answer: string;
  machineModel?: string;
  ownerAuthUserId?: string;
}) {
  const machineModel = requestedMachineModel ?? env("MACHINE_MODEL");
  if (!machineModel) throw new Error("MACHINE_MODEL missing in environment");

  const content = `Q: ${question}\n\nA: ${answer}`;
  const embedding = await embedText768(content);

  const { error } = await getSupabase().from("machine_docs").insert({
    machine_model: machineModel,
    ...(ownerAuthUserId ? { owner_auth_user_id: ownerAuthUserId } : {}),
    content,
    embedding,
    source: "learned",
  });

  if (error) throw error;
}
