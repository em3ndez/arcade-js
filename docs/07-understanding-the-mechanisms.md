# 7. Understanding the mechanisms

The [lift](03-translation.md) is byte-faithful but **meaning-blind**: it tells you a routine
writes `0x801b`, not that `0x801b` is *which directions the player is allowed to dig*. The
[decompiler pipeline](08-decompiler-pipeline.md) can't produce readable code or *earned* names
without that meaning — a name is a claim about what a routine does *in the game*. This step builds
that claim, on evidence, before and during the idiomatic rewrite.

The output is one **living** document per game: `games/<game>/MECHANISMS.md` — a code-grounded
model of how the game actually plays.

## It is grounded, not recalled

We deliberately port games with **no public reverse-engineering** (The Pit is the first), so that
"understanding" can't be smuggled in from a manual or a wiki — it has to come from the code and
from watching the real machine. Keep that discipline: **every claim in the mechanism map carries a
confidence tag**, and nothing recalled is ever written as fact.

- **[seen]** — observed directly in a captured MAME frame.
- **[code]** — derived from a translated routine's behaviour. The *mechanics* are exact (the lift
  is faithful); the *role* is your inference from them.
- **[guess]** — plausible, unverified. Explicitly not to be relied on.

A wrong role asserted with confidence is worse than a neutral `loc_<addr>` — it is the
[sprite-record trap](08-decompiler-pipeline.md) at the level of the whole game. Tag honestly.

## How to build it

1. **Watch the game — attract mode is free ground truth.** Every arcade game of this era runs an
   attract loop (title / high-scores / a gameplay demo) when idle. It is **deterministic and
   input-free**, so you can capture it headlessly and *see* what the code is doing without solving
   any gameplay:

   ```sh
   # tools/mame-play.py resolves the MAME driver from the board and isolates config; --headless
   # gives the null-video capture path (drop --headless to just play it in a window).
   python3 tools/mame-play.py <game> --rompath <romset-parent> --headless --seconds 45 \
     -snapshot_directory <out> -aviwrite attract.avi
   ffmpeg -i <out>/attract.avi -vf fps=1 <out>/f_%02d.png
   ```

   Read the frames. Identify the actors, the playfield, the HUD, the loop. That is your **[seen]**
   layer, and those same frames become the first [pixel-gate](06-pixel-gate.md) goldens (the title
   screen — deterministic, though often with a blink to match by frame *phase* — is the cleanest
   first target; the demo needs the [entropy pin](08-decompiler-pipeline.md) because enemy motion
   pulls from the RNG).

2. **Tie observed elements to routines and RAM.** For each thing you see (player, each enemy, the
   score, a spawn), find the routines that drive it and the addresses they read/write. Record a
   mechanism→routine table and a RAM-role table. This is the **[code]** layer.

3. **Leave the unknowns visible.** Keep an explicit *open questions* list (win/lose conditions, a
   timer, an actor whose behaviour you haven't pinned). Named unknowns are the to-do list for
   understanding, exactly as unreached spans are the to-do list for [disassembly](02-disassembly.md).

## Maintain it as understanding grows

**The mechanism map is never "done" — it is maintained continuously.** It starts as mostly
`[guess]` and a short mechanism table, and every later pass promotes it:

- A newly translated routine turns a `[guess]` into `[code]`, or adds a row.
- A RAM-naming corroboration or a control-poke turns `[code]` into `[seen]`/confirmed, and closes an
  open question.
- The idiomatic decompile is where the deepest understanding lands — fold what you learn back in as
  you go, don't leave it in your head.

Anyone who touches the game — translating, naming, or decompiling — updates the map in the same
change. Treat a stale mechanism map the way you treat a stale doc: a bug.

## Where it sits in the pipeline

It is **cross-cutting, not a step.** The observation half needs only the ROM and MAME, so it
**starts on day one — before the lift** — and orients everything that follows; the `[code]` layer
then grows with the lift, and the deepest understanding lands *during* the decompile. It spans the
whole [decompiler pipeline](08-decompiler-pipeline.md), whose RAM-naming and bottom-up-decompile
steps **consume** it: an earned English name *is* a mechanism-map role that reached confidence. So:

> **The mechanism map (`games/<game>/MECHANISMS.md`) is required reading for the idiomatic /
> decompile workers**, along with this doc — before proposing any name or writing any idiomatic
> routine. You cannot name what you don't understand.
