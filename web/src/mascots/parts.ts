// Rivervoice's own robot mascots, drawn as SVG paths rather than generated, so
// the set is ours outright: no attribution owed and no third-party service.
//
// The linework is irregular on purpose — corners overshoot, two edges are
// struck twice, and the lenses are mismatched — because a perfectly symmetric
// robot reads as clip art.

export const INK = "#1b1b1a";
export const PAPER = "#f7f7f5";

export const SHELLS = [
  `<path d="M26.5 38.5C26 33.4 29.6 29.7 34.4 29.2C46 28.2 58.5 28.4 68.2 29.6C73.1 30.2 76.2 33.8 76.4 38.8C76.9 48.6 76.6 58.9 75.7 66.4C75.1 71.2 71.7 74.4 66.8 74.8C55.6 75.7 44.1 75.6 34.1 74.6C29.3 74.1 26.6 70.8 26.3 65.9C25.7 56.7 25.9 46.6 26.5 38.5Z" stroke-width="3.1"/>
   <path d="M27.2 41.5C26.9 50.2 26.9 59.6 27.4 65.6" stroke-width="1.5" opacity=".55"/>
   <path d="M35.8 74.9C46.6 75.9 57.4 75.9 66.2 75.1" stroke-width="1.5" opacity=".5"/>
   <path d="M25.6 47.4C21.6 47.2 19.4 49.4 19.5 53.4C19.6 57.2 21.9 59.4 25.8 59.1" stroke-width="2.7"/>
   <path d="M77 48.2C80.9 48.1 82.9 50.3 82.8 54C82.7 57.6 80.6 59.7 76.9 59.6" stroke-width="2.7"/>`,

  `<path d="M30.2 39.8C29.7 32.9 34.2 28.6 40.4 28C48.2 27.2 55.4 27.4 61.4 28.3C67.3 29.2 71.1 33.2 71.3 39.4C71.7 49.8 71.5 59.8 70.7 66.9C70.1 72.3 66.6 75.4 61 75.8C53 76.4 45.8 76.3 39.4 75.5C34 74.9 30.5 71.6 30.2 66C29.7 56.8 29.8 47.4 30.2 39.8Z" stroke-width="3.1"/>
   <path d="M31 43.4C30.7 51.6 30.7 60.4 31.2 66" stroke-width="1.5" opacity=".55"/>
   <path d="M38.4 75.6C46.6 76.4 54.4 76.4 60.6 75.9" stroke-width="1.5" opacity=".5"/>
   <path d="M29.4 46.6C25.2 46.2 22.8 48.6 22.9 52.8C23 56.8 25.4 59.2 29.6 58.9" stroke-width="2.7"/>
   <path d="M72 47.4C76.2 47.2 78.5 49.6 78.4 53.6C78.3 57.4 76 59.6 72 59.4" stroke-width="2.7"/>`,

  `<path d="M22.4 42.2C22 36.7 25.6 32.7 31.2 32.3C44 31.3 57.2 31.4 69.4 32.5C74.9 33 78.2 36.7 78.4 42.2C78.8 50.1 78.6 57.4 77.8 63.3C77.2 68.3 73.8 71.2 68.4 71.6C56 72.5 43.8 72.4 31.6 71.4C26.2 71 23 67.8 22.7 62.6C22.2 55.4 22.2 48.5 22.4 42.2Z" stroke-width="3.1"/>
   <path d="M23.2 45.4C22.9 52.6 22.9 59 23.4 63.2" stroke-width="1.5" opacity=".55"/>
   <path d="M31.8 71.7C43.6 72.6 55.6 72.6 67.8 71.9" stroke-width="1.5" opacity=".5"/>
   <path d="M21.6 47.8C17.8 47.6 15.7 49.8 15.8 53.4C15.9 56.9 18 59 21.7 58.8" stroke-width="2.7"/>
   <path d="M79 48.4C82.8 48.2 84.9 50.4 84.8 54C84.7 57.4 82.6 59.5 79 59.3" stroke-width="2.7"/>`,
];

