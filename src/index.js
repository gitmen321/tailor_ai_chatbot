import "dotenv/config";

/**
 * Tailor Assistant — entry point (stub).
 * WhatsApp connection and LangGraph agent will be wired here later.
 */
async function main() {
  console.log("Tailor Assistant starting…");
  console.log("WhatsApp + agent not connected yet — scaffold only.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
