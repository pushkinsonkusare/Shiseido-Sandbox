# Advisor connect sparkles

The three-star loader shown while the Beauty Advisor connects.

## Files

| File | What it is |
| --- | --- |
| `sparkles-animated.svg` | The full animation in one self-contained SVG: shape, gradient and CSS keyframes. No JS and no dependencies. |
| `sparkle-star.svg` | A single static star (same outline and gradient) for icons or a reduced-motion fallback. |
| `preview.html` | Open it in a browser to see the animation at several sizes, plus the spec. |

## Using it

- **Web:** `<img src="sparkles-animated.svg" width="128" height="121" alt="">`, or inline the SVG. It's vector, so it stays sharp at any size.
- **React (the prototype's source of truth):**
  - `src/components/SidecarAssistant/components/AdvisorConnectLoader.tsx` has `ConnectSparkles`, which builds the star path.
  - `AdvisorConnectLoader.css` has the `advisor-connect-sparkle-*` keyframes.
- **iOS / Android / Lottie:** import `sparkles-animated.svg` into After Effects or a Lottie converter. Or rebuild it from the spec below, which is just three transforms on one shape.

## Spec

- **Canvas:** viewBox `0 0 276 261`, shown at 128 × 121 px.
- **Shape:** a four-point star with concave sides and soft tips. It's drawn at radius 100 and centred on 0,0, then scaled down per star.
- **Fill:** a horizontal linear gradient from `#567ad2` to `#c96880`.
- **Loop:** 800 ms, linear, infinite, and seamless.
- **Motion:** the big star shrinks toward the bottom right, the bottom-right star crosses to the top left, and the top-left star grows into the big one.
- **Keyframes:** 9 poses per star, one every 12.5% (100 ms). Each pose is `translate(x, y) scale(s)` in viewBox units, and the values are in the SVG's `<style>`.
- **Reduced motion:** the animation stops when `prefers-reduced-motion: reduce` is set.

## Regenerating

The SVGs are generated from the component and its CSS, so they match the app exactly. If the animation changes, re-export them from the repo root rather than editing by hand:

```bash
node scripts/export-sparkles.mjs "$PWD"
```
