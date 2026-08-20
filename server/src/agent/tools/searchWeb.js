function machineIdentityPrefix(query) {
  const brand = process.env.MACHINE_BRAND ?? "Sewing Machine";
  const model = process.env.MACHINE_MODEL ?? "";
  const prefix = `${brand} ${model} industrial sewing machine`.trim();
  return `${prefix} ${query}`.trim();
}

/**
 * Web search via Tavily.
 * Returns snippets/URLs that we can include in the final prompt.
 *
 * Note: machine identity prefix is added in this tool (not left to the LLM).
 */
export async function searchWeb(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const finalQuery = machineIdentityPrefix(query);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: finalQuery,
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
  const results = data.results ?? [];

  return results.map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? r.snippet ?? "",
  }));
}

