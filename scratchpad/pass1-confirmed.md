# Time Pilot understanding pass 1 — CONFIRMED names

R4 requires a promotion to appear in both a proposals file and a separate confirmed file, written
by distinct agents. The proposals are in `timeplt-batch1-name-proposals.md`, derived by the ten
agents that wrote the routines. This file records the confirmer's independent verdicts — it derived
each routine and its callers before reading the proposal, so the two derivations are independent.

Four of ten proposals were REJECTED. Three carried inflated `[seen]` tags on evidence that never
touched MAME; all ten are `[code]`.

| addr | proposed | verdict | confirmed name |
|---|---|---|---|
| 0x0008 | `seekTableEntry` | **REJECT** | `fetchTableByte` |
| 0x0018 | `offsetAddress` | CONFIRM | `offsetAddress` |
| 0x0020 | `advanceCharCursor` | CONFIRM, cert corrected | `advanceCharCursor` |
| 0x0038 | `postCommand` | CONFIRM | `postCommand` |
| 0x0f1a | `advanceSequenceStep` | **REJECT** | `advanceSequenceSubStep` |
| 0x2b60 | `driftWithWorldScroll` | CONFIRM | `driftWithWorldScroll` |
| 0x2b83 | `hasReachedRetireLine` | CONFIRM, cert corrected | `hasReachedRetireLine` |
| 0x2bde | `despawnObject` | **REJECT** | `retireSlotAndSubPixel` |
| 0x309b | `advanceToNextObjectSlot` | **REJECT** | `advanceToNextSlot` |
| 0x40ab | `retireSlot` | CONFIRM | `retireSlot` |

## Why each rejection

**0x0008 → `fetchTableByte`.** The proposal names the pointer move and demotes the fetch. Most call
sites consume the returned byte immediately; only a few read on through the surviving pointer. It
also breaks the family: 0x0010 and 0x018c both read as "fetch what an index selects", and this is
the byte-table member of exactly that family. A caller writing `seekTableEntry(m)` would not expect
a byte back.

**0x0f1a → `advanceSequenceSubStep`.** The cell it steps is the INNER index of a two-level machine
whose outer phase is a different cell. Put `advanceSequenceStep` beside the routine that advances
the outer phase and a reader takes this one for the sequence advancer — when it advances the half
that gets discarded whenever the sequence really moves. That inversion is the kind downstream work
trusts silently.

**0x2bde → `retireSlotAndSubPixel`.** `retireSlot` and `despawnObject` are synonyms carrying none of
the distinction between them. No file calls both — the caller sets are statically disjoint, so these are two object families,
each with its own helper — and the difference is that this one also zeroes the sub-pixel remainders.
Naming the superset explicitly is what stops a reader treating them as interchangeable. They are
not: where a spawn path does not reinitialise those cells, using the three-store form on the other
family's slot leaves the next occupant a stale accumulator phase.

**0x309b → `advanceToNextSlot`.** "Object slot" tells the reader this reaches the next object. It
often does not: one caller uses it to step onto a further tile of a sprite it has just placed. The
callers genuinely disagree about what the next slot holds, so the mechanism-level name is correct.

## Cert

All ten are `[code]`. Nothing in the batch touched MAME — the harness builds a JS machine over the
generated registry and drives a JS-side tape. Three proposals said `[seen]`.

## Deliberately NOT named

The confirmer declined to name the two object families (the shapes suggest player-owned projectiles
versus enemies) on the grounds that an identity code cannot settle, and downstream work will trust,
must be grounded before it enters a name.
