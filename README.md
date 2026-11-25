# Kaiju Pinball

A tiny city, one very large ball, and ninety seconds of beautiful destruction.

[Play the live demo](https://jimmerioles.github.io/kaiju-pinball/)

https://github.com/user-attachments/assets/69ba2d5e-c2cc-44e7-9e4d-255021bc5098

A five-minute technical explainer. [1080p download](https://github.com/jimmerioles/kaiju-pinball/releases/download/v0.1.0/kaiju-pinball-explainer.mp4) · [Captions](docs/video/kaiju-pinball-explainer.srt) · [Production notes](docs/explainer/README.md)

Kaiju Pinball is a browser toy built with three.js for players who want a quick arcade run and developers who like procedural systems. You steer a chrome ball through a seeded miniature city that doubles as a pinball table: buildings are bumpers, streets are lanes, and the flippers sit at the edge of the plinth. Runs last ninety seconds, every seed builds a different city, and the whole thing ships without external models, textures, or audio.

## Key features

- **The city is the table.** Fragile blocks chain into their neighbors, bumper caps launch the ball, and the flippers sit at the plinth edge.
- **Seed the skyline.** A short string deterministically builds the layout, palette, and window patterns. Share it with `?seed=`.
- **Arcade physics, not a rigid-body engine.** A custom 120 Hz solver handles the ball, flippers, guides, boost pads, and bumper caps.
- **Destruction with feedback.** Shards, sparks, dust, shockwave rings, screen shake, and a combo multiplier turn each hit into feedback.
- **Ninety seconds, three balls.** A five-second ball saver protects the first drain after each launch. The end screen ranks the wreckage and keeps a local best.
- **Daily run and recent cities.** The start screen seeds a city from today's date and keeps the last five cities you launched.
- **No external assets.** Every mesh, facade, texture, and sound is generated in code. The build is Vite, TypeScript, and three.js.
- **Desktop and touch.** Pointer, keyboard, and touch controls over a responsive DOM HUD and a single WebGL canvas.

## Run it

```bash
npm ci
npm run dev      # local server, usually http://localhost:5173
npm run build    # production bundle
npm test         # Vitest
npm run preview  # serve the production build
```

Node 22.12 or newer; `.nvmrc` pins Node 24. Pushes to `main` deploy the static build to GitHub Pages.

## Use it

- Move the pointer or press **A** / **D** or the arrow keys to steer.
- Click the left or right half of the table, or press **Z** / **M** or the Shift keys, to fire that flipper.
- Press **Space** to launch. A run is ninety seconds with three balls; the first drain in the first five seconds after launch gets a save.
- Add `?seed=peach-harbor-42` to the URL to replay a city, or use **Copy city link** after a run. The start screen also offers a **Daily run** and the five most recent cities on this browser.

## How it works

A seeded generator lays out a 9 by 13 grid for the city, then a custom arcade solver runs the ball, flippers, guides, and pads at 120 Hz. Buildings are instanced, effects are pooled, and every mesh, facade, and sound is generated at runtime. The physics is tuned for arcade feel, not rigid-body realism; chain reactions are scheduled, and the best score and recent cities stay in `localStorage`.

The implementation map is in [docs/architecture.md](docs/architecture.md). More detail: [product plan](docs/plan.md) · [glossary](GLOSSARY.md) · [ADRs](docs/adr/) · [agent handoff](AGENTS.md).

## Tests

`npm test` covers deterministic seeding, daily seeds, and recent-city history. `npm run verify` runs typecheck, lint, tests, format check, and build.

## Credits

Created by [Jim Merioles](https://github.com/jimmerioles). Built with [three.js](https://threejs.org/), [Vite](https://vite.dev/), and [TypeScript](https://www.typescriptlang.org/). MIT licensed, see [LICENSE](LICENSE).
