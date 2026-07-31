# 7. Understanding the mechanisms

The [lift](translation.md) is byte-faithful but **meaning-blind**: it tells you a routine
writes `0x801b`, not that `0x801b` is *which directions the player is allowed to dig*. The
[decompiler pipeline](decompiler-pipeline.md) can't produce readable code or *earned* names
without that meaning — a name is a claim about what a routine does *in the game*. This step builds
that claim, on evidence, before and during the idiomatic rewrite.

The output is one **living** document per game: `games/<game>/mechanisms.md` — a code-grounded
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
[sprite-record trap](decompiler-pipeline.md) at the level of the whole game. Tag honestly.

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
   layer, and those same frames become the first [pixel-gate](pixel-gate.md) goldens (the title
   screen — deterministic, though often with a blink to match by frame *phase* — is the cleanest
   first target; the demo needs the [entropy pin](decompiler-pipeline.md) because enemy motion
   pulls from the RNG).

2. **Tie observed elements to routines and RAM.** For each thing you see (player, each enemy, the
   score, a spawn), find the routines that drive it and the addresses they read/write. Record a
   mechanism→routine table and a RAM-role table. This is the **[code]** layer.

3. **Leave the unknowns visible — and enumerate them, don't curate.** Keep an explicit *open
   questions* list (win/lose conditions, a timer, an actor whose behaviour you haven't pinned).
   Named unknowns are the to-do list for understanding, exactly as unreached spans are the to-do list
   for [disassembly](disassembly.md).

   **That prose list is a highlighted subset, NOT the whole to-do — never treat it as complete.** The
   exhaustive, ground-truth to-do for an understanding pass is *every undefined memory location*: each
   work-RAM cell still referenced as a raw `mem8[0x..]` hex literal with no `ram.js` name, plus each
   routine still tagged `[guess]`. An undefined cell is an unnamed unknown even when no prose question
   mentions it. So an understanding pass **ENUMERATES the undefined cells mechanically** and works
   that whole set — it does not read the map's open-questions section and stop. (This is a real,
   recorded failure: an agent read only the map's "still-open" list, promoted its handful of items,
   and reported the game "as understood as it gets" while **30** cells sat unnamed and un-enumerated.)
   Verified game-agnostic enumeration (`<game>` = e.g. `thepit`):

   ```sh
   node --input-type=module -e '
   const game="<game>";
   const ram=await import(`./games/${game}/idiomatic/ram.js`);
   const fs=await import("node:fs");
   const named=new Set(Object.values(ram).filter(v=>typeof v==="number"));
   const dir=`games/${game}/idiomatic`, seen=new Set();
   for(const f of fs.readdirSync(dir)) if(f.endsWith(".js")&&f!=="ram.js")
     for(const m of fs.readFileSync(`${dir}/${f}`,"utf8").matchAll(/mem8\[(0x8[0-9a-f]{3})\]/gi)){
       const a=parseInt(m[1],16);
       if(a>=0x8000&&a<=0x87ff&&!named.has(a)) seen.add(m[1].toLowerCase());
     }
   console.log([...seen].sort().join(" "), "\nUNNAMED:", seen.size);'
   ```

   Each cell it prints is a to-do item: pin its role from its readers/writers (and a control-poke if
   needed), then either promote it to a `ram.js` name if the role is earned, or leave a comment saying
   *why* it stays hex (genuine scratch / a role you deliberately won't over-claim). "Understanding is
   as complete as it gets" is a claim about THIS set being empty-or-accounted-for — verify it against
   this command's output before ever saying it.

## Maintain it as understanding grows

**The mechanism map is never "done" — it is maintained continuously.** It starts as mostly
`[guess]` and a short mechanism table, and every later pass promotes it:

- A newly translated routine turns a `[guess]` into `[code]`, or adds a row.
- A RAM-naming corroboration or a control-poke turns `[code]` into `[seen]`/confirmed, and closes an
  open question — **but the promotion only counts under proposer≠confirmer (below): whoever grounded
  or proposed it cannot be the one who confirms it.**
- The idiomatic decompile is where the deepest understanding lands — fold what you learn back in as
  you go, don't leave it in your head.

**Promotion requires proposer ≠ confirmer — interpretation gets the same bar as code.** A name or a
role-tag is a claim about what something *means*, and the method holds interpretation to the same
proposer-≠-confirmer discipline as code ([README](README.md): "proposer≠confirmer (RAM *and* routines)
+ third adversarial review"; [how-the-agents-worked](how-the-agents-worked.md): "a separate confirmer re-derives
it by control-poke or citation before it is trusted"; also [names-registry](names-registry.md),
[decompiler-pipeline](decompiler-pipeline.md)). So a `[guess]`/`[code]` item is promoted to
`[seen]`/confirmed — and a name is trusted in `ram.js` — only after a **separate** agent (not the
proposer) **independently re-derives it from scratch**: reproduces the control-poke and reads the result
themselves, or cites the corroborating readers/writers themselves, and reaches the same conclusion (or
refutes it). Grounding a claim yourself makes it a *proposal*, not a confirmation.

**A write-up review is NOT a confirmer.** Having a reviewer check your *prose* for honesty/over-claiming
catches an over-claimed sentence; it does not catch a wrong observation — a misread cell, a render
artifact, a pattern-match — because the reviewer never re-ran the experiment. If the confirmer cannot,
or does not, re-derive the finding independently, the promotion does not happen and the item keeps its
prior tag. (Recorded failure, 2026-07-31: an understanding pass promoted an arrow-render
`[guess]`→`[seen]` with the *same* agent proposing and "confirming" — the review could not re-run MAME
— which is a proposer-only `[seen]` mislabeled as confirmed; see [that promotion](../games/thepit/mechanisms.md)
§3, still owed an independent re-derivation.)

Anyone who touches the game — translating, naming, or decompiling — updates the map in the same
change. Treat a stale mechanism map the way you treat a stale doc: a bug.

## Where it sits in the pipeline

It is **cross-cutting, not a step.** The observation half needs only the ROM and MAME, so it
**starts on day one — before the lift** — and orients everything that follows; the `[code]` layer
then grows with the lift, and the deepest understanding lands *during* the decompile. It spans the
whole [decompiler pipeline](decompiler-pipeline.md), whose RAM-naming and bottom-up-decompile
steps **consume** it: an earned English name *is* a mechanism-map role that reached confidence. So:

> **The mechanism map (`games/<game>/mechanisms.md`) is required reading for the idiomatic /
> decompile workers**, along with this doc — before proposing any name or writing any idiomatic
> routine. You cannot name what you don't understand.
