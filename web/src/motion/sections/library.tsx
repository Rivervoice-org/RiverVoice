"use client";

import { Rover } from "@/motion/bots/rover";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "It can read what is on the shelf."
 *
 * A knowledge base drawn as what it actually is here: your material, held in
 * each language you answer in. One book per language, spine-on, each labelled
 * in its own script — so the shelf says "23 languages" and "your sources" in
 * the same picture, which is the pair this product is actually selling.
 *
 * The agent sits at it and reads, the way a scribe does: a caller asks in
 * Tamil, the Tamil book comes down and opens, and the answer is read off that
 * page. Then someone rings in Odia, the agent looks along the whole shelf, and
 * there is no Odia book — so it says so and does not improvise one. Adding that
 * book is the last beat, because adding it is the thing the page is asking for.
 *
 * The refusal is not a caveat tacked on the end. A shelf is defined by its edge
 * as much as its contents, and an illustration that only showed the hit would
 * be selling a different, worse product.
 */
export type LibraryScript = {
  /** A book per language, spine-on, each named in its own script. */
  shelf: string[];
  /** Rung in a language on the shelf. */
  known: { ask: string; line: string; answer: string };
  /** Rung in one that is not — until you put it there. */
  missing: { spine: string; ask: string; line: string; answer: string; declined: string };
  captions: [string, string, string, string];
};

export const LIBRARY_VIEW = { w: 460, h: 440 };

/* The shelf. */

const SHELF = { y: 64, h: 92, w: 34, gap: 10, rule: 162 };
/** Which book the first caller happens to need. */
const KNOWN = 2;

/** The row is centred on however many books are in it, so the seventh pushes
    the other six outward rather than dropping into a gap left waiting. */
const slotX = (n: number, i: number) =>
  (LIBRARY_VIEW.w - (SHELF.w * n + SHELF.gap * (n - 1))) / 2 + i * (SHELF.w + SHELF.gap);

/** Centre of its body block. The open book sits across the reach of its arms, so
    it is holding the book rather than standing next to it. */
const READER = { x: 230, y: 222, size: 0.92 };
/** Open, held in front of the reader. */
const BOOK = { x: 230, y: 302, w: 176, h: 96 };
/** Left of the open book, and kept narrow enough never to run under it. */
const ASK = { x: 18, y: 288, h: 30, max: 120 };
const SAY = { y: 364, h: 32 };

/* Beats. */

const ASK1 = seconds(0.6);
const PULL = seconds(1.5);
const CARRY = seconds(2.0);
const OPENED = seconds(3.0);
const LIT = seconds(3.3);
const SAY1 = seconds(3.7);
const BACK = seconds(5.4);
const HOME = seconds(6.2);

const ASK2 = seconds(6.6);
/** Along the whole shelf, at the same pace it would take to find one. */
const LOOK = seconds(7.2);
const LOOK_END = seconds(8.4);
const DECLINE = seconds(8.7);

/** The book you add. */
const GIVE = seconds(10.0);
const GIVEN = seconds(11.0);
const PULL2 = seconds(11.3);
const CARRY2 = seconds(11.7);
const OPENED2 = seconds(12.5);
const SAY2 = seconds(12.9);

const RESET = seconds(14.4);

export const LIBRARY_LENGTH = seconds(15.0);
/** Seven books, the new one open, and the call it could not take answered. */
export const LIBRARY_STILL = seconds(13.6);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp = (n: number) => Math.min(1, Math.max(0, n));

const captionText = "fill-current text-[14px] [font-family:var(--font-sans)]";
const spineText = "fill-current text-[13px] [font-family:var(--font-sans)]";
const pageText = "fill-current text-[12px] [font-family:var(--font-sans)]";
const talkText = "fill-current text-[13px] [font-family:var(--font-sans)]";

