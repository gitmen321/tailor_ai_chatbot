import { corsHeaders } from "./cors.ts";

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(
  req: Request,
  status: number,
  message: string,
): Response {
  return jsonResponse(req, { error: message }, status);
}
