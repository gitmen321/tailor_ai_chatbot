import { searchMachineDocs } from "../db/supabaseClient.js";
import { generateGeminiContent } from "../gemini.js";
import { embedText768 } from "./tools/embedText768.js";
import { searchWeb } from "./tools/searchWeb.js";
import { searchYoutube } from "./tools/searchYoutube.js";
import { saveLearnedAnswer } from "./tools/saveLearnedAnswer.js";
import { userWantsVideos } from "./videoIntent.js";

const MACHINE_BRAND = process.env.MACHINE_BRAND ?? "Usha";
const MACHINE_MODEL = process.env.MACHINE_MODEL ?? "usha-quick-stitch";
const PRIMARY_USER_NAME = process.env.PRIMARY_USER_NAME ?? "Rasiya";

function buildMachineSpecBlock() {
  // Keep this as deterministic “ground truth” for the model.
  // If you change machine identity later, update env + this block accordingly.
  return [
    `Machine brand/model: ${MACHINE_BRAND} ${MACHINE_MODEL}`,
    `Drive type: external motor (foot pedal / knee lifter operated)`,
    `Hook type: full rotary hook (industrial lockstitch)`,
    `Stitch type: straight stitch only (no zig-zag)`,
    `Max stitch length: 4.2 mm`,
    `Max speed: up to 1800 stitches per minute (SPM)`,
    `Motor specs: Lakshmi High Speed Sewing Machine Motor, 1/12 HP, 220/230V AC/DC, 0.75A, 6500 RPM`,
  ].join("\n");
}

function formatHistory(recentHistory) {
  if (!recentHistory || recentHistory.length === 0) return "None";
  return recentHistory
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function buildPrompt({ text, recentHistory, manualDocs, webResults }) {
  const hasYoutubeVideos = (webResults?.youtube?.length ?? 0) > 0;
  const machineSpecBlock = buildMachineSpecBlock();

  const manualContext =
    manualDocs?.length > 0
      ? manualDocs
          .slice(0, 4)
          .map(
            (d, idx) =>
              `Manual chunk ${idx + 1} (similarity=${d.similarity ?? "?"}):\n${d.content}`
          )
          .join("\n\n")
      : "NONE (no matching manual chunks found)";

  const webContext =
    webResults && (webResults.web.length > 0 || webResults.youtube.length > 0)
      ? [
          webResults.web.length
            ? `Web search results:\n${webResults.web
                .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`)
                .join("\n\n")}`
            : null,
          webResults.youtube.length
            ? `YouTube search results:\n${webResults.youtube
                .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`)
                .join("\n\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "NONE (no web/tutorial results)";

  // System prompt must include machine specs so the model can reason even if
  // RAG retrieval returns nothing.
  const systemPrompt = [
    `You are a helpful assistant for a single tailoring sewing machine.`,
    `Primary user: ${PRIMARY_USER_NAME} (Malayalam: റസിയ) — Raaz's mother. This app was built specifically for her.`,
    `You know who she is. Address her warmly by name (റസിയ). Never say you do not know her personally.`,
    `You MUST respond in Malayalam unless the user asks otherwise.`,
    `Machine identity and specs (use these as hard constraints):`,
    machineSpecBlock,
    ``,
    `You get two kinds of context:`,
    `1) Manual chunks from the machine manual (source of truth when present).`,
    `2) Web/tutorial search results only used when the manual has no match.`,
    ``,
    `Rules:`,
    `- If manual context is NONE, you should use web/tutorial context and be clear that it is from web/tutorials.`,
    hasYoutubeVideos
      ? `- YouTube video links WILL appear as clickable cards below your message. You may briefly mention them (e.g. "താഴെ വീഡിയോ ലിങ്ക് ഉണ്ട്") but do NOT paste raw URLs.`
      : `- No YouTube links are attached to this reply. Do NOT say a video button or link appears below.`,
    `- Do NOT tell the user to search YouTube themselves when video links are already found.`,
    `- Give a short helpful Malayalam answer.`,
    `- Keep answers practical and step-by-step.`,
    `- Ask one clarifying question only if required to avoid unsafe/incorrect guidance.`,
  ].join("\n");

  const userPrompt = [
    `User message: ${text}`,
    ``,
    `Recent chat history:`,
    `${formatHistory(recentHistory)}`,
    ``,
    `Manual context:`,
    `${manualContext}`,
    ``,
    `Web/tutorial context:`,
    `${webContext}`,
    ``,
    `Task: Answer the user’s question for this specific machine.`,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

async function embedQuery768(query) {
  return embedText768(query);
}

export async function runAgent({
  text,
  recentHistory,
  userId,
  conversationId,
  imageBase64,
  imageMimeType,
}) {
  void userId;
  void conversationId;

  const machineModel = MACHINE_MODEL;

  const queryEmbedding = await embedQuery768(text);
  const manualDocs = await searchMachineDocs(queryEmbedding, machineModel, 4);

  const wantsVideos = userWantsVideos(text);
  const manualWeak =
    !manualDocs?.length ||
    (manualDocs.length > 0 && (manualDocs[0]?.similarity ?? 0) < 0.55);

  let usedWebSearch = false;
  let webResults = { web: [], youtube: [] };

  const shouldSearchWeb = manualWeak && !wantsVideos;
  const shouldSearchYoutube = wantsVideos || manualWeak;

  if (shouldSearchWeb || shouldSearchYoutube) {
    usedWebSearch = true;
    const [web, youtube] = await Promise.allSettled([
      shouldSearchWeb ? searchWeb(text) : Promise.resolve([]),
      shouldSearchYoutube ? searchYoutube(text) : Promise.resolve([]),
    ]);

    webResults = {
      web: web.status === "fulfilled" ? web.value : [],
      youtube: youtube.status === "fulfilled" ? youtube.value : [],
    };
  }

  const { systemPrompt, userPrompt } = buildPrompt({
    text,
    recentHistory,
    manualDocs,
    webResults,
  });

  const userParts = [{ text: userPrompt }];
  if (imageBase64) {
    userParts.unshift({
      inlineData: {
        mimeType: imageMimeType || "image/jpeg",
        data: imageBase64,
      },
    });
  }

  const reply = await generateGeminiContent({
    systemPrompt,
    userParts,
    maxOutputTokens: 8192,
  });

  if (usedWebSearch) {
    await saveLearnedAnswer({ question: text, answer: reply });
  }

  const videos = webResults.youtube?.length ? webResults.youtube : [];

  return { reply, usedWebSearch, videos };
}

