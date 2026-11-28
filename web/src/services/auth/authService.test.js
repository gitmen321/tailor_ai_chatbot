import assert from "node:assert/strict";
import test from "node:test";
import { createAuthService } from "./authService.js";
import { createTimedFetch, withAuthDeadline } from "./timedFetch.js";

function makeAuthService() {
  const calls = [];
  const auth = {
    getSession: async () => ({ data: { session: { access_token: "test-jwt" } } }),
    onAuthStateChange: (callback) => ({ data: { callback } }),
    signUp: async (credentials) => {
      calls.push(["signUp", credentials]);
      return { data: { session: { access_token: "new-jwt" } }, error: null };
    },
    signInWithPassword: async (credentials) => {
      calls.push(["signInWithPassword", credentials]);
      return { data: { session: { access_token: "session-jwt" } }, error: null };
    },
    signInWithOAuth: async (options) => {
      calls.push(["signInWithOAuth", options]);
      return { data: { url: "https://accounts.google.com" }, error: null };
    },
    signOut: async () => ({ error: null }),
  };
  return { authService: createAuthService({ auth }), calls };
}

test("email registration delegates to Supabase and returns its session", async () => {
  const { authService, calls } = makeAuthService();
  const credentials = {
    email: "demo@example.test",
    password: "demo-password",
    options: { captchaToken: "captcha-token" },
  };
  const result = await authService.signUpWithEmailPassword(credentials);
  assert.equal(result.data.session.access_token, "new-jwt");
  assert.deepEqual(calls, [["signUp", credentials]]);
});

test("email sign-in delegates credentials and preserves the Auth result", async () => {
  const { authService, calls } = makeAuthService();
  const credentials = { email: "demo@example.test", password: "demo-password" };
  const result = await authService.signInWithEmailPassword(credentials);
  assert.equal(result.data.session.access_token, "session-jwt");
  assert.deepEqual(calls, [["signInWithPassword", credentials]]);
});

test("Google remains an optional Supabase OAuth provider", async () => {
  const { authService, calls } = makeAuthService();
  await authService.signInWithGoogle("http://localhost:5173/chat");
  assert.deepEqual(calls, [["signInWithOAuth", {
    provider: "google",
    options: { redirectTo: "http://localhost:5173/chat" },
  }]]);
});

test("session state and sign-out use the same Supabase Auth client", async () => {
  const { authService } = makeAuthService();
  const session = await authService.getSession();
  assert.equal(session.data.session.access_token, "test-jwt");
  const callback = () => {};
  assert.equal(authService.onAuthStateChange(callback).data.callback, callback);
  assert.equal((await authService.signOut()).error, null);
});

test("Auth requests time out instead of leaving the UI waiting forever", async () => {
  let requestSignal;
  const timedFetch = createTimedFetch((_input, init) => {
    requestSignal = init.signal;
    return new Promise((_, reject) => {
      requestSignal.addEventListener("abort", () => reject(requestSignal.reason), { once: true });
    });
  }, 10);

  await assert.rejects(timedFetch("/auth/v1/signup"), { name: "TimeoutError" });
  assert.equal(requestSignal.aborted, true);
});

test("Auth request cancellation is forwarded to the fetch", async () => {
  const parentController = new AbortController();
  let requestSignal;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const timedFetch = createTimedFetch((_input, init) => {
    requestSignal = init.signal;
    markStarted();
    return new Promise((_, reject) => {
      requestSignal.addEventListener("abort", () => reject(requestSignal.reason), { once: true });
    });
  }, 1000);

  const pending = timedFetch("/auth/v1/signup", { signal: parentController.signal });
  await started;
  parentController.abort(new DOMException("Cancelled", "AbortError"));
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requestSignal.aborted, true);
});

test("Auth UI operations have a deadline even before fetch begins", async () => {
  await assert.rejects(
    withAuthDeadline(() => new Promise(() => {}), 10),
    /timed out after 10 ms/,
  );
});