const S = ({ d, w = 2, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

/** Standing, spine out, with the language written up it the way a spine reads. */
function Spine({
  x,
  y,
  label,
  o = 1,
  lift = 0,
}: {
  x: number;
  y: number;
  label: string;
  o?: number;
  lift?: number;
}) {
  return (
    <g opacity={o} transform={`translate(0 ${-lift})`}>
      <S d={box(x, y, SHELF.w, SHELF.h, 3)} w={1.8} o={0.55} />
      {/* The band across the spine, which is what makes it a book and not a box */}
      <S d={`M${x},${y + 16} h${SHELF.w}`} w={1.4} o={0.3} />
      <S d={`M${x},${y + SHELF.h - 16} h${SHELF.w}`} w={1.4} o={0.3} />

      <text
        transform={`translate(${x + SHELF.w / 2 + 5} ${y + SHELF.h - 24}) rotate(-90)`}
        className={spineText}
        opacity={0.8}
      >
        {label}
      </text>
    </g>
  );
}

/** Open, with one line on the right-hand page worth reading. */
function OpenBook({ line, lit, o }: { line: string; lit: number; o: number }) {
  const { x, y, w, h } = BOOK;
  const half = w / 2;

  /* Drawn as one silhouette rather than two rectangles: the top and bottom
     edges lift over the fold, which is the only thing that says "open". */
  const sheet = [
    `M${x - half},${y - h / 2 + 7}`,
    `Q${x},${y - h / 2 - 5} ${x + half},${y - h / 2 + 7}`,
    `V${y + h / 2 - 7}`,
    `Q${x},${y + h / 2 + 5} ${x - half},${y + h / 2 - 7}`,
    "Z",
  ].join(" ");

  return (
    <g opacity={o}>
      <S d={sheet} w={1.8} o={0.6} />
      <S d={`M${x},${y - h / 2 - 1} V${y + h / 2 + 1}`} w={1.6} o={0.45} />

      {/* The left page is where it has already read */}
      {[0, 1, 2, 3].map((i) => (
        <S
          key={i}
          d={`M${x - half + 14},${y - 26 + i * 15} h${[62, 54, 66, 44][i]}`}
          w={1.8}
          o={0.22}
        />
      ))}

      {/* The right page holds the line the answer comes off */}
      <rect
        x={x + 12}
        y={y - 36}
        width={half - 26}
        height={18}
        rx={3}
        fill="currentColor"
        opacity={lit * 0.1}
      />
      <text x={x + 16} y={y - 23} className={pageText} opacity={0.4 + lit * 0.5}>
        {line}
      </text>

      {[0, 1, 2].map((i) => (
        <S key={i} d={`M${x + 16},${y - 2 + i * 15} h${[58, 48, 62][i]}`} w={1.8} o={0.22} />
      ))}
    </g>
  );
}

/** A bubble with the tail dropped off its bottom-left corner. */
function said(x: number, y: number, w: number, h: number) {
  const b = y + h;
  return `${box(x, y, w, h, 10)} M${x + 16},${b} Q${x + 13},${b + 9} ${x + 23},${b + 8} Q${x + 27},${b + 4} ${x + 27},${b}`;
}

export function Library({ f, script }: { f: number; script: LibraryScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  /* The seventh book. Everything about the row's geometry reads off this, so
     the shelf spreads and the new spine lands in one motion rather than two. */
  const given = out(interpolate(f, [GIVE, GIVEN], [0, 1]));
  const count = 6 + given;

  /* Two trips down from the shelf and back, described the same way. The second
     one deliberately looks like the first: what changed is the shelf. */
  const trip = (pull: number, carry: number, opened: number, back: number, home: number) => {
    const lift =
      clamp(interpolate(f, [pull, carry], [0, 1])) - clamp(interpolate(f, [back, home], [0, 1]));
    const travel =
      out(interpolate(f, [carry, opened], [0, 1])) - out(interpolate(f, [back, home], [0, 1]));
    return { lift, travel };
  };

  const first = trip(PULL, CARRY, OPENED, BACK, HOME);
  const second = trip(PULL2, CARRY2, OPENED2, RESET + seconds(2), RESET + seconds(3));

  // Whichever book is down, and how far along its way it is.
  const down = f >= PULL2 ? second : first;
  const isSecond = f >= PULL2;
  const held = isSecond ? 6 : KNOWN;
  const page = isSecond ? script.missing : script.known;

  const shelfSlot = {
    x: slotX(count, held) + SHELF.w / 2,
    y: SHELF.y + SHELF.h / 2,
  };

  // Closed on the way, open once it has arrived.
  const opened = clamp((down.travel - 0.72) / 0.28);
  const closed = down.travel > 0 ? 1 - opened : 0;

  const carriedX = shelfSlot.x + (BOOK.x - shelfSlot.x) * down.travel;
  const carriedY = shelfSlot.y + (BOOK.y - shelfSlot.y) * down.travel;

  const lit = isSecond
    ? clamp(interpolate(f, [OPENED2 + seconds(0.2), SAY2], [0, 1])) * gone
    : Math.min(
        clamp(interpolate(f, [LIT, LIT + seconds(0.4)], [0, 1])),
        1 - clamp(interpolate(f, [BACK, BACK + seconds(0.3)], [0, 1])),
      ) * gone;

  /* Looking along the shelf for a book that is not there. The sweep runs the
     whole row and off the end, because stopping early would mean it had known. */
  const looking = clamp(interpolate(f, [LOOK, LOOK_END], [0, 1]));
  const lookShow =
    Math.min(
      interpolate(f, [LOOK, LOOK + seconds(0.2)], [0, 1]),
      1 - interpolate(f, [LOOK_END, LOOK_END + seconds(0.3)], [0, 1]),
    ) * gone;

  /* Asked, twice. The second sits exactly where the first did. */
  const asking =
    f >= ASK2
      ? { text: script.missing.ask, show: interpolate(f, [ASK2, ASK2 + seconds(0.3)], [0, 1]) }
      : {
          text: script.known.ask,
          show: Math.min(
            interpolate(f, [ASK1, ASK1 + seconds(0.3)], [0, 1]),
            1 - interpolate(f, [BACK, BACK + seconds(0.3)], [0, 1]),
          ),
        };

  /* Said, three times, in one slot. The declined line is drawn lighter and
     carries no page behind it — that absence is the argument. */
  const saying =
    f >= SAY2
      ? { text: script.missing.answer, from: SAY2, to: RESET, soft: false }
      : f >= DECLINE
        ? { text: script.missing.declined, from: DECLINE, to: GIVE + seconds(0.6), soft: true }
        : { text: script.known.answer, from: SAY1, to: BACK, soft: false };

  const sayShow =
    Math.min(
      interpolate(f, [saying.from, saying.from + seconds(0.35)], [0, 1]),
      1 - interpolate(f, [saying.to, saying.to + seconds(0.3)], [0, 1]),
    ) * gone;

  /* Indic text is not sliced a character at a time anywhere in here: cutting a
     cluster off its matra draws a glyph nobody wrote. It fades in whole. */
  const askWidth = Math.min(ASK.max, 28 + asking.text.length * 7.4);
  const sayWidth = Math.min(260, 30 + saying.text.length * 7.6);

  // Along the shelf while it searches, down to the page while it reads.
  const look = lookShow * (looking - 0.5) * 16 + down.travel * 4;
  const nod =
    Math.sin(Math.PI * clamp(interpolate(f, [saying.from, saying.from + seconds(0.5)], [0, 1]))) *
    (saying.soft ? -2 : 2);

  const capIndex = f >= GIVE ? 3 : f >= ASK2 ? 2 : f >= PULL ? 1 : 0;
  const capAt = f >= GIVE ? GIVE : f >= ASK2 ? ASK2 : f >= PULL ? PULL : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  return (
    <g>
      {/* Caption */}
      <text
        x={LIBRARY_VIEW.w / 2}
        y={34}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>

      {/* Looking along it */}
      {lookShow > 0 ? (
        <rect
          x={slotX(count, 0) - 6 + looking * (slotX(count, 5) - slotX(count, 0) + 12)}
          y={SHELF.y - 6}
          width={SHELF.w + 12}
          height={SHELF.h + 12}
          rx={6}
          fill="currentColor"
          opacity={lookShow * 0.07}
        />
      ) : null}

      {/* The shelf: one book per language, each named in its own hand */}
      {script.shelf.map((label, i) => (
        <Spine
          key={label}
          x={slotX(count, i)}
          y={SHELF.y}
          label={label}
          o={gone * (i === held ? 1 - down.lift : 1)}
          lift={i === held ? down.lift * 12 : 0}
        />
      ))}

      {/* The one you add, sliding in from off the end */}
      {given > 0 ? (
        <Spine
          x={slotX(count, 6) + (1 - given) * 150}
          y={SHELF.y}
          label={script.missing.spine}
          o={gone * given * (1 - second.lift)}
          lift={second.lift * 12}
        />
      ) : null}

      {/* What it all stands on */}
      <S
        d={`M${slotX(count, 0) - 16},${SHELF.rule} H${slotX(count, count - 1) + SHELF.w + 16}`}
        w={2.2}
        o={0.45 * gone}
      />

      {/* Coming down, still shut */}
      {closed > 0 && down.travel > 0.02 ? (
        <g opacity={closed * gone}>
          <S
            d={box(carriedX - SHELF.w / 2, carriedY - SHELF.h / 2, SHELF.w, SHELF.h, 3)}
            w={1.8}
            o={0.55}
          />
          <S
            d={`M${carriedX - SHELF.w / 2},${carriedY - SHELF.h / 2 + 16} h${SHELF.w}`}
            w={1.4}
            o={0.3}
          />
        </g>
      ) : null}

      {/* The reader. Rover turns its head on the neck rather than the whole body
          swivelling, so looking along the shelf reads as looking rather than
          walking. The lenses light while it is the one talking. */}
      <g opacity={gone}>
        <Rover
          x={READER.x}
          y={READER.y + nod}
          size={READER.size}
          look={look}
          // Down at the page while a book is open, level while it searches.
          tilt={down.travel * 5}
          blink={f % 104 < 4 ? 0.1 : 1}
          // Only when it found the answer — not when it had to decline.
          smile={saying.soft ? 0 : lit}
          holding={opened > 0.4}
          lit={sayShow * (saying.soft ? 0.4 : 1)}
        />
      </g>

      {/* Open, in front of it */}
      {opened > 0 ? <OpenBook line={page.line} lit={lit} o={opened * gone} /> : null}

      {/* Rung */}
      {asking.show > 0 ? (
        <g opacity={asking.show * gone} transform={`translate(0 ${(1 - asking.show) * 4})`}>
          <S d={said(ASK.x, ASK.y, askWidth, ASK.h)} w={1.8} o={0.7} />
          <text x={ASK.x + 14} y={ASK.y + 20} className={talkText} opacity={0.75}>
            {asking.text}
          </text>
        </g>
      ) : null}

      {/* Answered — or not, in the same place, so the difference is visible */}
      {sayShow > 0 ? (
        <g opacity={sayShow}>
          <S
            d={box(LIBRARY_VIEW.w / 2 - sayWidth / 2, SAY.y, sayWidth, SAY.h, 10)}
            w={1.8}
            o={saying.soft ? 0.5 : 1}
          />
          <text
            x={LIBRARY_VIEW.w / 2}
            y={SAY.y + 21}
            textAnchor="middle"
            className={talkText}
            opacity={saying.soft ? 0.6 : 0.9}
          >
            {saying.text}
          </text>
        </g>
      ) : null}
    </g>
  );
}
