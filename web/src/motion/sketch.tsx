"use client";

import * as React from "react";
import rough from "roughjs";

const generator = rough.generator();

// Seeded, so the wobble is the same every render and on the server.
const sketch = { roughness: 1.5, bowing: 1.4, strokeWidth: 1.4, seed: 42 };

export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; x: number; y: number; d: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "path"; points: [number, number][] }
  | { kind: "svg"; d: string };

function pathsOf(shape: Shape): string[] {
  const draw = (() => {
    switch (shape.kind) {
      case "rect":
        return generator.rectangle(shape.x, shape.y, shape.w, shape.h, sketch);
      case "circle":
        return generator.circle(shape.x, shape.y, shape.d, sketch);
      case "path":
        return generator.linearPath(shape.points, sketch);
      case "svg":
        return generator.path(shape.d, sketch);
      default:
        return generator.line(shape.x1, shape.y1, shape.x2, shape.y2, sketch);
    }
  })();

  const paths = generator.toPaths(draw).map((path) => path.d);
  if (shape.kind !== "arrow") return paths;

  const head = 8;
  const tip = generator.linearPath(
    [
      [shape.x2 - head, shape.y2 - head],
      [shape.x2, shape.y2],
      [shape.x2 - head, shape.y2 + head],
    ],
    sketch,
  );

  return [...paths, ...generator.toPaths(tip).map((path) => path.d)];
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

// pathLength="1" makes one unit of dash offset the whole stroke, however long.
export function Sketch({
  shapes,
  progress,
  opacity = 1,
}: {
  shapes: Shape[];
  progress: number;
  opacity?: number;
}) {
  const paths = React.useMemo(() => shapes.flatMap(pathsOf), [shapes]);

  // Strokes overlap a little, so the drawing reads as one continuous hand.
  const window = 1 / Math.max(1, paths.length * 0.75);

  return (
    <g opacity={opacity} fill="none" stroke="currentColor" strokeLinecap="round">
      {paths.map((d, i) => {
        const start = (i / paths.length) * 0.85;
        return (
          <path
            key={i}
            d={d}
            pathLength={1}
            strokeWidth={1.4}
            strokeDasharray={1}
            strokeDashoffset={1 - clamp((progress - start) / window)}
          />
        );
      })}
    </g>
  );
}
