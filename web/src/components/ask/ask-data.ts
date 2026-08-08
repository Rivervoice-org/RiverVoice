export type AskSource = {
  label: string;
  kind: "docs" | "guide" | "page" | "support";
  href?: string;
};

export type AskAnswer = {
  lead: string;
  points?: string[];
  close?: string;
  sources: AskSource[];
};

export type AskPrompt = {
  id: string;
  question: string;
  keywords: string[];
  answer: AskAnswer;
};

export const askGroups = [
  { id: "start", title: "Getting started", prompts: ["go-live", "draft-vs-paused"] },
  { id: "build", title: "Building an agent", prompts: ["languages", "variables"] },
  { id: "billing", title: "Billing and limits", prompts: ["minutes", "hallucinate"] },
] as const;

export const askPrompts: AskPrompt[] = [
  {
    id: "go-live",
    question: "How do I get an agent answering a real phone number?",
    keywords: ["phone number", "go live", "live", "publish", "real number", "connect", "twilio"],
    answer: {
      lead: "Four steps, and only the first two need thinking about.",
      points: [
        "Build the agent — give it a purpose, a voice and its languages. It stays a draft while you do.",
        "Buy or import a number under Phone numbers. Imported numbers keep their carrier; bought ones are provisioned through Twilio.",
        "Point the number at the agent. One number routes to one agent, but an agent can hold several numbers.",
        "Publish. The agent flips to live and takes the next call on that number.",
      ],
      close: "Nothing is charged until a call connects.",
      sources: [
        { label: "Going live", kind: "guide" },
        { label: "Phone numbers", kind: "page" },
        { label: "Agents", kind: "page", href: "/agents" },
      ],
    },
  },
  {
    id: "draft-vs-paused",
    question: "What is the difference between a draft and a paused agent?",
    keywords: ["draft", "paused", "pause", "status", "difference", "live"],
    answer: {
      lead: "A draft has never taken a call. A paused agent has, and has been stopped.",
      points: [
        "Draft — still being built, no number attached, invisible to callers. Editing it costs nothing.",
        "Paused — configured and previously live. Its number stays reserved, calls to it ring out, and unpausing takes effect on the next call.",
        "Live — answering. Edits you save apply to calls that start after the save; a call already in progress finishes on the settings it began with.",
      ],
      sources: [
        { label: "Agent states", kind: "docs" },
        { label: "Agents", kind: "page", href: "/agents" },
      ],
    },
  },
  {
    id: "languages",
    question: "Can one agent speak more than one language?",
    keywords: ["language", "languages", "multilingual", "hindi", "kannada", "tamil", "switch"],
    answer: {
      lead: "Yes. You list the languages an agent is allowed to answer in, and it follows the caller.",
      points: [
        "It detects the language from the caller's first few words and answers in that one, switching mid-call if they do.",
        "The first language in the list is the fallback — what it opens with, and what it falls back to when detection is unsure.",
        "One voice covers every language on the list, so the agent sounds like the same person throughout.",
        "Knowledge base sources are matched per language: a question asked in Tamil is answered from your Tamil sources, not a translation of the English ones.",
      ],
      close: "Adding a language it has no sources for means it can talk, but not look anything up.",
      sources: [
        { label: "Languages and voices", kind: "docs" },
        { label: "Knowledge base", kind: "page", href: "/knowledge" },
      ],
    },
  },
  {
    id: "variables",
    question: "What are input and output variables for?",
    keywords: ["variable", "variables", "input", "output", "context", "placeholder", "extract"],
    answer: {
      lead: "Input variables carry what you already know into the call. Output variables carry what the call learned back out.",
      points: [
        "Input — values like caller_name or clinic_name, written into the agent's instructions as placeholders. Each one takes a fallback for when you have no value to pass.",
        "Marking an input as in context lets the agent say it out loud; leave it off and it can use the value without ever reading it back.",
        "Output — things the agent works out and writes to the call record, like appointment_booked or callback_minutes. You describe each one in a sentence and the agent fills it in.",
        "One output can be marked the goal, which is what the success rate on your analytics is measured against.",
      ],
      sources: [
        { label: "Variables", kind: "docs" },
        { label: "Call records", kind: "docs" },
      ],
    },
  },
  {
    id: "minutes",
    question: "What counts against my minutes?",
    keywords: [
      "minute",
      "minutes",
      "credit",
      "credits",
      "bill",
      "billing",
      "cost",
      "price",
      "charge",
      "plan",
    ],
    answer: {
      lead: "Connected talk time, rounded up to the second, on both inbound and outbound calls.",
      points: [
        "Ringing, voicemail detection before the beep, and calls that never connect are not billed.",
        "A transfer to a human keeps billing until the whole call ends, including the part you handle.",
        "Transcription is metered separately from talk time, on its own included allowance.",
        "Test calls from inside the builder come out of the same pool as real ones.",
      ],
      close: "Both allowances reset on your renewal date rather than the first of the month.",
      sources: [
        { label: "How billing works", kind: "docs" },
        { label: "Pricing", kind: "page" },
      ],
    },
  },
  {
    id: "hallucinate",
    question: "How do I stop it inventing answers?",
    keywords: [
      "hallucinat",
      "invent",
      "made up",
      "making things up",
      "wrong answer",
      "accurate",
      "knowledge",
      "source",
    ],
    answer: {
      lead: "Give it sources and let it say no — the two work together.",
      points: [
        "Attach your policies, price lists and FAQs to the knowledge base. Sources are shared across every agent in the workspace.",
        "Keep the Search the knowledge base tool switched on, or the agent has nothing to read mid-call.",
        "When a question is not covered, the agent says so rather than guessing. Do not write instructions that tell it to always have an answer — that is what overrides the refusal.",
        "Add a transfer path for the questions you know are not in your sources yet.",
      ],
      close:
        "Anything the agent could not answer shows up in your analytics, which is the list of what to add next.",
      sources: [
        { label: "Grounding answers", kind: "guide" },
        { label: "Knowledge base", kind: "page", href: "/knowledge" },
      ],
    },
  },
];

export const askFallback: AskAnswer = {
  lead: "I could not find that in the Rivervoice docs.",
  points: [
    "I can explain how something works — agents, voices, languages, variables, tools, phone numbers, the knowledge base, and billing.",
    "I can walk you through a setup step by step, and tell you which page to do it on.",
    "I do not read your call recordings or customer data, so I cannot answer questions about a particular call.",
  ],
  close: "Try rewording it, or send it to us and a human will pick it up.",
  sources: [
    { label: "Documentation", kind: "docs" },
    { label: "Talk to us", kind: "support" },
  ],
};

export const askRecents = [
  { id: "r1", question: "Can I import a number I already own?", when: "Yesterday" },
  { id: "r2", question: "What does 'detect voicemail' actually do?", when: "Yesterday" },
  { id: "r3", question: "Is there an API for starting calls?", when: "Monday" },
  { id: "r4", question: "Who in my workspace can edit a live agent?", when: "Monday" },
];

export function answerFor(question: string): AskAnswer {
  const text = question.toLowerCase();

  const exact = askPrompts.find((prompt) => prompt.question.toLowerCase() === text);
  if (exact) return exact.answer;

  const matched = askPrompts.find((prompt) =>
    prompt.keywords.some((keyword) => text.includes(keyword)),
  );
  return matched?.answer ?? askFallback;
}
