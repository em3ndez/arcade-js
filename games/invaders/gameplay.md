# Space Invaders — gameplay (outside-in, public sources, BLIND to the ROM)

Written per runbook §0 from public knowledge/sources before reading the code. Expect play + the code to
overturn some of this; single-source / uncertain items are flagged. This adjudicates mechanics the code
can't settle later — it is NOT derived from the disassembly.

## What it is
Taito 1978 (Midway licensed the US release). Fixed single-screen shooter, vertical monitor (ROT270). One
laser cannon at the bottom; waves of aliens descend; you clear each wave before they reach you.

## Objective / win-lose
- Shoot all descending aliens to clear the wave; a new wave then starts (aliens begin lower and/or move
  faster — see "difficulty ramp"). Play continues wave after wave (no final "win"; it's a high-score game).
- Lose a life when an alien bomb hits your cannon. Game over when all lives are lost, OR when the aliens
  descend far enough to reach the cannon row / bottom (invasion). [reaching-bottom = instant game over —
  widely stated, verify in play]
- Lives: 3 to start (a DIP switch also allows 2 — verify). Bonus life at a threshold score (commonly 1000
  or 1500 — DIP-selectable; verify).

## Cast / field
- **Player**: one laser cannon, moves left/right along the bottom, fires straight up. Only ONE player shot
  in flight at a time (must hit or leave the screen before firing again). [verify the one-shot rule in play]
- **Aliens**: 55 in a 5-row × 11-column block. Three shapes worth different points:
  - top row (squid): 30 pts · middle two rows (crab): 20 pts · bottom two rows (octopus): 10 pts.
  [row→shape→value mapping is the common statement; verify exact rows.]
- The whole block steps sideways in lockstep; on reaching a screen edge it drops down one row and reverses
  direction. **As aliens are destroyed the block moves FASTER** (fewer aliens = faster refresh) — the
  signature difficulty mechanic; the last alien is very fast.
- Aliens drop **bombs** downward (a few distinct bomb types/patterns; rate rises over the wave). [verify]
- **Mystery UFO**: periodically flies across the top; shooting it scores a bonus (50/100/150/300 —
  the value is famously tied to the player's shot count, not random; verify the exact rule in play/code).
- **Shields/bunkers**: 4 destructible green bunkers above the cannon; both player shots and alien bombs
  erode them; aliens passing through also erode them. [verify erosion behaviour]

## Controls / cabinet
- LEFT, RIGHT, FIRE. 1P and 2P start buttons; 2 players ALTERNATE (not simultaneous). Coin slot.
- Cabinet colour comes from a fixed **transparent colour overlay** (green lower band, red top band) over a
  1-bit black&white raster — NOT a programmable palette (`layout_invaders`). The code renders monochrome;
  colour is a physical overlay.

## Difficulty ramp (per wave)
- Each new wave the alien block starts one row lower (down to a floor). Speed scales inversely with alien
  count within a wave; later waves are harder from the start. [verify the exact per-wave start offset.]

## Open questions to settle by play/grounding (NOT from a listing)
- Exact one-shot-in-flight rule; bomb types + firing cadence; UFO score rule (shot-count table); reaching-
  bottom vs lives-out game-over precedence; bonus-life threshold; DIP options (lives, bonus, coinage);
  whether the block's downward step size / edge logic has quirks. Grounding day-zero (per §0) settles these.

Sources: general public knowledge of Space Invaders (multiple encyclopedic/community descriptions). No ROM
or disassembly was consulted for this file.
