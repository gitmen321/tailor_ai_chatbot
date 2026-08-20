import P from "pino";
import qrcode from "qrcode-terminal";
import {
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage,
  getContentType,
  DisconnectReason,
} from "@whiskeysockets/baileys";

/**
 * Starts Baileys socket and calls `onMessage` for incoming text/image messages.
 *
 * @param {(payload: { sock: any, msg: any, whatsappNumber: string, text: string, imageBase64: string|null }) => void|Promise<void>} onMessage
 */
export async function startWhatsApp(onMessage) {
  const authDir = "auth_info";
  const logger = P({ level: "info" });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      if (shouldReconnect) {
        // Simple reconnect strategy.
        startWhatsApp(onMessage).catch(() => undefined);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages?.[0];
    if (!msg?.message) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    const whatsappNumber = remoteJid.split("@")[0];

    const contentType = getContentType(msg);
    let text = "";
    let imageBase64 = null;

    // Text messages
    if (msg.message.conversation) {
      text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text;
    }

    // Image messages (caption is treated as the "text" part for now)
    if (contentType === "imageMessage") {
      text = msg.message.imageMessage?.caption ?? text;

      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage,
        }
      );

      if (buffer) {
        imageBase64 = buffer.toString("base64");
      }
    }

    if (!text) text = "(image received)"; // Minimal fallback for caption-less images.

    await onMessage({ sock, msg, whatsappNumber, text, imageBase64 });
  });

  return sock;
}

