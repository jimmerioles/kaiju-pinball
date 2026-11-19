# Kaiju Pinball

A tabletop arcade game where a chrome ball destroys a miniature city that also behaves like a pinball table.

## Language

### Table and city

**City**:
The destructible miniature settlement on the table. Its layout comes from a seed.
_Avoid_: Level, map, board

**Block**:
One building in the city. A block has a kind, health, footprint, and height.
_Avoid_: Building object, tile, mesh

**Block kind**:
The durability class of a block: fragile, solid, or bumper.
_Avoid_: Type, material

**Fragile block**:
A one-impact block with a pastel facade. It is the main source of chain reactions.
_Avoid_: Weak building, glass

**Solid block**:
A three-impact block with a muted facade. It survives most hits.
_Avoid_: Strong building, concrete

**Bumper block**:
A block with a glowing cap that launches the ball and awards bonus points.
_Avoid_: Bumper building, pinball target

**Bumper cap**:
The glowing disc on top of a bumper block.
_Avoid_: Bumper, light

**Boost pad**:
A marked pad on the table that kicks the ball in a fixed direction.
_Avoid_: Ramp, accelerator

**Inlane guide**:
An angled wall near the flippers that funnels the ball back toward the playfield.
_Avoid_: Wall, rail, lane

**Flipper**:
A controllable pivoting paddle that hits the ball back up the table.
_Avoid_: Paddle, bat

**Drain**:
The open bottom edge where a ball leaves play.
_Avoid_: Hole, gutter

**Outlane**:
The space outside an inlane guide where a ball would leave play. The guides are tuned to keep balls out of it.
_Avoid_: Side lane, gutter

**Table**:
The playable surface, including the city, pads, guides, and flippers.
_Avoid_: Board, arena

**Plinth**:
The base under the table that makes the scene read as a miniature diorama.
_Avoid_: Base, pedestal

### Ball and run

**Ball**:
The chrome sphere the player steers. A run has up to three.
_Avoid_: Marble, sphere

**Ball save**:
A short grace window after launch where the first drain does not consume a ball.
_Avoid_: Shield, grace period, continue

**Run**:
One ninety-second session with three balls.
_Avoid_: Game, round, session

**Seed**:
A short readable string that deterministically determines the city layout.
_Avoid_: Code, map ID, level ID

**Attract mode**:
The idle state behind the start screen. The city animates and the ball is hidden.
_Avoid_: Menu, idle, splash

**Game over**:
The end state after the timer expires or the last ball drains.
_Avoid_: Loss, defeat, end screen

### Scoring

**Combo**:
A rising count of damaging hits within a short window. It drives the multiplier.
_Avoid_: Streak, hit count

**Multiplier**:
The score factor derived from the current combo. It caps at 12.
_Avoid_: Bonus, factor

**Chain reaction**:
Destruction caused by a collapsing block damaging its neighbors, rather than by the ball.
_Avoid_: Cascade, explosion

**Best combo**:
The highest multiplier reached during a run, shown on the end screen.
_Avoid_: High combo, max multiplier

**Rank**:
A named performance tier based on the final score.
_Avoid_: Grade, title, badge

**Best score**:
The highest score stored on this browser.
_Avoid_: High score, record

### Feedback

**Trauma**:
The camera shake budget. Impacts add to it and it decays.
_Avoid_: Shake, rumble

**Callout**:
Large centered text for milestones, saves, and chain events.
_Avoid_: Toast, banner

**Score popup**:
A small floating point value at a world position.
_Avoid_: Floating text, damage number

**Shard**:
A short-lived chunk of a destroyed block.
_Avoid_: Debris, fragment, piece

**Spark**:
A tiny additive particle thrown by an impact.
_Avoid_: Ember, particle

**Dust**:
A larger, softer particle that gives impacts volume.
_Avoid_: Smoke, cloud

**Shockwave ring**:
An expanding ring that marks a strong impact or a bumper hit.
_Avoid_: Ripple, pulse

**Facade texture**:
The per-seed window pattern applied to the sides of every block.
_Avoid_: Building texture, skin
