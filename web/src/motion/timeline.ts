export const FPS = 30;

export const seconds = (n: number) => Math.round(n * FPS);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function interpolate(
  frame: number,
  [inStart, inEnd]: [number, number],
  [outStart, outEnd]: [number, number],
) {
  if (inEnd === inStart) return outEnd;
  const t = clamp((frame - inStart) / (inEnd - inStart), 0, 1);
  return outStart + (outEnd - outStart) * t;
}

export const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export function enter(frame: number, at: number, length = seconds(0.5)) {
  const t = ease(interpolate(frame, [at, at + length], [0, 1]));
  return { opacity: t, transform: `translateY(${(1 - t) * 8}px)` };
}

export function typed(text: string, frame: number, at: number, perChar = 1.6) {
  const shown = Math.floor(clamp((frame - at) / perChar, 0, text.length));
  return text.slice(0, shown);
}

export function formatTime(frame: number) {
  const total = Math.floor(frame / FPS);
  return `0:${String(total).padStart(2, "0")}`;
}
