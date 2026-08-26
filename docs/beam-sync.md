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

## The mechanism: the band painter

Beam sync is the **scanline-granular sibling of the vblank-yield** — one level finer, and in the
render rather than the engine:

> A **band accumulator** lives on the machine: `startBeamFrame` opens a buffer, `paintBeamBand(row)`
> paints rows `[lastRow, row)` from **current** RAM (`renderRowsRGB`), `finishBeamFrame` paints the
> last band `[lastRow, bottom)`. Once per frame, after the game's work, a per-game beam-sync routine
> walks the beam positions the game acted on — in beam order — calling `paintBeamBand` at each. The
> frame image is the sum of the bands, each captured at the beam position it belongs to.

So `band : scanline :: frame : vblank`. Because each band's row is computed from RAM the game already
holds, the technique does **not** depend on `this.cycles` being faithful through collapsed delays — the
collapse the clock-free layer relies on stays intact. **No engine change**: the band painter is a
machine method the game's per-frame code calls.

## What each game needs

**A `manifest.convergence.beam` profile** (beside the go-live block under `manifest.convergence`;
entropy pinning is the sibling technique, declared at manifest top-level):
- the beam/scanline register — address, read decode, and the beam→row map (`vpos`), the
  visible window and vblank line;
- the per-band renderer `renderRowsRGB(out, y0, y1, mem, gfx, opts)` as the contract (the
  board's snapshot renderer becomes `renderRowsRGB(out, 0, H-1, …)`);
- the video-state set the renderer reads (already defined per board).

**The band accumulator** (machine methods `startBeamFrame` / `paintBeamBand` / `finishBeamFrame`,
reusing `renderRowsRGB`). The render driver opens the frame, the game paints bands, the driver
finishes at the vblank. Generic and additive: `finishBeamFrame` with no bands painted is exactly
`renderFrameRGB`, so the vblank-yield and entropy-pin paths are untouched.

**A per-game beam-sync routine** run once per frame that calls `paintBeamBand(row)` at each beam
position the game acts on. For a slot multiplexer (Time Pilot), the routine reconstructs each
recorded relocation's first appearance and, in beam order, paints the rows above its flip line then
restores the second — **state-neutral**, so the frame's RAM is unchanged. This is the per-game work.

## The fast path — non-beam games cost nothing

A game that never paints a band leaves `finishBeamFrame` to render the whole frame `[0, H-1]` —
byte-for-byte today's single snapshot. Beam sync is opt-in *by the game calling the band painter*;
a game that does not need it pays nothing and changes not at all.

## Validation

- The **oracle** (cycle-accurate, per-scanline) is the reference: a beam-synced idiomatic render
  must equal it per scanline.
- **`confirm600.py`** generalizes as the gate — run the idiomatic layer long against a MAME
  golden, RAM first then pixels; the mid-frame residual must fall to ~0.
- **Positive control**: force the single-snapshot path and confirm the residual returns —
  an absence of divergence counts only if the instrument was shown able to detect it.
- The reworked routines must leave the **final** RAM byte-identical to before (game state is
  unchanged; only render timing differs). Check it the equivalence-test way.
