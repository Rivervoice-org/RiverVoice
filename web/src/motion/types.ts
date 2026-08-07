import type * as React from "react";

// Body is a pure function of the frame, which is what makes scrubbing and an
// out-of-browser render possible.
export type Scene<S> = {
  at: number;
  length: number;
  caption: string;
  Body: React.FC<{ f: number; script: S }>;
};

export const totalFrames = <S>(scenes: Scene<S>[]) => {
  const last = scenes.at(-1);
  return last ? last.at + last.length : 0;
};
