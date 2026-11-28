/** Thin adapter around Supabase Auth; Supabase owns sessions and JWT handling. */
export function createAuthService(supabase) {
  return Object.freeze({
    getSession: () => supabase.auth.getSession(),
    onAuthStateChange: (callback) => supabase.auth.onAuthStateChange(callback),
    signUpWithEmailPassword: (credentials) =>
      supabase.auth.signUp(credentials),
    signInWithEmailPassword: (credentials) =>
      supabase.auth.signInWithPassword(credentials),
    signInWithGoogle: (redirectTo) =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      }),
    signOut: () => supabase.auth.signOut(),
  });
}
