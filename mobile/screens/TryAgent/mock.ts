export type LiveTranscriptEntry = {
  speaker: "caller" | "agent";
  text: string;
  translated: string | null;
};

/**
 * A canned back-and-forth used to preview an in-progress agent config
 * before it's saved. Revealed line by line on a timer to feel live.
 */
export const TRY_AGENT_SCRIPT: LiveTranscriptEntry[] = [
  {
    speaker: "agent",
    text: "Hi, thanks for calling — how can I help you today?",
    translated: null,
  },
  {
    speaker: "caller",
    text: "मुझे अपने ऑर्डर का स्टेटस जानना है।",
    translated: "I'd like to check the status of my order.",
  },
  {
    speaker: "agent",
    text: "Sure, could you share your order number?",
    translated: null,
  },
  {
    speaker: "caller",
    text: "ऑर्डर नंबर 48213 है।",
    translated: "The order number is 48213.",
  },
  {
    speaker: "agent",
    text: "Got it — that order shipped yesterday and should arrive by Thursday.",
    translated: null,
  },
  {
    speaker: "caller",
    text: "बहुत बढ़िया, धन्यवाद!",
    translated: "Great, thank you!",
  },
];
