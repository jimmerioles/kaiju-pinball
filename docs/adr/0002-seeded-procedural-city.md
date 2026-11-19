# Generate the city from a seed instead of authoring a level

A hand-authored city would be prettier once, but the game is built around replaying a fresh layout and sharing a run. The city is generated from a short seed using a deterministic hash and mulberry32, so the same seed produces the same city on any machine. The trade-off is that layout quality varies by seed, and minimum playability has to be enforced by generation rules rather than by hand.

## Consequences

- The seed is the shareable unit of content, not a level file.
- Generation rules are part of the product and need seed sweeps when changed.
- Authored set pieces, if added, should stay separate from the seeded generator.
