/**
 * Mitra — the one you ask.
 *
 * The Ask page's answerer, drawn as the archetype of being askable: an owl,
 * spectacles and all. Round where Rover is boxy, still where Rover is tracked —
 * a listener, not a worker. The ear tufts end in beads because every bot in
 * this family carries an antenna somewhere, and the three dots on the chest
 * are the family's machine-mark.
 *
 * Unlike the scene bots it is a self-contained svg sized like an avatar, so it
 * drops into HTML flow wherever a Mascot used to sit. `talking` flips the beak
 * between two states on the same clock the DiceBear mouths used.
 */
export function Mitra({
  size = 28,
  talking = false,
  className,
}: {
  size?: number;
  talking?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-label="Rivervoice assistant"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* The body: one round blob, fuller at the bottom, the way an owl sits */}
      <path
        d="M24,5.5 C35,5.5 41.5,13.5 41.5,25 C41.5,35.5 34.5,42.5 24,42.5 C13.5,42.5 6.5,35.5 6.5,25 C6.5,13.5 13,5.5 24,5.5 Z"
        fill="currentColor"
        fillOpacity={0.05}
        strokeWidth={2.3}
      />

      {/* Ear tufts, ending in the family's antenna beads */}
      <path d="M12.5,9.5 C11,6.5 10,4.5 9.5,3" strokeWidth={2.1} />
      <circle cx="9" cy="1.9" r="1.6" strokeWidth={1.8} />
      <path d="M35.5,9.5 C37,6.5 38,4.5 38.5,3" strokeWidth={2.1} />
      <circle cx="39" cy="1.9" r="1.6" strokeWidth={1.8} />

      {/* Spectacles: two rings and a bridge, which is most of the character */}
      <circle cx="16.5" cy="21" r="6.6" strokeWidth={2.2} />
      <circle cx="31.5" cy="21" r="6.6" strokeWidth={2.2} />
      <path d="M23.1,21 H24.9" strokeWidth={2} />
      <circle cx="17.5" cy="21.5" r="2" fill="currentColor" stroke="none" />
      <circle cx="30.5" cy="21.5" r="2" fill="currentColor" stroke="none" />

      {/* The beak. Talking alternates the two states; still shows one. */}
      {talking ? (
        <>
          <path d="M21.8,30 L24,33 L26.2,30" className="animate-mouth-shut" strokeWidth={2.1} />
          <path
            d="M21.8,30 L24,32 L26.2,30 L24,35 Z"
            className="animate-mouth-open"
            strokeWidth={2}
          />
        </>
      ) : (
        <path d="M21.8,30 L24,33 L26.2,30" strokeWidth={2.1} />
      )}

      {/* Folded wings */}
      <path d="M8,24 C7.5,29 9,33.5 12,36.5" strokeWidth={1.7} opacity={0.5} />
      <path d="M40,24 C40.5,29 39,33.5 36,36.5" strokeWidth={1.7} opacity={0.5} />

      {/* The family's machine-mark */}
      {[19.5, 24, 28.5].map((cx) => (
        <circle
          key={cx}
          cx={cx}
          cy="38.5"
          r="0.9"
          fill="currentColor"
          stroke="none"
          opacity={0.5}
        />
      ))}
    </svg>
  );
}
