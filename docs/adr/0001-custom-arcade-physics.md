# Use a hand-rolled arcade integrator instead of a rigid body engine

Kaiju Pinball needs a ball that feels snappy, a fixed 120 Hz simulation that cannot tunnel through thin blocks, and a build that stays within a short side-project window. The ball, flippers, guides, and pads use a custom sphere versus AABB and sphere versus segment solver. Destruction is scripted shards plus scheduled chain damage. A general engine such as Rapier or cannon-es would add a dependency, a tuning surface, and rigid body behavior that fights the arcade feel.

## Consequences

- The ball, flippers, guides, and pads are the only simulated bodies. Shards are visual.
- Chain reactions are deterministic and scheduled, not emergent.
- If future work needs real debris physics, add it behind a separate, bounded system rather than replacing the ball integrator.
