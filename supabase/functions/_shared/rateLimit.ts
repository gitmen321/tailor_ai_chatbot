import { env } from "./env.ts";
import { AppError } from "./errors.ts";

const SLIDING_WINDOW_SCRIPT = `
local t = redis.call('TIME')
local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local requestId = ARGV[3]
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, 0, tonumber(oldest[2]) + window}
end
redis.call('ZADD', KEYS[1], now, requestId)
redis.call('PEXPIRE', KEYS[1], window)
return {1, limit - count - 1, now + window}
`;

function setting(name: string, fallback: number): number {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function digest(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(
    new Uint8Array(hash),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function incrementLimit(key: string, limit: number, windowMs: number) {
  const url = env("UPSTASH_REDIS_REST_URL");
  const token = env("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) {
    throw new AppError(
      503,
      "rate_limiter_unavailable",
      "Service is temporarily unavailable.",
    );
  }

  try {
    const redisKey = `tailor:${await digest(key)}`;
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([[
        "EVAL",
        SLIDING_WINDOW_SCRIPT,
        "1",
        redisKey,
        String(windowMs),
        String(limit),
        crypto.randomUUID(),
      ]]),
    });
    if (!response.ok) throw new Error("Redis request failed");
    const result = await response.json();
    const values = result?.[0]?.result;
    if (!Array.isArray(values) || values.length < 3) {
      throw new Error("Invalid Redis response");
    }
    const [allowed, , resetAt] = values.map(Number);
    if (allowed !== 1) {
      throw new AppError(
        429,
        "rate_limit_exceeded",
        "Too many requests. Please try again shortly.",
        Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
      );
    }
    return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(
      JSON.stringify({
        event: "rate_limiter_error",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    throw new AppError(
      503,
      "rate_limiter_unavailable",
      "Service is temporarily unavailable.",
    );
  }
}

export async function enforceRateLimits(
  identity: string,
  ipAddress: string,
  category: "chat" | "media" | "profile",
) {
  const userDefaults = { chat: 10, media: 20, profile: 30 };
  const userMax = setting(
    `${category.toUpperCase()}_RATE_LIMIT_PER_MINUTE`,
    userDefaults[category],
  );
  const ipMax = setting("API_IP_RATE_LIMIT_PER_MINUTE", 60);
  await incrementLimit(`${category}:identity:${identity}`, userMax, 60_000);
  await incrementLimit(`${category}:ip:${ipAddress}`, ipMax, 60_000);

  if (category === "chat") {
    await incrementLimit(
      `chat:daily:${identity}`,
      setting("CHAT_USER_DAILY_LIMIT", 100),
      86_400_000,
    );
    await incrementLimit(
      "chat:global:daily",
      setting("CHAT_GLOBAL_DAILY_LIMIT", 1000),
      86_400_000,
    );
  } else if (category === "media") {
    await incrementLimit(
      `media:daily:${identity}`,
      setting("MEDIA_USER_DAILY_LIMIT", 50),
      86_400_000,
    );
    await incrementLimit(
      "media:global:daily",
      setting("MEDIA_GLOBAL_DAILY_LIMIT", 2000),
      86_400_000,
    );
  }
}

export function clientIp(req: Request): string {
  // Supabase's edge proxy supplies this header; do not use request body values for IP keys.
  return req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
