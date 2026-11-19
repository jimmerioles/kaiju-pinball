# Kaiju Pinball

A three.js side project where a chrome ball destroys a miniature city that is also a pinball table.

## The idea in one sentence

Drop a ball into a seeded toy city, steer it through streets and ramps, smash buildings for combo points, and fire flippers at the table edge to keep the run alive for ninety seconds.

## Why this is the best of the brainstormed ideas

The winning definition is Elegant plus Genius plus Awesome, with Awesome emphasized for a two to four week build.

- **Elegant:** one ball, one instanced city, one seeded generator, one collision rule. No external assets and no heavy physics engine. The chaotic scene is essentially three draw calls: buildings, shards, sparks.
- **Genius:** the city _is_ the pinball table. Buildings are bumpers, streets are lanes, roofs are ramps, and the flippers sit at the edge of the plinth. That single conceptual collapse drives the art, the code, and the scoring.
- **Awesome:** a chrome ball smashing a toy city with sparks, screen shake, blooming shockwaves, and a rising combo soundtrack. A stranger understands the goal in five seconds and immediately wants another run.

Other candidates were rejected because each dominates one axis but not all three. The Zoom With No End has insight but less fun. Murder is elegant but leans on a well known boids demo. Evolution Gym has the sharpest idea but the highest risk of never working.

## Visual tone

Tiny diorama. Warm sunset light on pastel miniature buildings makes the destruction readable and charming, and it avoids the asset cost of realism. Borrow arcade punch only where it counts: an emissive bumper palette, a bold score overlay, and synthesized crash sounds. Cinematic realism and full neon arcade are explicitly out of scope.

## The experience

A tilted tabletop view of a small city on a plinth. Press launch and a chrome ball drops into the skyline. Steer with mouse drag or A and D. Left and right click fire the two flippers at the bottom edge. Hitting buildings cracks them. Hitting glowing bumper caps launches the ball with a shockwave. Crossing ramps throws the ball back into the skyline. Every hit inside a two and a half second window raises a multiplier. After ninety seconds, time slows, the camera orbits the wreckage, and a destruction report gives a rank like "Concerned Neighbor" or "Menace".

## Technical architecture

- **Stack:** Vite, TypeScript, three.js, no external models or audio files.
- **Ball physics:** a small custom integrator, not a physics engine. Gravity, restitution, clamped top speed, and fixed 120 Hz substeps to prevent tunneling through thin walls.
- **World:** a seeded generator using mulberry32 lays out blocks on a grid with three types: fragile, solid, and bumper. One `InstancedMesh` holds every building with `instanceColor`. Destroyed blocks are hidden by zeroing their instance matrix.
- **Chaos pool:** one instanced box mesh for roughly 600 shard bodies with ballistic motion and fade, plus one `Points` buffer for additive sparks. Only active instances are updated.
- **Collisions:** sphere versus AABB for the ball, simple sphere checks so falling shards can damage other blocks. This gives causal chain reactions without a rigid body solver.
- **Table furniture:** bumper caps as emissive cylinders, glowing boost pads, angled inlane guides that funnel the ball back toward the flippers, and flipper meshes with a generous trigger window near the exit lanes.
- **Feel:** `UnrealBloomPass` for bumper rings and sparks, impact driven camera shake, subtle vignette and grain, and Web Audio synthesis for crashes, combo tones, and a low rumble.
- **UI:** a minimal HTML overlay for score, multiplier, timer, seed, and the final report.
- **Seed coupling:** one seeded generator drives layout, colors, and audio pitches, so a seed change changes everything at once.

## Four week build

### Week 1, the toy

- Project scaffold with Vite, TypeScript, three.js.
- Seeded city generation and instanced buildings.
- Ball integrator with fixed substeps, collisions, and basic score.
- Tabletop camera, launch input, and steering.
- Outcome: enough to smash a block and feel the weight.

### Week 2, the joy

- Shards, sparks, shockwave rings, and camera shake.
- Synthesized audio for crashes and combos.
- Bumper caps, ramps, flippers, and the combo multiplier.
- Outcome: the run feels playful and rewarding.

### Week 3, the game

- Ninety second run, seeded daily challenge, and a shareable seed.
- Destruction report with ranks.
- Bloom and visual polish, input tuning, performance pass.
- Outcome: a complete experience a stranger can play.

### Week 4, the buffer

- Chain reaction tuning.
- Mobile touch controls.
- One extra city theme if the core is already strong.
- Outcome: resilience and a little extra content.

## Risks and guards

| Risk                                      | Guard                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Ball tunnels through thin blocks          | Fixed substeps and a velocity clamp                                    |
| Effects turn into visual mush             | Three color palette, emissive accents only, capped particle counts     |
| Scope balloons into realistic destruction | Arcade fracture only, explicitly out of scope                          |
| Flippers feel useless                     | Place them on the most common exit lanes and allow a forgiving trigger |
| Physics feels floaty                      | Tune gravity and restitution first, before any visual polish           |

## Definition of done

Someone opens the link, clicks launch, and says "one more run" without being told what to do.

## Status

The first playable version is built. It includes seeded city generation, the custom ball integrator, building destruction with shards and chain reactions, bumper caps, boost pads, inlane guides, flippers, a ball saver, combo scoring, synthesized audio, bloom and grain, start and end screens, shareable seeds, a local best score, and a responsive layout.

Ideas left for a buffer pass: more city themes, a daily seed shortcut, richer mobile gestures, and a subtle ball trail.

## Next step

Continue with polish and the buffer week ideas, or stop here and share the city.
