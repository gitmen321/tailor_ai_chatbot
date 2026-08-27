function machineIdentityPrefix(query) {
  const brand = process.env.MACHINE_BRAND ?? "Sewing Machine";
  const model = process.env.MACHINE_MODEL ?? "";
  const prefix = `${brand} ${model}`.trim();
  return `${prefix} sewing machine tutorial ${query}`.trim();
}

function looksLikeSewingVideo(title) {
  return /sew|stitch|motor|belt|oil|usha|tailor|machine|quick.?stitch|lakshmi|സിലായി|മെഷീൻ|മോട്ടോർ|യൂഷ/i.test(
    title
  );
}

function buildSearchUrl(query) {
  const q = encodeURIComponent(machineIdentityPrefix(query));
  return `https://www.youtube.com/results?search_query=${q}`;
}

function decodeJsonString(value) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n");
}

function fallbackSearchResults(query, reason = "unavailable") {
  const searchUrl = buildSearchUrl(query);
  const snippets = {
    missing_key:
      "യൂട്യൂബ് API key ഇല്ല — ഈ ലിങ്കിൽ ടാപ്പ് ചെയ്ത് വീഡിയോകൾ കാണുക.",
    api_blocked:
      "യൂട്യൂബ് Data API Google Cloud-ൽ പ്രവർത്തനക്ഷമമല്ല — താൽക്കാലികമായി തിരയൽ ലിങ്ക് മാത്രം.",
    no_results: "വീഡിയോ കണ്ടെത്താനായില്ല — ഈ ലിങ്കിൽ തിരയുക.",
    unavailable:
      "വീഡിയോകൾ ലോഡ് ചെയ്യാനായില്ല — ഈ ലിങ്കിൽ ടാപ്പ് ചെയ്ത് തിരയുക.",
  };

  return [
    {
      title: "YouTube-ൽ വീഡിയോകൾ തിരയുക",
      url: searchUrl,
      snippet: snippets[reason] ?? snippets.unavailable,
    },
  ];
}

async function searchYoutubeViaApi(query, apiKey) {
  const finalQuery = machineIdentityPrefix(query);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "4");
  url.searchParams.set("relevanceLanguage", "ml");
  url.searchParams.set("q", finalQuery);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errBody = await response.text();
    console.error(`YouTube API failed (${response.status}): ${errBody.slice(0, 300)}`);
    const blocked =
      response.status === 403 &&
      /blocked|not enabled|accessNotConfigured|forbidden/i.test(errBody);
    return { ok: false, reason: blocked ? "api_blocked" : "api_error" };
  }

  const data = await response.json();
  const items = data.items ?? [];
  if (items.length === 0) {
    return { ok: false, reason: "no_results" };
  }

  const videos = items
    .map((item) => {
      const title = item?.snippet?.title ?? "";
      const videoId = item?.id?.videoId ?? "";
      const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
      const snippet = item?.snippet?.description ?? "";
      return { title, url: videoUrl, snippet };
    })
    .filter((v) => v.url && looksLikeSewingVideo(v.title));

  if (videos.length === 0) {
    return { ok: false, reason: "no_results" };
  }

  return { ok: true, videos };
}

async function searchYoutubeViaTavily(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const finalQuery = `${machineIdentityPrefix(query)} site:youtube.com/watch`;
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: finalQuery,
      search_depth: "basic",
      max_results: 4,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    console.error(`Tavily YouTube search failed (${response.status})`);
    return [];
  }

  const data = await response.json();
  const results = (data.results ?? [])
    .filter((r) => /youtube\.com\/watch/i.test(r.url ?? ""))
    .map((r) => ({
      title: r.title ?? "YouTube വീഡിയോ",
      url: r.url,
      snippet: r.content ?? r.snippet ?? "",
    }));

  return results;
}

/**
 * Fallback: scrape YouTube search results page (no API key needed).
 * Uses the public search page HTML when the YouTube Data API is blocked or unavailable.
 */
async function searchYoutubeViaScrape(query) {
  const finalQuery = encodeURIComponent(machineIdentityPrefix(query));
  const url = `https://www.youtube.com/results?search_query=${finalQuery}&sp=EgIQAQ%253D%253D`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,ml;q=0.8",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    console.error(`YouTube scrape failed (${response.status})`);
    return [];
  }

  const html = await response.text();
  const blocks = html.matchAll(/"videoRenderer":\{[\s\S]*?\}\s*,\s*"trackingParams"/g);
  const seen = new Set();
  const videos = [];

  for (const match of blocks) {
    const block = match[0];
    const videoId = block.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1];
    if (!videoId || seen.has(videoId)) continue;

    const rawTitle =
      block.match(/"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/)?.[1] ||
      block.match(/"title":\{"simpleText":"((?:\\.|[^"\\])*)"/)?.[1];
    if (!rawTitle) continue;

    seen.add(videoId);
    videos.push({
      title: decodeJsonString(rawTitle),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      snippet: "",
    });
    if (videos.length >= 4) break;
  }

  return videos;
}

/**
 * YouTube search: Data API first, then Tavily/scrape fallbacks, then search link.
 */
export async function searchYoutube(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    const apiResult = await searchYoutubeViaApi(query, apiKey);
    if (apiResult.ok) return apiResult.videos;
    if (apiResult.reason === "api_blocked") {
      console.warn(
        "YouTube Data API v3 is not enabled for this key. Enable it in Google Cloud Console → APIs & Services → YouTube Data API v3. Using fallback search."
      );
    }
  }

  const [tavilyResults, scrapedResults] = await Promise.all([
    searchYoutubeViaTavily(query),
    searchYoutubeViaScrape(query),
  ]);

  if (tavilyResults.length > 0) return tavilyResults;
  if (scrapedResults.length > 0) return scrapedResults;

  if (!apiKey) return fallbackSearchResults(query, "missing_key");
  return fallbackSearchResults(query, "api_blocked");
}
