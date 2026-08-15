/**
 * Mock per-minute rates, standing in for a billing service that does not
 * exist yet. Keyed by provider + model so the breakdown moves the moment
 * someone changes a select in Settings — that coupling is the point of the
 * page. `sell` is what the caller is billed; `cost` is what the vendor
 * actually invoices Rivervoice for the same minute.
 */

export type SegmentKey = "telephony" | "stt" | "llm" | "tts";

export type Rate = {
  vendor: string;
  model?: string;
  /** ₹ per minute. */
  sell: number;
  cost: number;
};

const FALLBACK: Rate = { vendor: "Unknown", sell: 0.5, cost: 0.35 };

function lookup(table: Record<string, Record<string, Rate>>, provider: string, model: string) {
  const byModel = table[provider];
  if (!byModel) return { ...FALLBACK, vendor: provider };
  return byModel[model] ?? byModel["*"] ?? { ...FALLBACK, vendor: provider };
}

const TTS_RATES: Record<string, Record<string, Rate>> = {
  Sarvam: {
    "bulbul v2": { vendor: "Sarvam", model: "bulbul v2", sell: 0.48, cost: 0.3 },
    "bulbul v1": { vendor: "Sarvam", model: "bulbul v1", sell: 0.35, cost: 0.22 },
  },
  ElevenLabs: { "*": { vendor: "ElevenLabs", sell: 2.1, cost: 1.65 } },
  OpenAI: { "*": { vendor: "OpenAI", sell: 1.35, cost: 1.05 } },
};

const STT_RATES: Record<string, Record<string, Rate>> = {
  Sarvam: {
    "saarika v2": { vendor: "Sarvam", model: "saarika v2", sell: 0.4, cost: 0.26 },
    "saarika v1": { vendor: "Sarvam", model: "saarika v1", sell: 0.3, cost: 0.19 },
  },
  OpenAI: { "*": { vendor: "OpenAI", sell: 0.95, cost: 0.72 } },
  AssemblyAI: { "*": { vendor: "AssemblyAI", sell: 0.78, cost: 0.58 } },
  Groq: { "*": { vendor: "Groq", sell: 0.42, cost: 0.28 } },
};

/** Blended in + out token cost for a typical turn, folded into ₹/minute. */
const LLM_RATES: Record<string, Record<string, Rate>> = {
  Anthropic: {
    "Claude Haiku 4.5": { vendor: "Anthropic", model: "Claude Haiku 4.5", sell: 0.22, cost: 0.14 },
    "Claude Sonnet 5": { vendor: "Anthropic", model: "Claude Sonnet 5", sell: 0.75, cost: 0.52 },
    "Claude Opus 5": { vendor: "Anthropic", model: "Claude Opus 5", sell: 2.4, cost: 1.7 },
  },
  OpenAI: { "*": { vendor: "OpenAI", sell: 0.6, cost: 0.42 } },
  Google: { "*": { vendor: "Google", sell: 0.5, cost: 0.34 } },
};

/** One line, since every agent calls out over the same carrier today. */
const TELEPHONY_RATE: Rate = { vendor: "Twilio", sell: 0.85, cost: 0.62 };

export type SegmentCost = {
  key: SegmentKey;
  label: string;
  vendor: string;
  model?: string;
  ratePerMin: number;
  costPerMin: number;
  sell: number;
  cost: number;
  margin: number;
};

export function computeSegments(
  agent: {
    ttsProvider: string;
    ttsModel: string;
    sttProvider: string;
    sttModel: string;
    llmProvider: string;
    llmModel: string;
  },
  minutes: number,
): SegmentCost[] {
  const rates: { key: SegmentKey; label: string; rate: Rate }[] = [
    { key: "telephony", label: "Telephony", rate: TELEPHONY_RATE },
    {
      key: "stt",
      label: "Speech to text",
      rate: lookup(STT_RATES, agent.sttProvider, agent.sttModel),
    },
    { key: "llm", label: "Reasoning", rate: lookup(LLM_RATES, agent.llmProvider, agent.llmModel) },
    {
      key: "tts",
      label: "Text to speech",
      rate: lookup(TTS_RATES, agent.ttsProvider, agent.ttsModel),
    },
  ];

  return rates.map(({ key, label, rate }) => {
    const sell = rate.sell * minutes;
    const cost = rate.cost * minutes;
    return {
      key,
      label,
      vendor: rate.vendor,
      model: rate.model,
      ratePerMin: rate.sell,
      costPerMin: rate.cost,
      sell,
      cost,
      margin: sell - cost,
    };
  });
}

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
