# Poke-tapes: pixel-validating the distant routines

**This is a required step of the idiomatic layer, not an optional extra. Do it for every game.**
Decompiling a game's routines and proving each memory-equivalent to the frozen oracle establishes that
the port's *logic* matches the lift — `[code]`. It does not establish that the port *renders* those
routines the way the real machine does — `[seen]`. The [pixel gate](pixel-gate.md) supplies `[seen]`,
but only for the states its tape actually reaches.

## The gap this closes

The pixel gate's tape coins up, presses start, and plays one credit — so it reaches boot, the attract
demo, and early play. It does **not** reach the *distant* states: later eras/levels, two-player, a
game-over / high-score entry, a boss (mother-ship) fight, or deep rounds. A large fraction of every
decompile batch lives only in those states (timeplt examples: the two-player start, the era-4 collision
dispatcher, the high-score insertion, the era-branching launchers, the whole-wave spawner). Left at the
default tape, those routines are logic-verified against the oracle and **never pixel-verified against
MAME**. That is the gap a poke-tape closes.

## What a poke-tape is

An input tape carries more than button bits: it carries a **poke schedule** — `(nmiOrdinal, addr,
value)` writes — applied **identically to both sides**:

- to **MAME** (the golden), through the tape shim's `mem:write_u8` (the reach/grounding drivers already
  do this), and
- to **our engine** (the candidate), through the same schedule on the generator path in `render.js`.

Both sides are then driven forward from the poked state and the frames are pixel-diffed exactly as the
gate already does. A routine reached this way moves from `[code]` (our JS vs the oracle) to `[seen]`
(our render vs MAME in that state).

## The rules that make it sound

- **Key pokes on the NMI ordinal, never a raw frame index.** The two clocks disagree on frame origin
  (the gate aligns on a landmark, `--tape-origin` / golden offset); a poke applied on different game
  frames on the two sides is not a comparison. One NMI fires per frame once interrupts are live, so the
  ordinal is the shared clock.
- **Pin the RNG identically on both sides.** A live mid-game state has RNG-driven actors (enemy motion,
  spawns, the boss). Without the same entropy pin the two engines diverge on motion alone and the diff
  means nothing. See [idiomatic generation](idiomatic-generation.md) on the entropy pin.
- **Poke the TRIGGER, then play in — don't poke a raw end-state.** Setting `ERA_INDEX = 4` directly can
  leave the rest of work RAM inconsistent (the game never ran era 4's setup), so both engines render the
  same *garbage* — a valid equivalence check, but a weak one. Winding the round counter, arming the boss
  timer, or crediting a second start reaches a *coherent* distant state that exercises the routine as the
  game does.
- **A post-poke divergence is a finding, not a failure of the method.** Either our engine really differs
  from MAME in that state (a bug worth catching — the whole point), or an entropy source is unpinned (to
  pin). Both are results.

## Per-game worklist

For each game, after its routines are decompiled, enumerate the distant states its routines need and add
one poke-tape per state to the pixel gate. State plainly which routines each tape now covers, and which
remain oracle-only. "The pixel gate covers this game" is a claim about that list being worked, not about
one credit's worth of play.

**timeplt (worked):** six tapes now live in `games/timeplt/tapes/`, run by `tools/distant_suite.py` and each
pixel-validated against MAME — era 4 (2001), two-player, game-over, high-score entry, mother-ship (boss)
armed collision, and a deep round. Five of the six carry a game-set `responded` cell — a value the ROM
writes only on reaching the state, read from the golden dump — so a pass is not two engines agreeing on the
same wrong thing; era-4's `responded` instead confirms its held era poke landed in the golden (that state's
coherence comes from the MAME grounding, not the cell). Entropy pinning proved unnecessary (the JS PRNG runs
in lockstep with MAME even in the spawn-heavy fields, measured). Remaining: promote the specific routines each tape exercises from `[code]` to `[seen]` — a per-tape
reach map, still owed.
