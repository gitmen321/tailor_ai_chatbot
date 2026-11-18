import { env } from "./env.ts";
import { AppError } from "./errors.ts";

export type MachineIdentity = {
  machine_brand?: string | null;
  machine_model?: string | null;
};

function machineIdentityPrefix(
  query: string,
  machine?: MachineIdentity,
): string {
  const brand = machine?.machine_brand ?? env("MACHINE_BRAND") ??
    "Sewing Machine";
  const model = machine?.machine_model ?? env("MACHINE_MODEL") ?? "";
  const prefix = `${brand} ${model} industrial sewing machine`.trim();
  return `${prefix} ${query}`.trim();
}

export async function searchWeb(query: string, machine?: MachineIdentity) {
  const apiKey = env("TAVILY_API_KEY");
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: machineIdentityPrefix(query, machine),
      search_depth: "basic",
      max_results: 3,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    throw new AppError(
      502,
      "search_provider_error",
      "Web search is temporarily unavailable.",
    );
  }

  const data = await response.json();
  return (data.results ?? []).map((r: {
    title?: string;
    url?: string;
    content?: string;
    snippet?: string;
  }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? r.snippet ?? "",
  }));
}
