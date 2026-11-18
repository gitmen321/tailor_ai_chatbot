export function logRequest(event: Record<string, unknown>) {
  // Never pass prompts, message bodies, credentials, emails, or phone numbers here.
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "tailor-assistant-api",
    ...event,
  }));
}
