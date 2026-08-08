import { Mascot } from "@/mascots";

/**
 * A crowd of agents mid-conversation behind the composer. Each one cycles
 * through lines in different Indian languages, and a radial mask fades the
 * middle out so the field on top stays perfectly legible.
 *
 * Gathered in around the ask rather than pinned to the edges of the section:
 * spread wide they read as page decoration, and on a broad screen the outermost
 * bubbles ran off the side. Two loose arcs, one above the heading and one below
 * the field, with the vertical gap between them left clear for the composer.
 */
const CROWD = [
  {
    seed: "Front Desk",
    offset: 0.0,
    cycle: 11,
    x: "13%",
    y: "16%",
    size: 34,
    delay: "0s",
    lines: ["कल सुबह साढ़े नौ बजे?", "ঠিক আছে, লিখে নিলাম", "సరే, నమోదు చేశాను"],
  },
  {
    seed: "Billing",
    offset: 2.6,
    cycle: 13,
    x: "10%",
    y: "70%",
    size: 30,
    delay: "1.2s",
    lines: ["బిల్లు పంపించాను", "બિલ મોકલી દીધું", "ਬਿੱਲ ਭੇਜ ਦਿੱਤਾ"],
  },
  {
    seed: "Order status",
    offset: 5.1,
    cycle: 12,
    x: "38%",
    y: "7%",
    size: 30,
    delay: "2.1s",
    lines: ["ऑर्डर उद्या पोहोचेल", "ఆర్డర్ రేపు వస్తుంది", "ऑर्डर कल पहुँच जाएगा"],
  },
  {
    seed: "After hours",
    offset: 1.4,
    cycle: 14,
    x: "70%",
    y: "12%",
    size: 32,
    delay: "0.6s",
    lines: ["একটু অপেক্ষা করুন", "ಸ್ವಲ್ಪ ಕಾಯಿರಿ", "थोडा वेळ थांबा"],
  },
  {
    seed: "Renewals",
    offset: 3.9,
    cycle: 12.5,
    x: "79%",
    y: "58%",
    size: 28,
    delay: "1.8s",
    lines: ["ಹೇಳಿ, ಸಹಾಯ ಮಾಡ್ತೀನಿ", "சொல்லுங்க, உதவுறேன்", "बोलिए, मैं मदद करता हूँ"],
  },
  {
    seed: "Kavya",
    offset: 6.2,
    cycle: 13.5,
    x: "63%",
    y: "78%",
    size: 26,
    delay: "2.6s",
    lines: ["நான் பதிவு செய்துவிட்டேன்", "ഞാൻ ബുക്ക് ചെയ്തു", "মিটিং বুক করেছি"],
  },
  {
    seed: "Rohan",
    offset: 0.8,
    cycle: 15,
    x: "43%",
    y: "84%",
    size: 24,
    delay: "3.2s",
    lines: ["ഞാൻ ബന്ധിപ്പിക്കാം", "మిమ్మల్ని కలుపుతాను", "मी तुम्हाला जोडते"],
  },
  {
    seed: "Isla",
    offset: 4.3,
    cycle: 11.5,
    x: "17%",
    y: "81%",
    size: 24,
    delay: "0.9s",
    lines: ["Booked for 9:30", "ਸਭ ਤਿਆਰ ਹੈ", "সব ঠিক আছে"],
  },
];

export function ComposerCrowd() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden select-none md:block"
      /* A tighter hole than before, and a shorter fade out of it. The old mask
         only reached full opacity past the edges of the section, which is why
         the crowd had to sit out there to be seen at all. */
      style={{
        maskImage: "radial-gradient(105% 62% at 50% 46%, transparent 20%, black 46%)",
        WebkitMaskImage: "radial-gradient(105% 62% at 50% 46%, transparent 20%, black 46%)",
      }}
    >
      {CROWD.map((member) => (
        <div
          key={member.seed}
          className="animate-drift absolute flex items-center gap-2 opacity-70"
          style={{ left: member.x, top: member.y, animationDelay: member.delay }}
        >
          <Mascot seed={member.seed} size={member.size} talking talkDelay={member.delay} />

          {/* The lines share one grid cell, so the bubble never resizes */}
          <span className="grid">
            {member.lines.map((line, index) => (
              <span
                key={line}
                className="animate-phrase col-start-1 row-start-1 rounded-full bg-card px-2.5 py-1 text-xs whitespace-nowrap text-foreground/70 opacity-0 shadow-(--shadow-float)"
                style={{
                  animationDuration: `${member.cycle}s`,
                  animationDelay: `${member.offset + (index * member.cycle) / member.lines.length}s`,
                }}
              >
                {line}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
