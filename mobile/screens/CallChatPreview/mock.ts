/**
 * Rows shaped like `call_utterances` in ferry. `caller` is the app user who
 * placed the call; `callee` is the person they dialled.
 */

export type Speaker = "caller" | "callee";
export type Lang = "en" | "hi" | "te" | "ta" | "kn";

export type UtteranceRow = {
  seq: number;
  speaker: Speaker;
  /** What that person actually said, in their own language. */
  originalText: string;
  originalLanguage: Lang;
  /** What the other side heard. Null when no translation was produced. */
  translatedText: string | null;
  translatedLanguage: Lang | null;
  /** Milliseconds from `calls.connectedAt`. */
  offsetMs: number;
};

/** Stands in for the parent `calls` row. */
export const CALL = {
  contactName: "Ramesh Kumar",
  toNumber: "+91 98450 33120",
  agentName: "Front Desk",
  billableSeconds: 38,
};

export const UTTERANCES: UtteranceRow[] = [
  {
    seq: 0,
    speaker: "caller",
    originalText: "नमस्ते, मुझे अपना बिलिंग विवरण चाहिए।",
    originalLanguage: "hi",
    translatedText: "Hello, I need my billing details.",
    translatedLanguage: "en",
    offsetMs: 0,
  },
  {
    seq: 1,
    speaker: "callee",
    originalText: "Sure, I can help. Could you confirm your account number?",
    originalLanguage: "en",
    translatedText: "ज़रूर, मैं मदद कर सकता हूँ। क्या आप अपना खाता नंबर बताएंगे?",
    translatedLanguage: "hi",
    offsetMs: 4200,
  },
  {
    seq: 2,
    speaker: "caller",
    originalText: "हाँ, यह आठ दो चार सात है।",
    originalLanguage: "hi",
    translatedText: "Yes, it is eight two four seven.",
    translatedLanguage: "en",
    offsetMs: 11800,
  },
  {
    seq: 3,
    speaker: "callee",
    originalText: "Thank you. I see a charge of 1,200 rupees on the fifth.",
    originalLanguage: "en",
    translatedText: "धन्यवाद। मुझे पाँच तारीख़ को 1,200 रुपये का शुल्क दिख रहा है।",
    translatedLanguage: "hi",
    offsetMs: 17400,
  },
  {
    seq: 4,
    speaker: "caller",
    originalText: "मुझे लगता है मुझसे ज़्यादा चार्ज किया गया है।",
    originalLanguage: "hi",
    translatedText: "I think I have been overcharged.",
    translatedLanguage: "en",
    offsetMs: 26100,
  },
  {
    seq: 5,
    speaker: "callee",
    originalText: "Let me check that for you right away.",
    originalLanguage: "en",
    translatedText: "मैं अभी आपके लिए यह जाँच करता हूँ।",
    translatedLanguage: "hi",
    offsetMs: 31500,
  },
];
