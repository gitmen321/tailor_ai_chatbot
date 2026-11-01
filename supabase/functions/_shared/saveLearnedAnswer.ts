import { env } from "./env.ts";
import { getSupabase } from "./db.ts";
import { embedText768 } from "./embedText768.ts";

export async function saveLearnedAnswer({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const machineModel = env("MACHINE_MODEL");
  if (!machineModel) throw new Error("MACHINE_MODEL missing in environment");

  const content = `Q: ${question}\n\nA: ${answer}`;
  const embedding = await embedText768(content);

  const { error } = await getSupabase().from("machine_docs").insert({
    machine_model: machineModel,
    content,
    embedding,
    source: "learned",
  });

  if (error) throw error;
}
