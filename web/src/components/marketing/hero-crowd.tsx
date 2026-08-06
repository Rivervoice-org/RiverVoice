import { Mascot } from "@/components/dashboard/mascot";

/**
 * The dashboard's crowd scatters agents across the full width, which works
 * behind a composer but not behind a headline: at the edges the speech bubbles
 * ran off the page and got clipped.
 *
 * Here they keep to the two gutters and their bubbles open *inward*, toward the
 * centre, so nothing can leave the viewport. They only appear from xl up, where
 * there is actually a gutter to stand in.
 */
type Member = {
  seed: string;
  /** Distance from this member's own side, so both columns stay off the edge. */
  inset: string;
  top: string;
  size: number;
  delay: string;
  cycle: number;
  offset: number;
  lines: string[];
};

const LEFT: Member[] = [
  {
    seed: "Front desk",
    inset: "2%",
    top: "14%",
    size: 44,
    delay: "0s",
    cycle: 11,
    offset: 0,
    lines: ["कल सुबह साढ़े नौ बजे?", "ঠিক আছে, লিখে নিলাম"],
  },
  {
    seed: "Billing",
    inset: "6%",
    top: "48%",
    size: 40,
    delay: "1.2s",
    cycle: 13,
    offset: 2.6,
    lines: ["బిల్లు పంపించాను", "ਬਿੱਲ ਭੇਜ ਦਿੱਤਾ"],
  },
  {
    seed: "Order status",
    inset: "1%",
    top: "78%",
    size: 38,
    delay: "2.1s",
    cycle: 12,
    offset: 5.1,
    lines: ["ऑर्डर कल पहुँचेगा", "ఆర్డర్ రేపు వస్తుంది"],
  },
];

const RIGHT: Member[] = [
  {
    seed: "After hours",
    inset: "2%",
    top: "10%",
    size: 42,
    delay: "0.6s",
    cycle: 14,
    offset: 1.4,
    lines: ["একটু অপেক্ষা করুন", "ಸ್ವಲ್ಪ ಕಾಯಿರಿ"],
  },
  {
    seed: "Renewals",
    inset: "6%",
    top: "44%",
    size: 40,
    delay: "1.8s",
    cycle: 12.5,
    offset: 3.9,
    lines: ["ಹೇಳಿ, ಸಹಾಯ ಮಾಡ್ತೀನಿ", "சொல்லுங்க, உதவுறேன்"],
  },
  {
    seed: "Kavya",
    inset: "1%",
    top: "74%",
    size: 38,
    delay: "2.6s",
    cycle: 13.5,
    offset: 6.2,
    lines: ["ഞാൻ ബുക്ക് ചെയ്തു", "মিটিং বুক করেছি"],
  },
];

function Bubbles({ member }: { member: Member }) {
  return (
    <span className="grid">
      {member.lines.map((line, index) => (
        <span
          key={line}
          className="animate-phrase col-start-1 row-start-1 rounded-full bg-card px-3 py-1.5 text-[13px] whitespace-nowrap text-foreground/70 opacity-0 shadow-(--shadow-float)"
          style={{
            animationDuration: `${member.cycle}s`,
            animationDelay: `${member.offset + (index * member.cycle) / member.lines.length}s`,
          }}
        >
          {line}
        </span>
      ))}
    </span>
  );
}

export function HeroCrowd() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none xl:block">
      {LEFT.map((member) => (
        <div
          key={member.seed}
          className="animate-drift absolute flex items-center gap-2.5"
          style={{ left: member.inset, top: member.top, animationDelay: member.delay }}
        >
          <Mascot seed={member.seed} size={member.size} talking talkDelay={member.delay} />
          <Bubbles member={member} />
        </div>
      ))}

      {/* Mirrored: the bubble sits before the mascot so it grows toward the centre */}
      {RIGHT.map((member) => (
        <div
          key={member.seed}
          className="animate-drift absolute flex flex-row-reverse items-center gap-2.5"
          style={{ right: member.inset, top: member.top, animationDelay: member.delay }}
        >
          <Mascot seed={member.seed} size={member.size} talking talkDelay={member.delay} />
          <Bubbles member={member} />
        </div>
      ))}
    </div>
  );
}
