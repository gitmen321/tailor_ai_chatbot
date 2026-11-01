import { handleRequest } from "../_shared/router.ts";

const port = Number(Deno.env.get("PORT") ?? "");
if (Number.isFinite(port) && port > 0) {
  Deno.serve({ port, hostname: "0.0.0.0" }, handleRequest);
} else {
  Deno.serve(handleRequest);
}
