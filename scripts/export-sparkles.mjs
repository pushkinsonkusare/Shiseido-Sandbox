// Builds a standalone animated SVG of the advisor connect sparkles from the
// shipped component + CSS, so the export always matches the app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = process.argv[2];
const outDir = `${root}/design-docs/advisor-connect-sparkles`;
const tsx = readFileSync(`${root}/src/components/SidecarAssistant/components/AdvisorConnectLoader.tsx`, "utf8");
const css = readFileSync(`${root}/src/components/SidecarAssistant/components/AdvisorConnectLoader.css`, "utf8");

const quadSrc = /SPARKLE_QUADRANT[^=]*=\s*\[([\s\S]*?)\];/.exec(tsx)[1];
const quad = [...quadSrc.matchAll(/\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/g)].map((m) => [+m[1], +m[2]]);
const R = +/SPARKLE_RADIUS = (\d+)/.exec(tsx)[1];

const first = [...quad, ...quad.slice(0, -1).reverse().map(([x, y]) => [y, x])].slice(0, -1);
const pts = [];
for (let t = 0; t < 4; t++) for (const [x, y] of first)
  pts.push(t === 0 ? [x, -y] : t === 1 ? [-y, -x] : t === 2 ? [-x, y] : [y, x]);
const n = pts.length, f = (v) => +(v * R).toFixed(2);
let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
for (let i = 0; i < n; i++) {
  const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
  d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
}
d += "Z";

// Animation rules and keyframes, copied verbatim from the component CSS.
const pick = (re) => (css.match(re) || []).join("\n\n");
const rules = (css.match(/\.advisor-connect__sparkle(--\w+)?\s*\{[^}]*\}/g) || [])
  .filter((rule) => !/animation:\s*none/.test(rule))
  .join("\n\n")
  .replace(/\.advisor-connect__sparkle/g, ".sparkle");
const keyframes = pick(/@keyframes advisor-connect-sparkle-\w+\s*\{(?:[^{}]*\{[^}]*\})*\s*\}/g)
  .replace(/advisor-connect-sparkle-/g, "sparkle-");
const anim = rules.replace(/advisor-connect-sparkle-/g, "sparkle-");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 276 261" width="128" height="121" role="img" aria-label="Loading">
  <style>
${anim}

${keyframes}

@media (prefers-reduced-motion: reduce) { .sparkle { animation: none; } }
  </style>
  <defs>
    <linearGradient id="sparkle-gradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#567ad2"/>
      <stop offset="100%" stop-color="#c96880"/>
    </linearGradient>
    <path id="sparkle-star" d="${d}"/>
  </defs>
  <use class="sparkle sparkle--shrink" href="#sparkle-star" xlink:href="#sparkle-star" fill="url(#sparkle-gradient)"/>
  <use class="sparkle sparkle--grow" href="#sparkle-star" xlink:href="#sparkle-star" fill="url(#sparkle-gradient)"/>
  <use class="sparkle sparkle--cross" href="#sparkle-star" xlink:href="#sparkle-star" fill="url(#sparkle-gradient)"/>
</svg>
`;

// Static (first-frame) star, handy as an icon or a reduced-motion fallback.
const star = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width="24" height="24">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#567ad2"/>
      <stop offset="100%" stop-color="#c96880"/>
    </linearGradient>
  </defs>
  <path d="${d}" fill="url(#g)"/>
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/sparkles-animated.svg`, svg);
writeFileSync(`${outDir}/sparkle-star.svg`, star);
console.log("points", quad.length, "path chars", d.length, "rules", (anim.match(/\{/g) || []).length, "keyframes", (keyframes.match(/@keyframes/g) || []).length);
