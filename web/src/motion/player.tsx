"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { FPS, formatTime, seconds } from "@/motion/timeline";
import { totalFrames, type Scene } from "@/motion/types";
import { cn } from "@/lib/utils";

const REDUCED = "(prefers-reduced-motion: reduce)";

const watchMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/* Subscribed to rather than read in an effect, so the first client render
   already knows the answer and nothing has to be corrected afterwards. The
   server has no media queries, and assuming full motion there matches what
   every other animation on the page does. */
const useReducedMotion = () =>
  React.useSyncExternalStore(
    watchMotion,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

// Knows nothing about what it draws, so any walkthrough gets the controls.
export function Player<S>({
  scenes,
  script,
  viewBox = "0 0 640 324",
  ratio = "640/324",
  autoPlay = true,
  camera,
  className,
}: {
  scenes: Scene<S>[];
  script: S;
  viewBox?: string;
  ratio?: string;
  autoPlay?: boolean;
  /**
   * The viewBox to shoot through, as a function of the whole film's frame
   * rather than the scene's. Taking it globally is what keeps the move
   * continuous across a scene change: there is no per-scene camera to cut
   * between, only one rectangle travelling the whole way.
   */
  camera?: (frame: number) => string;
  className?: string;
}) {
  const total = React.useMemo(() => totalFrames(scenes), [scenes]);
  const [frame, setFrame] = React.useState(0);
  const track = React.useRef<HTMLDivElement>(null);

  /* Whether it plays is derived, not stored: nothing autoplays under reduced
     motion, but pressing play still works, and that press is the override. */
  const reduced = useReducedMotion();
  const [override, setOverride] = React.useState<boolean | null>(null);
  const playing = override ?? (autoPlay && !reduced);

  React.useEffect(() => {
    if (!playing) return;

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const advanced = ((now - last) / 1000) * FPS;
      if (advanced >= 1) {
        last = now;
        setFrame((current) => {
          if (current + advanced >= total) {
            setOverride(false);
            return total;
          }
          return current + advanced;
        });
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const done = frame >= total;
  const scene = scenes.findLast((entry) => frame >= entry.at) ?? scenes[0];

  const shot = camera ? camera(frame) : viewBox;

  const toggle = () => {
    if (done) {
      setFrame(0);
      setOverride(true);
      return;
    }
    setOverride(!playing);
  };

  // Dragging anywhere on the track scrubs, the way a video player does.
  const scrubTo = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    setFrame(Math.min(total, Math.max(0, ((clientX - rect.left) / rect.width) * total)));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === " ") {
      event.preventDefault();
      toggle();
    }
    if (event.key === "ArrowRight") setFrame((n) => Math.min(total, n + seconds(3)));
    if (event.key === "ArrowLeft") setFrame((n) => Math.max(0, n - seconds(3)));
  };

  return (
    <figure className={cn("surface shrink-0 overflow-hidden", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={playing ? "Pause the walkthrough" : "Play the walkthrough"}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="relative cursor-pointer outline-none focus-visible:bg-muted/40"
      >
        <svg
          viewBox={shot}
          style={{ aspectRatio: ratio }}
          /* The default tint the first walkthrough was drawn against. Anything
             that sets its own colour — the pen in `ink.tsx` does, per tier —
             overrides it rather than inheriting the wash. */
          className="block w-full text-foreground/75"
          aria-label={scene.caption}
        >
          <scene.Body f={frame - scene.at} script={script} />
        </svg>

        {!playing || done ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-(--shadow-float)">
              {done ? <RotateCcw className="size-5" /> : <Play className="size-5" />}
            </span>
          </span>
        ) : null}
      </div>

      <div
        ref={track}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setOverride(false);
          scrubTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubTo(event.clientX);
        }}
        className="relative h-1.5 cursor-pointer bg-border"
      >
        <span
          className="absolute inset-y-0 left-0 bg-foreground"
          style={{ width: `${(frame / total) * 100}%` }}
        />
        {scenes.slice(1).map((entry) => (
          <span
            key={entry.caption}
            aria-hidden
            className="absolute inset-y-0 w-px bg-card"
            style={{ left: `${(entry.at / total) * 100}%` }}
          />
        ))}
      </div>

      <figcaption className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          aria-label={done ? "Play again" : playing ? "Pause" : "Play"}
          onClick={toggle}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          {done ? (
            <RotateCcw className="size-4" />
          ) : playing ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </button>

        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {scene.caption}
        </span>

        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatTime(frame)} / {formatTime(total)}
        </span>
      </figcaption>
    </figure>
  );
}
