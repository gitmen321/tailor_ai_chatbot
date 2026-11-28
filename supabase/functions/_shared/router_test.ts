// deno-lint-ignore-file require-await
import { assertEquals, assertStringIncludes } from "@std/assert";
import { AppError } from "./errors.ts";
import { enforceRateLimits } from "./rateLimit.ts";
import { createHandler } from "./router.ts";
import { runChatUseCase } from "./application/chatService.ts";
import { saveLearnedAnswerBestEffort } from "./agent.ts";
import { requirePrivilegedSupabaseKey } from "./serverKey.ts";

const completeProfile = {
  id: "db-user-1",
  name: "Asha",
  machine_brand: "Usha",
  machine_model: "Quick Stitch",
  preferred_language: "ml",
};

Deno.test("server Supabase key accepts only secret or service-role keys", () => {
  const payload = btoa(JSON.stringify({ role: "service_role" }));
  const serviceRoleJwt = `header.${payload}.signature`;
  assertEquals(requirePrivilegedSupabaseKey(serviceRoleJwt), serviceRoleJwt);
  assertEquals(
    requirePrivilegedSupabaseKey("sb_secret_example"),
    "sb_secret_example",
  );
  for (
    const key of [
      undefined,
      "sb_publishable_example",
      `header.${btoa(JSON.stringify({ role: "anon" }))}.signature`,
    ]
  ) {
    try {
      requirePrivilegedSupabaseKey(key);
      throw new Error("Expected a non-privileged key to be rejected");
    } catch (error) {
      assertEquals(error instanceof AppError, true);
      assertEquals((error as AppError).status, 503);
    }
  }
});

function makeHandler(overrides: Record<string, unknown> = {}) {
  return createHandler({
    authenticate: async () => ({ kind: "account", userId: "auth-user-1" }),
    enforceRateLimits: async () => {},
    getProfile: async () => completeProfile,
    getAccountConversationId: async () => ({
      user: completeProfile,
      conversationId: "conversation-1",
    }),
    getHistory: async () => [],
    updateProfile: async (
      _userId: string,
      profile: { name: string; machineBrand: string; machineModel: string },
    ) => ({
      name: profile.name,
      machine_brand: profile.machineBrand,
      machine_model: profile.machineModel,
    }),
    getOrCreateUser: async () => ({ id: "db-user-1" }),
    getOrCreateConversation: async () => ({ id: "conversation-1" }),
    loadChatHistory: async () => [],
    loadRecentHistory: async () => [],
    saveMessage: async () => ({}),
    runAgent: async () => ({ reply: "reply", videos: [] }),
    runChat: async () => ({ reply: "പറയൂ, ഞാൻ സഹായിക്കാം.", videos: [] }),
    transcribeMalayalamAudio: async () => "വോയ്സ് ടെസ്റ്റ്",
    synthesizeMalayalamSpeech: async () => ({ audioBase64: "YQ==" }),
    logRequest: () => {},
    ...overrides,
  } as never);
}

