import { env } from "./env.ts";

function machineIdentityPrefix(query: string): string {
  const brand = env("MACHINE_BRAND") ?? "Sewing Machine";
  const model = env("MACHINE_MODEL") ?? "";
  const prefix = `${brand} ${model} industrial sewing machine`.trim();
  return `${prefix} ${query}`.trim();
}

export async function searchWeb(query: string) {
  const apiKey = env("TAVILY_API_KEY");
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: machineIdentityPrefix(query),
      search_depth: "basic",
      max_results: 3,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Tavily API failed (${response.status}): ${errBody}`);
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
