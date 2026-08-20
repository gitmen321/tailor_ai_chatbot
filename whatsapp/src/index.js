import "dotenv/config";
import { startWhatsApp } from "./connection.js";

const SERVER_API_URL = process.env.SERVER_API_URL;
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;

if (!SERVER_API_URL) {
  throw new Error("Missing SERVER_API_URL in whatsapp/.env");
}
if (!API_AUTH_TOKEN) {
  throw new Error("Missing API_AUTH_TOKEN in whatsapp/.env");
}

startWhatsApp(async ({ sock, msg, whatsappNumber, text, imageBase64 }) => {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        whatsappNumber,
        text,
        imageBase64,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Server error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const reply = data.reply ?? "(no reply)";

    await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    await sock.sendMessage(msg.key.remoteJid, { text: "Sorry, error occurred." }, { quoted: msg });
  }
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