export const EYES = [
  `<path d="M41.8 42.6C48.9 42.4 52.6 46.5 52.4 51.8C52.2 57.1 48.4 60.6 42.6 60.4C36.9 60.2 33.6 56.6 33.7 51.4C33.8 46.3 36.5 42.8 41.8 42.6Z" stroke-width="2.8"/>
   <circle cx="43.2" cy="51.6" r="4.6" fill="${INK}" stroke="none"/>
   <circle cx="41.4" cy="49.6" r="1.5" fill="${PAPER}" stroke="none"/>
   <path d="M63.4 43.4C68.6 43.3 71.2 46.4 71.1 50.6C71 54.9 68.2 57.6 63.6 57.5C59.2 57.4 56.7 54.6 56.8 50.4C56.9 46.3 59.3 43.5 63.4 43.4Z" stroke-width="2.6"/>
   <circle cx="64.2" cy="50.5" r="3.4" fill="${INK}" stroke="none"/>
   <circle cx="63" cy="49" r="1.1" fill="${PAPER}" stroke="none"/>`,

  `<path d="M35 44.6C45.4 43 55.8 43 66.2 44.7C68.4 45 69.4 46.4 69.3 49.2C69.2 53 68 55.2 65.8 55.5C55.4 57 45.2 57 34.8 55.4C32.6 55.1 31.6 52.9 31.7 49.1C31.8 46.4 32.8 45 35 44.6Z" stroke-width="2.8"/>
   <path d="M38.6 47.8C41.6 47.2 44.4 47 47 47.2" stroke-width="2" opacity=".7"/>
   <circle cx="59.4" cy="50.4" r="2.6" fill="${INK}" stroke="none"/>`,

  `<path d="M35.4 44.4C40.8 44.1 44.2 44.2 46.6 44.6C48.2 44.9 48.8 46.2 48.7 49.6C48.6 53.8 47.8 56.2 46 56.5C43.4 56.9 39.8 56.9 35.6 56.6C33.6 56.4 32.8 54.4 32.9 50C33 46.2 33.6 44.6 35.4 44.4Z" stroke-width="2.7"/>
   <circle cx="41" cy="50.6" r="3.6" fill="${INK}" stroke="none"/>
   <path d="M55.2 44.8C60.2 44.5 63.6 44.6 65.8 45C67.4 45.3 68 46.6 67.9 49.8C67.8 53.6 67 55.9 65.2 56.2C62.8 56.6 59.4 56.6 55.4 56.3C53.5 56.1 52.8 54.2 52.9 50.2C53 46.6 53.5 45 55.2 44.8Z" stroke-width="2.7"/>
   <circle cx="60.4" cy="50.6" r="3.2" fill="${INK}" stroke="none"/>`,

  `<path d="M50.2 40.4C59.8 40.1 65.4 45 65.1 51.8C64.8 58.6 59.6 62.7 50 62.4C40.8 62.1 35.4 57.8 35.7 51.2C36 44.6 41.4 40.7 50.2 40.4Z" stroke-width="3"/>
   <circle cx="51.4" cy="51.4" r="6.4" fill="${INK}" stroke="none"/>
   <circle cx="48.4" cy="48.4" r="2" fill="${PAPER}" stroke="none"/>`,
];

export const MOUTHS = [
  `<path d="M40.4 63.6C47 62.9 54.6 62.9 61.2 63.5" stroke-width="1.9" opacity=".85"/>
   <path d="M41.8 67.2C47.8 66.7 54 66.7 60 67.1" stroke-width="1.9" opacity=".8"/>`,

  `<circle cx="42" cy="65" r="1.5" fill="${INK}" stroke="none"/>
   <circle cx="47.4" cy="64.7" r="1.5" fill="${INK}" stroke="none"/>
   <circle cx="52.8" cy="64.7" r="1.5" fill="${INK}" stroke="none"/>
   <circle cx="58.2" cy="65" r="1.5" fill="${INK}" stroke="none"/>
   <circle cx="44.6" cy="68.8" r="1.3" fill="${INK}" stroke="none"/>
   <circle cx="50.2" cy="68.6" r="1.3" fill="${INK}" stroke="none"/>
   <circle cx="55.6" cy="68.8" r="1.3" fill="${INK}" stroke="none"/>`,

  `<path d="M40 65.4C43.2 62.9 46.2 68 49.6 65.4C53 62.8 56.2 68 59.8 65.3" stroke-width="2.2"/>`,

  `<path d="M41.6 62.8C48.4 62.2 55.2 62.2 61 62.8C62.2 62.9 62.6 63.8 62.5 65.6C62.4 68 61.6 69.2 60.2 69.3C54.6 69.9 48 69.9 42.4 69.3C41.1 69.2 40.5 67.8 40.6 65.4C40.7 63.8 41 62.9 41.6 62.8Z" stroke-width="2.2"/>
   <path d="M46.4 63.2L46.2 69M51.6 63.1L51.5 69M56.8 63.2L56.7 68.9" stroke-width="1.5" opacity=".7"/>`,
];

export const TOPS = [
  ``,
  `<path d="M49.4 29C49 24.8 50.8 21.6 53.4 19.4" stroke-width="2.6"/>
   <circle cx="55.6" cy="17.2" r="3.2" stroke-width="2.4"/>`,
  `<path d="M40.6 29.2C40.2 25.6 39.8 23.4 39 21.6" stroke-width="2.4"/>
   <path d="M60 29.2C60.6 26 61.2 23.8 62.2 22" stroke-width="2.4"/>
   <circle cx="38.4" cy="19.6" r="1.9" fill="${INK}" stroke="none"/>
   <circle cx="62.8" cy="20" r="1.9" fill="${INK}" stroke="none"/>`,
  `<path d="M50 28.8L50.4 22.4" stroke-width="2.4"/>
   <path d="M42.6 21.6C45.6 18.4 55.4 18.2 58.6 21.4C55.6 23.8 45.4 24 42.6 21.6Z" stroke-width="2.4"/>`,
];
