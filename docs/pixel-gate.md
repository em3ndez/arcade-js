# 6. The pixel gate

The final arbiter is the picture: does our frame look like MAME's frame? But "look like" needs a
precise definition, and there are two, used in different places.

## Byte-exact, where it must be

For deterministic stretches — the boot sequence, and any window where the two machines must agree
to the pixel — `tools/framediff.py` compares **byte for byte**. It applies a frozen frame offset
(the AVI lags the state by one frame; the offset is pinned, never auto-calibrated, because a
free offset can manufacture a green result over identical boot frames), compares raw bytes rather
than trusting any stored hash, and requires completeness in both directions (a short run can report
`PARTIAL` but never `PASS`). On the first divergence it reports the pixel count, the bounding box,
the tiles touched, and names likely whole-frame modes (a red/blue swap, a vertical flip, a row
shift) so the failing routine is easy to find.

## Rough tolerance, where reality is jittery

Requiring byte-exact equality *everywhere* is wrong. A single sprite one frame early — an artefact
of sub-frame timing that no player could see — would fail an otherwise-perfect translation. But
*unbounded* divergence (the screens drifting further and further apart) is always a real bug. The
rough gate distinguishes them:

> A frame may differ from MAME by a few pixels and still pass, **as long as the pixels don't
> diverge arbitrarily.** Concretely (`tools/pixel_gate.py`, which every game's suite calls): PASS iff
> no frame in the window exceeds **5%** of the frame. An EMPTY window is `INCOMPLETE`, never a pass —
> a run that died before the window began differs in nothing because it compared nothing, so a caller
> must consume the verdict rather than re-derive one from the max and the over-count.

The key word is *reconverge*. A translation that's right will differ from MAME only in brief,
bounded transients and then snap back to identical; a translation that's wrong will diverge and
stay diverged. The percent-of-frame threshold accepts the former and rejects the latter. (In
practice the bar is met with enormous margin — e.g. Donkey Kong's attract sequence runs
byte-identical to MAME on 727 of 728 frames, with a single 3-pixel, 0.005% transient.)

`games/dkong/tools/prize_suite.py` runs the same rough gate over the bonus-item pickups — Pauline's dropped
parasol/hat/purse, worth level-scaled points — across the boards that carry them (50m/75m/100m).
It applies the identical rule (max per-frame difference under 5%, no single frame over ~5%, from
frame ~1600) plus a pickup assertion the movement gate doesn't need: the prize slot at RAM
`0x6A0C` clears (its X byte drops to 0) and the BCD score at `0x60B2` grows by the level's point
value. Nine scenarios — `{50m,75m,100m} × {hat,parasol,purse}` — each with its own committed tape
in `games/dkong/tapes/`.

## Gameplay, not just attract (The Pit)

Attract is the easy half — it takes no input, so a golden captures itself. The gate that matters
runs the game. `games/thepit/tools/pixel_suite.py` drives **coin → start → dig** into both MAME
(the oracle) and the JS renderer on the *same* entropy-pinned input, and asserts the JS frame
buffer is byte-identical to MAME's, pixel-for-pixel, through the tunnelling gameplay — result:
every gameplay frame clean, 0 px. `render.js --pin` freezes the RNG the same way MAME's
`--pin-entropy` does, so the two stay in lock-step instead of drifting on random actor content.
It renders the *translated* layer; the idiomatic coroutine layer is separately proven byte-identical
to it over video RAM, so one gate covers both. BYO-ROM: the golden is captured live from your own
romset (never committed), and the gate SKIPs green if MAME can't verify it.

Two artifacts are handled in the open, not papered over — both instances of "the reading is the
instrument first":
- **A one-frame boot-transition phase.** One edge tile turns on a frame earlier in the JS render
  than in MAME (the frame-stepped boot phase differs by one) — cosmetically invisible, present in
  attract too. The diff window starts at frame 2 so *that* transient is excluded; a regression at
  any later attract-or-gameplay frame still fails. Skipping two boot frames is not "widening the
  tolerance" — the floor stays 0 px everywhere the game is actually drawing.
- **A false "watchdog reset" flag.** The golden tool's boot-signature heuristic fires on the
  coin/start frames, where the screen blanks and *looks* like boot. It is not a reset: the gate
  re-checks the STATE dump (work RAM at those frames is not the boot image; GAME_STATE steps
  0→3→1 normally) and only fails on a *real* reset (work RAM == boot).

## The discipline around the gate

Three rules keep the gate honest, each learned the hard way:

- **Never lower the floor.** If a frame fails, fix the engine — don't widen the tolerance to make
  it pass. The threshold is a property of the hardware's jitter, not a knob to reach green.
- **Calibrate once.** Constants like the frame offset are pinned and committed; re-deriving them
  per-run lets a bug hide inside a "recalibration".
- **Instrument for falsifiability.** A check that cannot fail proves nothing. Prefer diffs that
  would catch a planted error (that's what mutation testing verifies for the unit tests, and what
  the both-directions and no-auto-offset rules verify for the pixel gate).

## ★★ The gate is a PRECONDITION for the idiomatic layer, not a capstone after it

This picture-against-MAME gate is the falsifiable ground truth for idiomatic generation, and
per-routine memory-equivalence is the fast local proxy. That framing is right, and it is easy to
misread as *"run the proxy now, run the truth at the end."* Do not.

> **Before the first idiomatic module of a game is written, the pixel gate must be running and
> green, and it must stay running for the life of that layer.**
> Day-zero item 7 in [idiomatic generation](idiomatic-generation.md).

**Why the proxy cannot stand alone.** The two gates the idiomatic loop runs all day — the per-routine
equivalence gates and the assembled swap — compare RAM outside the stack window and a declared
live-out. **Neither looks at a pixel.** No idiomatic module spends T-states, by design, so
every rewrite is cheaper than its frozen twin: harmless under the cycle-free engine the swap gate
runs, and *not* harmless under the cycle-driven engine a player runs, where it shifts the foreground
phase, the NMI's interruption point, and what the beam has drawn when it fires. The DMA sub-frame
raster position has no owner among the memory gates at all.

So a layer built with this gate off can be green on every gate it runs and still wrong on the glass.

**And the cost of switching it on late is the bisect, not the run.** Many green routines and one
pixel diff is a search problem; one routine and one pixel diff is a bug report.

★ Written because it happened: Time Pilot's idiomatic layer ran a full day of batches — per-routine
gates green, whole-game swap green, suite green — while this gate was wired into nothing at all. It
was in no npm script, no hook and no Makefile target, so it ran only when a person chose to run it,
and for a day nobody chose to. **Before relying on this gate, check where it is wired** — that is
the durable question, and the answer changes. **Beware also that `make verify` is NOT this gate**
despite the name — it is `verify_decoder.py`, a disassembly check, and it defaults to `GAME=dkong`,
so on another game it does not even read your ROM. A green `make verify`
says nothing whatever about pixels.
