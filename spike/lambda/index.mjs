// Lambda jetable du spike (phase 0). Deux modes, choisis par la variable MODE :
// - "echo"   : répète la question reconstruite et l'intention reçue (test du nom d'appel et de la capture) ;
// - "claude" : appelle Claude et lit la réponse, suivie du temps de réponse.
// Un appel direct avec { "bench": { "question": "…" } } mesure la latence de Claude sans passer par Alexa.
import Anthropic from "@anthropic-ai/sdk";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { PREFIXES } from "./carriers.mjs";

const MODE = process.env.MODE ?? "echo";
const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-5-5";
const MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS ?? 300);
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS ?? 6500);
const THINKING = process.env.CLAUDE_THINKING ?? "disabled"; // "disabled" | "adaptive"
const EFFORT = process.env.CLAUDE_EFFORT ?? "low";
const SKILL_ID = process.env.SKILL_ID;
const KEY_PARAM = process.env.ANTHROPIC_API_KEY_PARAM ?? "/alexa-claude/anthropic-api-key";

const SYSTEM = `Tu es Claude, et tu réponds à voix haute via une enceinte Alexa, en français.
Ta réponse sera lue par une synthèse vocale : l'utilisateur ne voit rien.
Réponds en 2 ou 3 phrases courtes, 60 mots au maximum. Commence directement par la réponse.
Tutoie l'utilisateur. N'utilise aucune mise en forme : pas de listes, de titres, de gras, d'émojis, de liens ni de parenthèses.
La question est une transcription vocale qui peut contenir des erreurs : interprète-la avec bon sens.`;

let coldStart = true;
let client;

async function getClient() {
  if (client) return client;
  const ssm = new SSMClient({});
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: KEY_PARAM, WithDecryption: true }));
  client = new Anthropic({ apiKey: Parameter.Value, timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
}

async function askClaude(question, thinking = THINKING) {
  const c = await getClient();
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    output_config: { effort: EFFORT },
    messages: [{ role: "user", content: question }],
  };
  if (thinking === "disabled") params.thinking = { type: "disabled" };
  const t0 = Date.now();
  const res = await c.messages.create(params);
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return { text, claudeMs: Date.now() - t0, stopReason: res.stop_reason, usage: res.usage };
}

function classifyError(err) {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.RateLimitError) return "rate_limit";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "auth";
  if (err instanceof Anthropic.APIError && err.status === 529) return "overloaded";
  if (err instanceof Anthropic.APIError && err.status === 402) return "credit";
  if (err instanceof Anthropic.APIError) return `api_${err.status}`;
  return "unknown";
}

const escapeSsml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toSpeech = (s) =>
  s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*(?:[-•]|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

function speak(text, { reprompt, end = false } = {}) {
  const ssml = (t) => ({ type: "SSML", ssml: `<speak>${escapeSsml(t)}</speak>` });
  return {
    version: "1.0",
    response: {
      outputSpeech: ssml(text),
      ...(reprompt && !end ? { reprompt: { outputSpeech: ssml(reprompt) } } : {}),
      shouldEndSession: end,
    },
  };
}

const log = (fields) => console.log(JSON.stringify({ coldStart, mode: MODE, ...fields }));

async function handleQuestion(intent, requestId) {
  // Alexa sépare les élisions (« l' imprimerie », « c' est ») : on recolle l'apostrophe au mot suivant.
  const query = intent.slots?.query?.value?.replace(/(\p{L})\s*['’]\s+/gu, "$1'").trim();
  if (!query) {
    log({ event: "empty_query", requestId, intent: intent.name });
    return speak("Je n'ai pas compris la question. Tu peux répéter ?", { reprompt: "Tu peux répéter ?" });
  }
  const prefix = PREFIXES[intent.name] ?? "";
  const question = prefix ? `${prefix} ${query}` : query;

  if (MODE === "echo") {
    // Spike uniquement : on journalise le texte capté pour évaluer la reconnaissance.
    log({ event: "echo", requestId, intent: intent.name, query, question });
    return speak(`J'ai entendu : ${question}. Intention ${intent.name.replace(/Intent$/, "")}.`, {
      reprompt: "Pose une autre question.",
    });
  }

  try {
    const r = await askClaude(question);
    log({ event: "ask", requestId, intent: intent.name, question, claudeMs: r.claudeMs, stopReason: r.stopReason, usage: r.usage });
    const seconds = (r.claudeMs / 1000).toFixed(1).replace(".", ",");
    return speak(`${toSpeech(r.text)} … Réponse en ${seconds} secondes.`, { reprompt: "Autre chose ?" });
  } catch (err) {
    const errorType = classifyError(err);
    log({ event: "error", requestId, intent: intent.name, question, errorType, message: String(err?.message ?? err) });
    if (errorType === "timeout") {
      return speak("Claude met trop de temps à répondre. Essaie une question plus courte.", { reprompt: "Tu peux reformuler ?" });
    }
    return speak(`Erreur ${errorType.replace(/_/g, " ")}.`, { end: true });
  }
}

export async function handler(event) {
  try {
    if (event.bench) {
      const r = await askClaude(event.bench.question, event.bench.thinking ?? THINKING);
      log({ event: "bench", claudeMs: r.claudeMs, stopReason: r.stopReason, usage: r.usage, thinking: event.bench.thinking ?? THINKING });
      return { ...r, coldStart };
    }

    const appId = event.context?.System?.application?.applicationId ?? event.session?.application?.applicationId;
    if (SKILL_ID && appId !== SKILL_ID) throw new Error(`Skill ID inattendu : ${appId}`);

    const { request } = event;
    const requestId = request.requestId;

    switch (request.type) {
      case "LaunchRequest":
        log({ event: "launch", requestId });
        return speak(`Je t'écoute. Mode ${MODE === "echo" ? "écho" : "Claude"}.`, { reprompt: "Pose-moi ta question." });
      case "SessionEndedRequest":
        log({ event: "session_ended", requestId, reason: request.reason, error: request.error });
        return { version: "1.0", response: {} };
      case "IntentRequest": {
        const { intent } = request;
        if (intent.name.startsWith("Ask")) return await handleQuestion(intent, requestId);
        log({ event: intent.name, requestId });
        switch (intent.name) {
          case "AMAZON.StopIntent":
          case "AMAZON.CancelIntent":
          case "AMAZON.NavigateHomeIntent":
            return speak("Avec plaisir.", { end: true });
          case "AMAZON.HelpIntent":
            return speak("Pose une question en commençant par pourquoi, comment ou dis-moi.", { reprompt: "Qu'est-ce que tu veux savoir ?" });
          default:
            return speak("Je n'ai pas compris. Commence ta question par pourquoi, comment ou dis-moi.", { reprompt: "Tu peux répéter ?" });
        }
      }
      default:
        log({ event: "unknown_request", requestType: request.type });
        return speak("Requête non gérée.", { end: true });
    }
  } finally {
    coldStart = false;
  }
}
