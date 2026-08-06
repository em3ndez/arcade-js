# Time Pilot batch 2 — NAME PROPOSALS (not promoted)

Each derived by the single agent that wrote the routine. R11 keeps a decompile batch on
`loc_<addr>`; R4 requires a SEPARATE confirmer before promotion, and R5 wants the corroboration in
a `why` field. These are proposals for that pass, not decisions.

| addr | proposed | note from the deriving agent |
|---|---|---|
| 0x0010 | `fetchWordTableEntry` | pairs with 0x0008's byte-table form; callers disagree on the effect (jump target, record walk, coordinate split), so named at the fetch |
| 0x0028 | `retreatCharCursor` | mirror of 0x0020's `advanceCharCursor`; direction measured three ways incl. a pixel test |
| 0x018c | `fetchTableWord` | seven callers use the result three different ways; mechanism-level by necessity — flagged for the confirmer |
| 0x0b06 | `showCopyrightCredit` | strip rendered as `© KONAMI`; counterpart 0x0B2B hides it. Fallback `stampCaptionStrip` |
| 0x0f11 | `advanceSequencePhase` | outer phase; proposes `SEQUENCE_PHASE` for 0xa9ab beside the existing SEQUENCE_STEP |
| 0x1319 | `fillCellRun` | not `blankCellRun` — blanking is only one caller family's use |
| 0x15b6 | `hideAllSprites` | parks its slots ABOVE the first visible line (zero shadow maps to row zero); touches no occupancy byte, so distinct from the retire pair |
| 0x2b52 | `releaseHeldObject` | ticks a hold delay, promotes the state code on expiry |
| 0x2bef | `steerTowardAimHeading` | turns one step the short way round; the rate comes from a small table indexed by a mode cell whose only writer sets it around a single call, so "stage" is unearned |
| 0x3058 | `placeAbuttingTile` | sibling 0x308a is the diagonal form; share the verb |
| 0x51de | `awardChainedHitScore` | the manual's flat 100 is the base and correct for an isolated kill; the ROM adds an undocumented ramp on top — see Open Questions |
| 0x596e | `velocityForHeading` | the two components track a near-constant amplitude across the heading range, so they read as perpendicular parts of one vector; the quarter-turn relation held on every real dispatch measured and on the full crafted sweep. Amplitude is not exactly constant — a handful of anomalous ROM words widen the spread |

## Open questions this batch raised, for the understanding pass

- **Scoring ramp, undocumented rather than contradictory.** The manual's 100 is the base and is
  right for an isolated kill; the ROM adds a ramp for consecutive hits inside the chain window,
  wrapping rather than capping. Experiment: two planes in quick succession under MAME, read the score.
- **Anti-tamper.** The outer sequence phase is routed through six net-zero ROM checksums, and six
  of 0x0f11's seven callers are checksum-failure paths, dead on a genuine image.
- **Lift-layer overlap.** `loc_49fa` declares 0x49FA-0x4A0E but runs on through 0x4A9C, and
  `loc_4a42` is an interior slice of `loc_4a0f` — the colour-paint tail is transcribed three times.
- **Cycle-model edge.** A collapsed multi-byte read diverges from the oracle if a caller aims it at
  the port block, where the raster register ticks between the two byte reads.
