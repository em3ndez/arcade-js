# Time Pilot understanding pass 2 — CONFIRMED names

R4's separate-confirmer artifact for batch 2's twelve. Proposals are in
`timeplt-batch2-name-proposals.md`, written by the twelve agents that wrote the routines. The
confirmer derived each routine, its callers and the ROM bytes BEFORE reading the proposal.

Four rejected, eight confirmed. All twelve `code` — no batch-2 gate touches MAME.

| addr | proposed | verdict | confirmed |
|---|---|---|---|
| 0x0010 | `fetchWordTableEntry` | **REJECT** | `fetchTableWord` |
| 0x0028 | `retreatCharCursor` | CONFIRM | `retreatCharCursor` |
| 0x018c | `fetchTableWord` | **REJECT** | `fetchWideTableWord` |
| 0x0b06 | `showCopyrightCredit` | **REJECT** | `stampCopyrightStrip` |
| 0x0f11 | `advanceSequencePhase` | CONFIRM | `advanceSequencePhase` |
| 0x1319 | `fillCellRun` | CONFIRM | `fillCellRun` |
| 0x15b6 | `hideAllSprites` | CONFIRM | `hideAllSprites` |
| 0x2b52 | `releaseHeldObject` | CONFIRM | `releaseHeldObject` |
| 0x2bef | `steerTowardAimHeading` | CONFIRM | `steerTowardAimHeading` |
| 0x3058 | `placeAbuttingTile` | CONFIRM | `placeAbuttingTile` |
| 0x51de | `awardChainedHitScore` | **REJECT** | `postChainedHitScore` |
| 0x596e | `velocityForHeading` | CONFIRM | `velocityForHeading` |

## The rejections

**0x0010 and 0x018c were a collision.** The proposals were `fetchWordTableEntry` and
`fetchTableWord` — the same words re-ordered, for a pair a reader cannot otherwise tell
apart. Worse, the elaborate name landed on the hot one and the plain name on the rare one. They do
differ mechanically: 0x018c propagates the carry out of the index doubling and so admits a table
wider than 128 entries, where 0x0010 discards it. No call site exercises that difference, which is
precisely why the names have to carry it. Renamed so the set reads with batch 1's `fetchTableByte`.

**0x0b06 does not `show` anything.** Rendering frames with those four sprite entries hidden changed
**zero pixels**, at every frame tested. The covering tilemap cells are category 1 and paint over
sprites in a later pass; blanking the tiles instead changed 919 pixels. The strip is stamped into
the display list and then occluded on every path reached. `stamp` names what happens.

**0x51de posts, it does not award.** Its whole output is one call to `postCommand`, whose own
promoted role says it drops the pair when the ring cell is still occupied. The handler also returns
without scoring while play is inactive. Batch 1 already established the verb.

## Grounding recovered during the pass

- The scoring table the command indexes reads 100…900, 1000, 1500, 2000, 3000, 4000, 5000 — the
  Centuri chart in `gameplay.md`, recovered from ROM bytes without reference to the manual. 0x51de
  posts arguments in the common-enemy band; the bomber, formation, Mother-Ship and parachutist
  values are posted as fixed arguments elsewhere. So the ramp is confined to common enemies, which
  sharpens the outstanding experiment.
- All four velocity tables hold a constant magnitude across the full heading circle (206 / 256 /
  306 / 331), and 256 is exactly one pixel per frame in 8.8 fixed point. That is speed times unit
  direction, which is what earns the word velocity.
- The four caption shapes decode out of the sprite ROM as the glyphs of the copyright strip, in
  placement order — content established from data rather than inferred.

## Corrections the confirmer made to this pass's own artifacts

- **`0xAD04` has a second writer and it settles the cell.** `loc_2db8` reaches it through HL as a
  mod-5 counter, reloads per-round parameters, and its caller chain posts the Mother-Ship award.
  Five values, five eras, a five-entry turn-step table and three speed tables selected by it, and
  `gameplay.md` says five eras with rising speed written before anyone read the ROM. The routine
  everyone found, `loc_29f7`, is a temporary override rather than the writer -- and a grep for a
  direct store misses the real one, which writes through a pointer.
- One gate header named a caller that does not call the routine — adjacency mistaken for a call.