async function request(
  handler: (req: Request) => Promise<Response>,
  path: string,
  method = "GET",
  body?: unknown,
) {
  return handler(
    new Request(`https://api.example.test/api${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

Deno.test("health is public and returns a request correlation id", async () => {
  const response = await request(
    createHandler({
      authenticate: async () => {
        throw new Error("must not authenticate");
      },
    }),
    "/health",
  );
  assertEquals(response.status, 200);
  assertEquals(Boolean(response.headers.get("X-Request-ID")), true);
  assertEquals((await response.json()).ok, true);
});

Deno.test("protected routes reject an invalid Auth identity", async () => {
  const handler = makeHandler({
    authenticate: async () => {
      throw new AppError(401, "unauthorized", "Sign in to continue.");
    },
  });
  const response = await request(handler, "/profile");
  assertEquals(response.status, 401);
  assertEquals((await response.json()).error.code, "unauthorized");
});

Deno.test("profile is scoped to the authenticated account", async () => {
  let seenId = "";
  const handler = makeHandler({
    getProfile: async (id: string) => {
      seenId = id;
      return completeProfile;
    },
  });
  const response = await request(handler, "/profile");
  assertEquals(response.status, 200);
  assertEquals(seenId, "auth-user-1");
  assertEquals((await response.json()).profile.machineModel, "Quick Stitch");
});

Deno.test("profile update validates required account and machine fields", async () => {
  const response = await request(makeHandler(), "/profile", "PUT", {
    name: "Asha",
  });
  assertEquals(response.status, 400);
  assertEquals((await response.json()).error.code, "invalid_profile");
});

Deno.test("profile update saves only the authenticated account profile", async () => {
  let updatedId = "";
  const handler = makeHandler({
    updateProfile: async (
      id: string,
      fields: { name: string; machineBrand: string; machineModel: string },
    ) => {
      updatedId = id;
      return {
        name: fields.name,
        machine_brand: fields.machineBrand,
        machine_model: fields.machineModel,
      };
    },
  });
  const response = await request(handler, "/profile", "PUT", {
    name: "Asha",
    machineBrand: "Usha",
    machineModel: "Stitch Pro",
  });
  assertEquals(response.status, 200);
  assertEquals(updatedId, "auth-user-1");
  assertEquals((await response.json()).profile.machineModel, "Stitch Pro");
});

Deno.test("chat blocks incomplete profiles before invoking the model", async () => {
  let modelCalled = false;
  const handler = makeHandler({
    getAccountConversationId: async () => ({
      user: { ...completeProfile, machine_model: null },
      conversationId: "conversation-1",
    }),
    runChat: async () => {
      modelCalled = true;
      return { reply: "", videos: [] };
    },
  });
  const response = await request(handler, "/chat", "POST", { text: "Help me" });
  assertEquals(response.status, 409);
  assertEquals(modelCalled, false);
});

Deno.test("chat returns the account-scoped agent reply", async () => {
  let chatInput: Record<string, unknown> | undefined;
  const handler = makeHandler({
    runChat: async (input: Record<string, unknown>) => {
      chatInput = input;
      return { reply: "സ്വാഗതം", videos: [] };
    },
  });
  const response = await request(handler, "/chat", "POST", { text: "Hello" });
  assertEquals(response.status, 200);
  assertEquals((await response.json()).reply, "സ്വാഗതം");
  assertEquals(chatInput?.conversationId, "conversation-1");
  assertEquals((chatInput?.userProfile as { name: string }).name, "Asha");
});

Deno.test("chat rate limit stops the model request", async () => {
  let modelCalled = false;
  const handler = makeHandler({
    enforceRateLimits: async () => {
      throw new AppError(429, "rate_limit_exceeded", "Too many requests.", 45);
    },
    runChat: async () => {
      modelCalled = true;
      return { reply: "", videos: [] };
    },
  });
  const response = await request(handler, "/chat", "POST", { text: "Hello" });
  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "45");
  assertEquals(modelCalled, false);
});

Deno.test("rate limiter outage fails closed before paid chat work", async () => {
  let modelCalled = false;
  const handler = makeHandler({
    enforceRateLimits: async () => {
      throw new AppError(
        503,
        "rate_limiter_unavailable",
        "Service unavailable.",
      );
    },
    runChat: async () => {
      modelCalled = true;
      return { reply: "", videos: [] };
    },
  });
  const response = await request(handler, "/chat", "POST", { text: "Hello" });
  assertEquals(response.status, 503);
  assertEquals(modelCalled, false);
});

Deno.test("Redis outage fails closed in production and uses bounded limits only in local dev", async () => {
  const previous = {
    local: Deno.env.get("LOCAL_DEV_MODE"),
    url: Deno.env.get("UPSTASH_REDIS_REST_URL"),
    token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN"),
    chatLimit: Deno.env.get("CHAT_RATE_LIMIT_PER_MINUTE"),
  };
  Deno.env.delete("LOCAL_DEV_MODE");
  Deno.env.delete("UPSTASH_REDIS_REST_URL");
  Deno.env.delete("UPSTASH_REDIS_REST_TOKEN");
  try {
    let productionError: unknown;
    try {
      await enforceRateLimits(
        `production-limiter-test:${crypto.randomUUID()}`,
        "127.0.0.1",
        "chat",
      );
    } catch (error) {
      productionError = error;
    }
    assertEquals(productionError instanceof AppError, true);
    assertEquals((productionError as AppError).status, 503);

    Deno.env.set("LOCAL_DEV_MODE", "true");
    Deno.env.set("CHAT_RATE_LIMIT_PER_MINUTE", "2");
    const identity = `local-fallback-test:${crypto.randomUUID()}`;
    await enforceRateLimits(identity, "127.0.0.1", "chat");
    await enforceRateLimits(identity, "127.0.0.1", "chat");
    let caught: unknown;
    try {
      await enforceRateLimits(identity, "127.0.0.1", "chat");
    } catch (error) {
      caught = error;
    }
    assertEquals(caught instanceof AppError, true);
    assertEquals((caught as AppError).status, 429);
  } finally {
    previous.local === undefined
      ? Deno.env.delete("LOCAL_DEV_MODE")
      : Deno.env.set("LOCAL_DEV_MODE", previous.local);
    previous.url === undefined
      ? Deno.env.delete("UPSTASH_REDIS_REST_URL")
      : Deno.env.set("UPSTASH_REDIS_REST_URL", previous.url);
    previous.token === undefined
      ? Deno.env.delete("UPSTASH_REDIS_REST_TOKEN")
      : Deno.env.set("UPSTASH_REDIS_REST_TOKEN", previous.token);
    previous.chatLimit === undefined
      ? Deno.env.delete("CHAT_RATE_LIMIT_PER_MINUTE")
      : Deno.env.set("CHAT_RATE_LIMIT_PER_MINUTE", previous.chatLimit);
  }
});

Deno.test("history does not accept a client-selected user id", async () => {
  let received = false;
  const handler = makeHandler({
    getHistory: async (id: string) => {
      received = id === "auth-user-1";
      return [];
    },
  });
  const response = await request(handler, "/history?webUserId=someone-else");
  assertEquals(response.status, 200);
  assertEquals(received, true);
});

Deno.test("transcription validates audio format and calls the speech adapter", async () => {
  const invalid = await request(makeHandler(), "/transcribe", "POST", {
    audioBase64: "!",
  });
  assertEquals(invalid.status, 400);
  const valid = await request(makeHandler(), "/transcribe", "POST", {
    audioBase64: "YQ==",
    mimeType: "audio/webm",
  });
  assertEquals(valid.status, 200);
  assertEquals((await valid.json()).transcript, "വോയ്സ് ടെസ്റ്റ്");
});

Deno.test("speech endpoint validates and returns provider output", async () => {
  const invalid = await request(makeHandler(), "/speak", "POST", { text: "" });
  assertEquals(invalid.status, 400);
  const valid = await request(makeHandler(), "/speak", "POST", {
    text: "നമസ്കാരം",
  });
  assertEquals(valid.status, 200);
  assertEquals((await valid.json()).audioBase64, "YQ==");
});

Deno.test("unexpected backend exceptions return a safe error", async () => {
  const handler = makeHandler({
    getProfile: async () => {
      throw new Error("sensitive database detail");
    },
  });
  const response = await request(handler, "/profile");
  assertEquals(response.status, 500);
  assertStringIncludes(await response.text(), "internal_error");
});

Deno.test("chat use case stores user input, generates a response, then stores assistant output", async () => {
  const sequence: string[] = [];
  const result = await runChatUseCase({
    saveMessage: async (_conversationId, role) => {
      sequence.push(`save:${role}`);
      return {};
    },
    loadRecentHistory: async () => {
      sequence.push("history");
      return [];
    },
    runAgent: async () => {
      sequence.push("agent");
      return { reply: "answer", usedWebSearch: false, videos: [] };
    },
  }, {
    conversationId: "c1",
    text: "question",
    imageBase64: null,
    imageMimeType: null,
    userProfile: completeProfile,
  });
  assertEquals(sequence, ["save:user", "history", "agent", "save:assistant"]);
  assertEquals(result.reply, "answer");
});

Deno.test("chat returns generated reply when assistant-message persistence fails", async () => {
  const savedRoles: string[] = [];
  const result = await runChatUseCase({
    saveMessage: async (_conversationId, role) => {
      savedRoles.push(role);
      if (role === "assistant") throw new Error("database unavailable");
      return {};
    },
    loadRecentHistory: async () => [],
    runAgent: async () => ({
      reply: "The generated answer",
      usedWebSearch: false,
      videos: [],
    }),
  }, {
    conversationId: "c1",
    text: "question",
    imageBase64: null,
    imageMimeType: null,
  });
  assertEquals(result.reply, "The generated answer");
  assertEquals(savedRoles, ["user", "assistant"]);
});

Deno.test("learned-answer persistence failure is best-effort", async () => {
  const saved = await saveLearnedAnswerBestEffort({
    question: "q",
    answer: "already generated",
  }, async () => {
    throw new Error("embedding quota exceeded");
  });
  assertEquals(saved, false);
});

Deno.test("100 concurrent signed-in chats keep each account context isolated", async () => {
  const handler = makeHandler({
    authenticate: async (req: Request) => ({
      kind: "account",
      userId: req.headers.get("x-test-user") ?? "missing",
    }),
    getAccountConversationId: async (id: string) => ({
      user: { ...completeProfile, id: `db:${id}`, name: id },
      conversationId: `conversation:${id}`,
    }),
    runChat: async (
      input: { conversationId: string; userProfile?: { name: string | null } },
    ) => ({
      reply: `${input.userProfile?.name}:${input.conversationId}`,
      videos: [],
    }),
  });
  const responses = await Promise.all(
    Array.from({ length: 100 }, (_, index) => {
      const userId = `user-${index}`;
      return handler(
        new Request("https://api.example.test/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-test-user": userId,
          },
          body: JSON.stringify({ text: "Hello" }),
        }),
      ).then(async (response) => ({
        status: response.status,
        body: await response.json(),
        userId,
      }));
    }),
  );
  assertEquals(responses.every((result) => result.status === 200), true);
  assertEquals(
    responses.every((result) =>
      result.body.reply === `${result.userId}:conversation:${result.userId}`
    ),
    true,
  );
});
