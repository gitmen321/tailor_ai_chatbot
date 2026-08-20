import { supabase } from "../../db/supabaseClient.js";
import { embedText768 } from "./embedText768.js";

/**
 * Save a newly-learned QA pair into `machine_docs` with source='learned'.
 * This is used after the agent falls back to web_search.
 *
 * @param {{ question: string, answer: string }} params
 */
export async function saveLearnedAnswer({ question, answer }) {
  const machineModel = process.env.MACHINE_MODEL;
  if (!machineModel) throw new Error("MACHINE_MODEL missing in environment");

  const content = `Q: ${question}\n\nA: ${answer}`;
  const embedding = await embedText768(content);

  const { error } = await supabase.from("machine_docs").insert({
    machine_model: machineModel,
    content,
    embedding,
    source: "learned",
  });

  if (error) throw error;
}

