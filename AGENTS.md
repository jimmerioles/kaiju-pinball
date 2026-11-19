# AGENTS.md

Kaiju Pinball is a browser game where a chrome ball destroys a seeded miniature city that is also a pinball table. The stack is Vite, TypeScript, and three.js. All geometry, textures, and audio are generated in code.

The game is playable and the build is green. Treat this file as the entry point. Read the deeper docs only for the branch you are changing.

## Quick start

```bash
npm ci
npm run dev
```

Node 22.12 or newer. `.nvmrc` pins Node 24. The dev server prints the URL. If port 5173 is busy, Vite chooses the next one.

## Before you change something

- **Rendering, camera, post-processing, effects:** read `docs/architecture.md` sections `Rendering` and `Simulation`.
- **Physics, collisions, flippers, scoring, ball save:** read `docs/architecture.md` sections `Simulation` and `Scoring`, then `GLOSSARY.md`.
- **City generation, seeds, block types, themes:** read `docs/architecture.md` section `City generation` and `GLOSSARY.md`.
- **Product direction, scope, roadmap:** read `docs/plan.md` and the latest ADRs in `docs/adr/`.
- **Repo, CI, deployment:** read `README.md` and `.github/workflows/`.

## Completion criteria

A change is done when all of these pass from the repo root:

```bash
npm run check   # strict TypeScript
npm run lint    # ESLint, zero warnings
npm test        # Vitest
npm run build   # production bundle
```

Then smoke test in a visible browser tab:

1. The start screen renders the city behind the title.
2. Launch drops the ball and the timer counts down.
3. Flippers fire on click, keyboard, and touch.
4. A drain either shows "Ball saved" or decrements the ball count.
5. Destroying a building produces shards, sparks, and a score popup; combos rise.
6. The end screen shows score, rank, best score, seed, and working replay buttons.
7. `?seed=<seed>` reloads the same city.

Do not mark a visual change done without a browser screenshot or a real play test.

## Architecture at a glance

See `docs/architecture.md` for the full map.

- `src/game/game.ts`: orchestration, state machine, fixed-step ball physics, scoring, camera, game over.
- `src/game/city.ts`: table, seeded city, pads, guides, lamps, roof details, facades.
- `src/game/ball.ts`: chrome ball, custom environment, contact shadow, locator halo.
- `src/game/flippers.ts`: flipper geometry, animation, capsule collision.
- `src/game/effects.ts`: instanced shards, shader particles, shockwave rings.
- `src/game/audio.ts`: Web Audio synthesis, ambience, mute.
- `src/game/input.ts`: keyboard, pointer, and touch input.
- `src/game/ui.ts`: DOM HUD, start and end screens, callouts, popups.
- `src/game/config.ts`: table, ball, and game tuning. Start here for feel changes.
- `src/game/rng.ts`: seed hashing and deterministic random generation.
- `src/style.css`: HUD, title, overlays, responsive layout.

Data flows one way: input to `Game.stepBall`, collisions in `City` and `FlipperPair`, feedback through `Effects`, `UI`, and `AudioEngine`. Rendering reads state. It does not own it.

## Invariants and gotchas

- **Fixed step, not frame delta.** Ball physics runs at 120 Hz substeps. Keep render `dt` for visuals and input only.
- **Shared materials, per-seed textures.** `City.clearGenerated()` disposes old instance buffers and facade textures. New per-seed textures must be swapped into `sideMaterial` and the old ones disposed.
- **Instanced count is fixed.** Destroyed buildings are hidden by zeroing their instance matrix, not by changing `count`.
- **The ball has its own environment map.** `makeChromeEnvironment()` gives the chrome look. Use it rather than the room environment.
- **The ball halo uses `depthTest: false`.** It is a locator when the ball is behind a tower. Keep it visible through geometry.
- **Guides are one-way.** `collideWithSegment` flips the normal toward the table center with `guide.inside`, so a ball cannot settle in the outlane. Keep the inside vector.
- **Audio unlocks on a gesture.** `AudioEngine.unlock()` runs on launch, mute, or the first pointer interaction. Autoplay stays quiet until then.
- **DOM HUD over WebGL.** Keep the z-index layers: canvas 0, scrim 1, HUD 2, popups 4, callouts 5, screens 10, loading 50.
- **Relative asset base.** The build uses `base: './'` for GitHub Pages. Keep asset links relative and avoid client-side routing.
- **Background tabs pause the game.** Browser automation must keep the tab visible, otherwise the timer and ball freeze.
- **Keep the project asset-free.** Geometry, textures, and sounds are generated in code. Add an asset only when the product direction truly needs one.

## Tuning

- Feel: `src/game/config.ts` (`TABLE`, `BALL`, `GAME`) and `stepBall` in `game.ts`.
- Destruction feedback: `Effects.impact` and the pools in `effects.ts`.
- City density and palette: `City.regenerate` and `PALETTE` in `config.ts`.
- Scoring and ranks: `collideWithBlock`, `processChain`, and `rankFor` in `game.ts`.
- Camera framing and shake: `updateCamera`, `fitCamera`, and `baseCameraPos`.
- HUD and typography: `src/style.css`; copy lives in `index.html` and `ui.ts`.

## Next moves

- Daily seed shortcut and seed history.
- More city themes: harbor, rooftop garden, industrial.
- A subtle ball trail and a stronger occlusion locator.
- Mobile gesture pass and safe-area check on a real phone.
- Performance profile on integrated graphics; reduce bloom cost if needed.
- A first-run tutorial beat that keeps the five-second readability.

Keep the core promise: a tiny city, one very large ball, ninety seconds, one more run.
