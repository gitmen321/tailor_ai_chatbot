import { AppError } from "./errors.ts";
import { getSupabase } from "./infrastructure/supabaseClient.ts";
import { env } from "./env.ts";

export type RequestIdentity =
  | { kind: "account"; userId: string }
  | { kind: "whatsapp"; phone: string };

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

export async function authenticateRequest(
  req: Request,
): Promise<RequestIdentity> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AppError(401, "unauthorized", "Sign in to continue.");

  // Keep the existing server-only Baileys credential isolated from PWA auth.
  const whatsappToken = env("WHATSAPP_API_AUTH_TOKEN");
  if (whatsappToken && safeEqual(token, whatsappToken)) {
    return { kind: "whatsapp", phone: "" };
  }

  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data.user) {
    throw new AppError(401, "unauthorized", "Sign in to continue.");
  }
  return { kind: "account", userId: data.user.id };
}
