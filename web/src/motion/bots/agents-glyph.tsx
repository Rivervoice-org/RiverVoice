/**
 * Sevak — the one on the phones. The Agents nav mark.
 *
 * Nine drawings died in this slot before the real bug surfaced: the sidebar
 * renders lucide icons at 16px muted, but the mark went in raw — 18px, full
 * foreground, and strokes drawn for a big grid collapsing to 0.7px hairlines.
 * Every review was of that ghost, not of the drawing.
 *
 * So this one is drawn for 16px and nothing else. Strokes at 5–6 on a 48 grid
 * land at lucide's own ~1.8px when rendered small, and the character keeps
 * only what that size can hold: the round body, the headset cups, two big
 * ring eyes, a smile, the family antenna. The boom, the band and the chest
 * dots do not survive 16px and are not pretended.
 */
export function AgentsGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label="Agents"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* The family antenna */}
      <path d="M27.5,7.2 C28.6,5.4 29.6,4.2 30.6,3.4" strokeWidth="4.6" />
      <circle cx="32.4" cy="2.6" r="2.5" fill="currentColor" stroke="none" />

      {/* The body: one round blob, a worker's build */}
      <path
        d="M24,7.5 C33.8,7.5 40,13.9 40,24.6 C40,35 33.8,41.3 24,41.3 C14.2,41.3 8,35 8,24.6 C8,13.9 14.2,7.5 24,7.5 Z"
        strokeWidth="5.6"
      />

      {/* The headset cups, solid so they read at a glance */}
      <rect x="2.6" y="19" width="7.6" height="11.4" rx="3.8" fill="currentColor" stroke="none" />
      <rect x="37.8" y="19" width="7.6" height="11.4" rx="3.8" fill="currentColor" stroke="none" />

      {/* Two big ring eyes with pupils — the family feature */}
      <circle cx="17.8" cy="22.6" r="5.2" strokeWidth="4.4" />
      <circle cx="30.2" cy="22.6" r="5.2" strokeWidth="4.4" />
      <circle cx="18.6" cy="23.4" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="29.4" cy="23.4" r="2.1" fill="currentColor" stroke="none" />

      {/* Mid-sentence, because it answers for a living */}
      <path d="M19.6,32.6 C21.4,34.6 26.6,34.6 28.4,32.6" strokeWidth="4.6" />
    </svg>
  );
}
