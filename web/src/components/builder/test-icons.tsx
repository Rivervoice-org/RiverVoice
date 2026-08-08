/**
 * The three ways of testing, drawn as a set.
 *
 * Lucide's Mic, Smartphone and MessagesSquare do not read as siblings at 16px —
 * one is a solid capsule, one is an empty slab, one is two overlapping squares,
 * and side by side in a segmented control they look like three icons borrowed
 * from three places. These share a grid, a stroke and a silhouette weight.
 *
 * On lucide's own 24 viewBox at 1.75, so they sit at the same weight as every
 * other icon in the app rather than needing their own size rules.
 */

type Props = React.ComponentProps<"svg">;

function Icon({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** Voice — a capsule mic in its cradle, open at the bottom so it reads at 16px. */
export function MicIcon(props: Props) {
  return (
    <Icon {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5,11 a6.5,6.5 0 0 0 13,0" />
      <path d="M12,17.5 V21" />
      <path d="M8.5,21 h7" />
    </Icon>
  );
}

/** Phone — a handset, not a device: this tab dials out, it does not hold a screen. */
export function HandsetIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M6,4.5 h3.2 l1.3,3.5 -1.9,1.3 c1,2 2.7,3.7 4.7,4.7 l1.3,-1.9 3.5,1.3 v3.2 c0,0.9 -0.8,1.6 -1.7,1.5 C10.6,17.4 5.6,12.4 4.7,6.2 4.6,5.3 5.1,4.5 6,4.5 Z" />
    </Icon>
  );
}

/** Chat — one bubble with a tail, which is the shape the transcript will use. */
export function BubbleIcon(props: Props) {
  return (
    <Icon {...props}>
      <path d="M18.5,4 H5.5 A2.5,2.5 0 0 0 3,6.5 v6 A2.5,2.5 0 0 0 5.5,15 H7 v4 l4,-4 h7.5 a2.5,2.5 0 0 0 2.5,-2.5 v-6 A2.5,2.5 0 0 0 18.5,4 Z" />
    </Icon>
  );
}
