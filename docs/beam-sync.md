# Beam sync — reproducing mid-frame, beam-timed video in the clock-free layer

A per-game convergence technique, sibling to **entropy pinning** and the **vblank-yield**
(both in `idiomatic-generation.md`). Reach for it when a game changes video state *during*
the visible frame, in step with the raster beam, so different scanlines show different RAM.

## The problem

The idiomatic (generator) engine runs game logic clock-free and paints **one snapshot per
frame** at the vblank yield. That is exact for a game whose video RAM is settled during
active display. It is **not** exact for a game that mutates video state mid-frame synced to
the beam — the snapshot keeps only the last state, so everything the beam drew earlier is
lost. Known forms of the trick: **sprite multiplexing** (one hardware slot drawn at two
positions), raster split-scroll, status-bar splits, mid-frame palette/color bars.

The game does it by **polling the scanline/beam register** and acting once the beam passes a
threshold. A cycle-accurate renderer (our oracle, and MAME) draws each band from the RAM
current when the beam reached it, so it reproduces the trick and matches. A single end-of-
frame snapshot cannot.

## The mechanism: the beam-yield

Beam sync is the **scanline-granular sibling of the vblank-yield**. The vblank-yield makes a
spine routine a generator that `yield`s at the vblank wait; the engine samples, fires the
NMI, advances one frame. The beam-yield does the same one level finer:

> A beam-sync wait routine `yield`s `{ beam: row }` at the point it waits for the beam. The
> engine renders rows `[lastRow, row)` from **current** RAM (`renderRowsRGB`) into an
> accumulating frame buffer, advances the beam counter to `row`, then resumes the routine.
> The vblank-yield paints the final band `[lastRow, bottom)`. The frame image is the sum of
> the bands, each captured at the beam position the game itself waited for.

So `beam-yield : scanline :: vblank-yield : frame`. Because the yield carries the row
explicitly (computed from RAM the game already holds), the technique does **not** depend on
`this.cycles` being faithful through collapsed delays — the collapse the clock-free layer
relies on stays intact.

## What each game needs

**A `manifest.convergence.beam` profile** (beside the go-live block under `manifest.convergence`;
entropy pinning is the sibling technique, declared at manifest top-level):
- the beam/scanline register — address, read decode, and the beam→row map (`vpos`), the
  visible window and vblank line;
- the per-band renderer `renderRowsRGB(out, y0, y1, mem, gfx, opts)` as the contract (the
  board's snapshot renderer becomes `renderRowsRGB(out, 0, H-1, …)`);
- the video-state set the renderer reads (already defined per board).

**Idiomatic authoring** — the game's beam-sync wait routines are written as generators that
`yield { beam: row }` instead of collapsing the wait, exactly the discipline already used for
vblank waits. This is the only per-game code work; the pattern is generic.

**Engine (`core/frame-stepped.js`, additive to `runGeneratorGame`)** — a beam-yield branch:
when `gen.next()` returns a `{ beam }` value, render the band and resume **without** counting
a frame or firing the NMI. A plain (vblank) yield still yields nothing and takes the existing
path unchanged, so the vblank-yield and entropy-pin paths are untouched.

## The fast path — non-beam games cost nothing

A game that never beam-yields produces exactly one band — the whole frame at the vblank yield
— which is byte-for-byte today's single snapshot. Beam sync is opt-in *by the routines that
yield*; a game that does not need it pays nothing and changes not at all.

## Validation

- The **oracle** (cycle-accurate, per-scanline, ~100% vs MAME: 107967/108000 frames byte-identical,
  band gate 0-over) is the reference: a
  beam-synced idiomatic render must equal it per scanline.
- **`confirm600.py`** generalizes as the gate — run the idiomatic layer long against a MAME
  golden, RAM first then pixels; the mid-frame residual must fall to ~0.
- **Positive control**: force the single-snapshot path and confirm the residual returns —
  an absence of divergence counts only if the instrument was shown able to detect it.
- The reworked routines must leave the **final** RAM byte-identical to before (game state is
  unchanged; only render timing differs). Check it the equivalence-test way.

## Reference case: Time Pilot's cloud multiplexer

Eight scenery slots are drawn up to sixteen times: the foreground polls the scanline counter
(read side of 0xC000) and, once the beam passes a slot, relocates it half a screen in both
axes and re-serves it (`mechanisms.md` §"The cloud multiplexer"). The idiomatic layer first
**collapsed** this — `multiplexSpriteSlots` applied every relocation at once and kept only the
far-half positions, so the snapshot lost the near-half (upper) clouds: ~1,100 px/frame,
upper rows only, every one a cloud, RAM otherwise byte-identical over a 600 s run. Time Pilot
is the proving ground for the beam-yield; each later game that beam-syncs declares its profile
and yields, and inherits the same engine path.
