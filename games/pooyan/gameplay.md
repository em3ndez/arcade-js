# Pooyan — gameplay (outside-in, from public sources, BLIND TO ROM)

Konami, 1982 (GX320). Written before reading the ROM, from public/general knowledge, to adjudicate
mechanics the code can't settle later. Items tagged **[uncertain]** are single-source or from memory
and MUST be confirmed by playing MAME once the romset is available — expect play to overturn some.

## Objective
You are **Mama** (a mother pig) defending against a pack of **wolves** who are after her **piglets**.
Riding a vertical **elevator/lift** on one side of the screen, you shoot **arrows** at wolves who use
**balloons** to cross the screen; popping a balloon drops its wolf. Clear each wave before enough
wolves get through. [uncertain: exact framing — some sources say the piglets were kidnapped and Mama
is rescuing/defending them.]

## Cast
- **Mama / the player** — in the elevator, armed with a bow. Moves only up/down. [uncertain: which side
  of the screen the elevator is on, and whether it swaps between rounds.]
- **Wolves** — antagonists; ride balloons up or down. A larger **boss wolf** appears in a siege round.
  [uncertain: boss specifics.]
- **Piglets** — the stakes; [uncertain] whether shown as characters or implied.

## Controls
- **2-way joystick: UP / DOWN** — drive the elevator. [uncertain: up/down only, no left/right.]
- **1 button** — shoot an arrow.
- **Meat / steak** — a heavy special shot: shooting the rope holding a piece of meat drops it down a
  column, taking out multiple wolves for bonus points. [uncertain: whether always available or collected.]

## Rounds (the wave structure loops, getting harder)
1. **Descent** — wolves float DOWN from the top on balloons toward the bottom; pop balloons before they
   land. [uncertain: penalty when one lands — lose a life vs. fill a meter.]
2. **Ascent** — wolves climb UP the cliff on balloons; stop them before they reach the top and drop a
   boulder/rock. [uncertain: exact top-of-screen hazard.]
3. **Siege / bonus** — a big wolf (and pack) push a giant **boulder**; shoot to hold it back, or a bonus
   stage. [uncertain: whether this is every cycle or periodic, and whether it's scored as a bonus.]
The cycle then repeats at higher difficulty. [uncertain: how difficulty scales per loop.]

## Scoring & lives
- Points for each wolf/balloon downed; a **meat drop** clears a column for a large bonus; [uncertain]
  catching falling items (fruit?) or zapping projectiles may score.
- **Lives**: 3 by default. [uncertain: selectable count.] **Bonus life**: an extra life at a score
  threshold (around 30K–50K), then repeating. [uncertain: exact thresholds.]

## Lose / win
- **Lose a life** when the wolves achieve their goal (reach bottom in Descent / top in Ascent), or when
  a wolf reaches Mama's elevator. [uncertain: exact trigger and whether it's per-wolf or a threshold.]
- **Clear a round** by eliminating the wave; progress through the rounds; the game **loops** indefinitely.

## Hardware-grounded facts (from the driver — not blind, noted for cross-check)
- Portrait (ROT90). One 2-way stick + one button per player; cocktail supported (P2 mirrored).
- Coinage via KONAMI_COINAGE (DSW0). Watchdog kicked by a WRITE to 0xa000 (a READ of 0xa000 returns DSW1).
- DSW1 dips (from the driver, not blind): Lives 3/4/5/255, Bonus-life thresholds (50K 80K+ or 30K 70K+),
  Difficulty a 1..8 scale, Demo-sounds switch.
These will be reconciled with observed play during grounding.

## To confirm by PLAYING (grounding, once ROMs present)
Round order & count · the siege/boulder round · lose triggers · meat mechanic · scoring values ·
elevator side · whether piglets are on-screen actors. Ground in MAME (never the JS engine).
