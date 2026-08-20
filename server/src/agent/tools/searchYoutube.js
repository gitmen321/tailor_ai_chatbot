function machineIdentityPrefix(query) {
  const brand = process.env.MACHINE_BRAND ?? "Sewing Machine";
  const model = process.env.MACHINE_MODEL ?? "";
  const prefix = `${brand} ${model} industrial sewing machine`.trim();
  return `${prefix} ${query}`.trim();
}

/**
 * YouTube search via YouTube Data API.
 * machine identity is prepended in this tool (not left to the LLM).
 */
export async function searchYoutube(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const finalQuery = machineIdentityPrefix(query);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "3");
  url.searchParams.set("q", finalQuery);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `YouTube API failed (${response.status}): ${errBody.slice(0, 300)}`
    );
  }

  const data = await response.json();
  const items = data.items ?? [];

  return items.map((item) => {
    const title = item?.snippet?.title ?? "";
    const videoId = item?.id?.videoId ?? "";
    const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
    const snippet = item?.snippet?.description ?? "";
    return { title, url, snippet };
  });
}

