# Time Pilot — mechanisms

The inside-out map: what the ROM does, as far as the decompiled layer can show. Its outside-in
counterpart is [gameplay.md](gameplay.md), assembled from public sources before anyone read the ROM;
where the two disagree this file says so rather than quietly siding with one.

**Rewritten from scratch each understanding pass, never edited.** A map that lags the code is the
tell that a pass was left half-done.

**Confidence.** `[seen]` means observed under real MAME; `[code]` means understood from the routines
that touch it. A measurement taken from our own JS machine is `[code]`, not `[seen]` — our machine
is the thing under test, so a count from it cannot ground itself. Only MAME is the oracle.

---

## 1. The two-level sequencer

- **`SEQUENCE_PHASE` (0xA9AB)** — outer phase; the vblank service masks it to two bits and
  jump-tables on it. `advanceSequencePhase` steps it and restarts the inner.
- **`SEQUENCE_SUBSTEP` (0xA9AC)** — inner index, consumed with *different masks* by different
  readers, which is what per-phase table sizes look like. `advanceSequenceSubStep` steps it alone.

Every phase-entry site writes the pair in one idiom: outer to a constant, inner to zero.

### 1.1 The phase byte is booby-trapped

Several routines fold a block of ROM into `SEQUENCE_PHASE` and store it back with a constant chosen
so the fold **nets to zero on a genuine image**. Anti-tamper: a patched ROM corrupts the phase and
derails the state machine rather than failing cleanly. Most of `advanceSequencePhase`'s callers sit
behind such a fold and are dead on a genuine image, so **counting callers to judge importance
misleads here.** `[code]`

---

## 2. The command ring

| cell | role |
|---|---|
| 0xAC00.. | the ring: 64 bytes, so 32 two-byte entries; **free while the high bit is set** |
| 0xA9B2 | write cursor, masked, always even |
| 0xA9B3 | read cursor |

`postCommand` appends a (command, argument) pair and **drops it** if the cursor's cell is occupied.
The drain releases both cells and dispatches the command's low nibble through a sixteen-entry table.
Polarity is fixed outside the poster: init fills the ring free, the drain restores it. **Not the
sound ring.** `[code]`

> **Reading the ring from outside is harder than it looks.** The drain releases cells by setting
> the high bit, and those writes interleave with a poster's two — so pairing (command, argument)
> live, as a tap sees them, silently attributes a drain byte to a command. Log raw writes and
> reconstruct afterwards. `[seen]`

---

## 3. Scoring

Command 4 indexes a BCD table by its argument. The table reads **100…900, 1000, 1500, 2000, 3000,
4000, 5000** — recovered from ROM bytes. It is a SUPERSET of `gameplay.md` §9's Centuri chart:
every charted value appears, but 200 through 900 appear nowhere in the chart.

`postChainedHitScore` ramps. A kill inside the chain window posts the next entry; an isolated kill
posts the first. The reset that restarts the chain lives **outside** the poster, in a per-frame
routine on the play arm's call list — and that placement is observable, not merely inferred: a step
planted at an arbitrary frame is wiped before any kill can use it. `[seen]`

The code encodes its scoring split as a **slot range** under a collision master and never names an
object class, so "common enemy" is the manual's word rather than the ROM's, and this poster serves
more than one object array.

> **THE RAMP AND ITS CEILING, BOTH SETTLED UNDER MAME. `[seen]`**
>
> Isolated kills pay the first entry — the manual's figure. Kills a handful of frames apart pay the
> second, then the third. **At the top it WRAPS and the counter keeps going:** consecutive posts in
> one live chain run the last entry, then the first again, then the second. The step counter does
> not saturate; only the argument cycles. A reader who assumed the counter pins would predict the
> top award repeating, and it does not.
>
> **Reached in ORDINARY PLAY, with nothing poked.** One driven chain climbed the fourth, fifth,
> sixth, seventh and eighth entries on consecutive posts and then paid the FIRST again, and the one
> after that paid the second — the step counter reading one and two past the table length while the
> argument cycled. No seeding, no poking, a single tapped-fire tape.
>
> The tape can also seed a live chain to force the boundary, and that option is kept because it
> reaches the top on demand rather than on luck. It turned out not to be needed for this claim.
> Re-run `tools/lua/ramp_ceiling_tape.lua` rather than trusting this paragraph.

> **★ COMMAND 4 HAS MORE THAN ONE POSTER.** Arguments beyond the chain's range appear with no chain
> running — the fixed awards for bomber, formation and Mother-Ship kills, posted through the same
> command. Two consequences: anything that infers "a kill happened" from a command-4 post
> **overcounts** the chained path, and `postChainedHitScore` must not be described as owning the
> command. `[seen]`

**The parachutist ladder is a second ramp of a different shape** — a per-pickup counter walks a
short table and then pins at the top value, so it CAPS where this one WRAPS. `gameplay.md` §9
already records that ladder as capped, so the ROM and the public record agree.

---

## 4. Objects

### 4.1 Two parallel tables

A **record** (16-byte stride, `ix`) and a **sprite entry** (2-byte stride, `iy`).
`advanceToNextSlot` steps both — a *slot*, not necessarily an object, since consecutive slots can
hold one multi-tile sprite that `placeAbuttingTile` builds by seeding the next entry from the
current one.

| record off | meaning |
|---|---|
| +0 | state: 0 free, 254 held, 255 live, 240 destroyed |
| +1 | aim heading |
| +2 | current heading |
| +3, +5 | sub-pixel remainders |
| +0x0A..0x0D | velocity pair |
| +0x0E | release / cooldown delay |

`releaseHeldObject` ticks that delay and promotes held→live on expiry. Sprite entry: `+0` and `+49`
the coordinate whole-parts, `+1` tile code, `+48` control — the halves 48 apart because they shadow
two banks.

**The destroyed code is not removal.** A separate routine converts it into a countdown and only
then retires the slot, so "destroyed" begins an animation rather than freeing anything. `[code]`

### 4.2 The sprite shadow and the display

The shadow is copied into sprite RAM every frame at an offset, through **two DMA variants** selected
by the screen-flip flag. Composed with the renderer:

- **main variant** — the shadow byte **is** the raster row.
- **mirrored variant** — the raster row is one greater.

Both park a zeroed slot at the **top**, one row apart; neither puts it below the last line.
`hideAllSprites` zeroes the whole vertical band and touches no occupancy byte, so everything hides
and nothing retires. The mirrored variant is rare but real — a zeroed slot's bottom row can land on
the first visible line there. `[code]`

The shadow block is **not contiguous** in sprite RAM: the scenery slots land in two runs, a short
one and a longer one. That split is what §4.4's raster trick has to work around, and it is why the
slot list there looks discontinuous. `[code]`

### 4.3 Steering and the world scroll — the camera

1. A heading is a **full-circle byte**: 256 steps, a quarter turn is 64.
2. `steerTowardAimHeading` turns one step the short way round, idle inside a four-wide arrival
   window, at a rate from a five-entry table.
3. `velocityForHeading` returns **two components a quarter turn apart**. Every selectable table
   holds a NEAR-constant magnitude around the circle — not exact; anomalous words widen the spread
   — with one table close to a pixel per frame in 8.8 fixed point. Speed times unit direction.
4. Another routine negates that pair into 0xA808 / 0xA80A, and `driftWithWorldScroll` adds those to
   every world-static object.

**Negated player velocity applied to everything else is the camera.** `gameplay.md` §4 records the
same thing independently: the background moves opposite the plane. `[code]`

#### The camera has FOUR parallax rungs, not one

`driftWithWorldScroll` is only the ×1 rung. Three sibling wrappers apply a *fraction* of the same
displacement pair to the same split-coordinate layout, each through its own arithmetic helper:

| rung | wrapper | helper |
|---|---|---|
| ×1/2 | not yet lifted | `displaceByHalf` |
| ×3/4 | not yet lifted | `displaceByThreeQuarters` |
| ×1 | `driftWithWorldScroll` | — applies the pair inline |
| ×5/4 | not yet lifted | `displaceByFiveQuarters` |

Only the helpers and the ×1 rung carry names today; the three fractional wrappers are still address
routines, so this table does not invent names for them.

**The helpers know nothing about any of this.** They read no scroll cell, touch no object, and write
no memory — they are pure arithmetic on a coordinate and a displacement, and the memory traffic
belongs entirely to the wrapper. That division is why they are named for their fraction and not for
the camera. `[code]`

**The four rungs are one family by arithmetic, not one dispatch group.** The ×1 rung runs far less
often than the fractional three and is reached another way entirely, serving world-static objects
rather than the scenery list. Each helper is called exactly twice per wrapper dispatch, which is the
two axes. `[seen]`

> ★ **A measured ratio that is really a COVERAGE result.** The era dispatcher's lists are not all the
> same shape: four of the five eras give the fractional rungs in a one-to-two-to-one proportion, and
> the last era gives them in equal proportion. A MAME sweep measured the three rungs in an *exact*
> one-to-two-to-one — which the lists therefore do NOT predict, and which could not have come out
> exact if the run had spent any time in the last era.
>
> So the exactness is not a confirmation of the structure. **It is evidence the sweep never reached
> the last era at all**, and that is a gap in every reachability number taken from that run. Read it
> as coverage, not as agreement. `[seen]` for the measurement; the era-shape difference is `[code]`.

The rounding is **asymmetric and looks deliberate**: the half and three-quarter forms round up,
because they subtract a floored fraction, while the five-quarter form floors, because it adds one.
Nothing here claims the asymmetry was intended.

**This is a parallax depth stack, and the depth tracks sprite size.** An era-keyed dispatcher reads
the round index and selects one of three handler lists; every list fills the same scenery block.
Bigger sprites take the faster rungs and smaller ones the slower, with the action plane at ×1 —
so scenery nearer the eye sweeps past faster. The art in those slots decodes as clouds in the early
eras and an asteroid field in the last, which is what `gameplay.md` §5 describes from the outside.
`[code]`

A fifth relative exists and is not a rung: `flyAlongHeading` adds the full scroll pair **and** the
object's own heading velocity in a single add. Anything that calls it must not also drift the
object, or the camera is applied twice.

### 4.4 A second appearance, bought with the raster

Two routines give the scenery slots a **second appearance half a screen away in both axes**, by
editing a slot's coordinate bytes after the beam has already drawn it. They are near-twins over the
same slots in the same order, and they differ in exactly one thing:

- one **spins** until the beam has passed a slot's last line, and
- the other **skips** a slot whose beam has not arrived yet.

A slot whose request bit is clear is left alone by both. The skipping form is reached from more call
sites, and one straight-line run of them is transcribed as a table of (target, return) pairs rather
than as call instructions — so a grep for the mnemonic misses most of its callers and a count taken
that way is badly low. `[code]`

> ★ **Which of the two actually runs more often is NOT established, and two instruments disagree
> about it in opposite directions.** Both forms wait on the beam, and a PC-gated tap cannot tell a
> dispatch from another turn of a spin — so it reports the *spinning* form as far busier, while a
> dispatch count taken inside our own machine reports the opposite. Neither reading is a dispatch
> count for a routine that spins. See §8; do not quote a frequency for either of these.

> **The idiomatic layer does not model the wait.** Memory-equivalence per dispatch holds, but the
> second appearance is a consequence of *when* the edit lands relative to the beam, and our layer
> has no beam. The modules say so and their gates measure the cost rather than papering over it.

### 4.5 The era index

**0xAD04 is the round/era index.** It is stepped as a **mod-5 counter** and reloads per-round
parameters in the same breath; its caller chain runs off the Mother-Ship award, so destroying the
Mother-Ship advances the round. It selects the turn-step table, the velocity amplitude, the parallax
handler list, and several jump tables. `gameplay.md` §5 and §11 describe five eras in strict order
wrapping to the first, with speed and manoeuvrability rising — written before anyone read the ROM.

The routine that forces it to a fixed value around a single steering call is a **temporary
override**, not the writer. **A grep for a direct store misses the real one, which writes through a
pointer** — so anyone re-deriving this must search for the pointer form or they will conclude the
cell has a single writer and strike the era reading as unearned. `[code]`

### 4.6 Retiring

An object leaves play when a coordinate reaches a **retire line** — one per axis, three values wide
so a fast mover lands on it. The lines are the **antipode of the player's own position**, which
per-life setup pins and the per-frame update never rewrites. A wrap seam, not a viewport edge.

Two helpers plus a third site that inlines the same stores; no file calls more than one, so the
caller sets are statically disjoint — per-family helpers, not versions of one.

- **`retireSlot`** zeroes occupancy and both coordinate whole-parts.
- **`retireSlotAndSubPixel`** zeroes those and the sub-pixel remainders.

Observability depends on the spawn path: some reinitialise those cells right after marking a slot
live, most do not. Where they do not, what a retire left behind becomes the next occupant's starting
accumulator phase.

> **Open.** Whether the families were meant to differ, or whether this is two habits.

---

## 5. Shots and collision

`destroyTargetsHitByShots` sweeps a run of shot slots against a run of target slots. The outer array
is always the player's shots and only the inner list varies across its callers, which is what fixes
the sweep's direction. A shot is armed only on a fire-button **rising edge**, though the routine that
owns those slots writes them every frame — so a sparse arming sits inside a dense write set, and an
instrument that watches writes will not see the edge.

A target that is reached is destroyed **together with the shot that reached it**, and the sweep does
not stop there: one shot can take several targets in a pass and is paid for each. `[code]`

**This is not the only collision path.** At least one other routine tests and destroys inline, so a
capture that only watches score cells cannot attribute a kill to this routine. That is why nothing
here is `[seen]`.

---

## 6. Input and credit

| cell | role |
|---|---|
| 0xA9AE | IN0 mirror, rewritten every frame — shows what the panel asserts, never what the machine decided `[seen]` |
| 0xA981 | set when the machine **accepts** a coin, debounced rising edge `[seen]` |
| 0xAD30 | set while play is active `[seen]` |

The first row's distinction is load-bearing: the mirror proves a button was down and nothing more.
The pixel gate asserts all three, because a tape that never reaches the machine leaves both
emulators in attract with every frame matching.

`readPlayerControls` returns the **whole panel word** for whichever panel faces the picture, choosing
between two frame mirrors on the screen-flip flag — which the vblank service latches into the LS259
bit MAME reads back as flip-screen. The two mirrors are the mono panel and its cocktail twin, so the
swap happens exactly when the cabinet is a cocktail and it is the second player's turn. Its callers
then split the word three different ways: the stick nibble, the fire bit edge-detected into a
three-shot burst, and — in initials entry — several individual bits, each into its own one-bit
edge history. `[code]`

---

## 7. Text and captions

A cursor in `DE` walks character cells; one cell is 32 addresses back down the tilemap, and under
ROT90 that is one cell **right** on the display — so `advanceCharCursor` is reading order and
`retreatCharCursor` its exact inverse. At least one leading-zero suppressor calls the retreat so a
following advance nets to zero; whether every suppressor does is not established.

`drawTextRun` copies one glyph run into the character and colour planes; its wrappers are what walk
the record table and choose which run. The
runs decode, through the board's own tile layout, as the game's English captions — and two of them
spell the exact bonus settings on the DIP switch, which is an independent hit on the public record.
**Two records are not text at all:** they select second-bank tiles with three pen levels, forming a
shaded banner where a byte is a piece of a letter rather than a character. The name covers the
common case and not that one. `[code]`

`stampCopyrightStrip` places caption glyphs into the display-list shadow, **and it really runs** —
a PC-gated sweep of the real machine dispatches it steadily. Those sprites are nevertheless never
visible: hiding them changes zero pixels, while blanking the tilemap cells over them changes
hundreds. The cells are category 1 and painted opaquely over sprites in a later pass, so the glyphs
are **written and occluded**, not never written. `[seen]` for the dispatch, `[code]` for the occlusion.

`fillCellRun` lays a fixed-length uniform run, used with a blanking glyph in the character plane and
a computed colour in the colour plane. **Nothing has ever been observed dispatching it** — and the
reason is now known for one of its two call chains.

> **It is a REPAIR path, which is why it never fires.** A routine that IS reached walks the very
> run `fillCellRun` writes — same length, same backward stride, in the colour plane — comparing each
> cell against an expected colour, and tail-jumps to the fill the moment one does not match. The
> scan and the fill are a check-then-repair pair. Under every tape the strip is already correct, so
> the guard falls through every time. **A routine can be live, correct, fully understood and still
> never dispatch, because its job is to fix something that does not go wrong.**
>
> This was found by tracing the call graph after guessing at game states failed: free play was
> enabled by name and driven for minutes, and neither the fill nor initials entry was reached.
> Sweeping every caller localised it to one conditional. `[seen]` for the reachability,
> `[code]` for the guard.
>
> **Scope.** This speaks only for that chain. `fillCellRun`'s other root and its two callers are
> entirely unreached and may fill a different strip. And "the strip is always correct" is inferred
> from the branch never being taken, not observed on the cells themselves.

---

## 8. Reachability

A PC-gated sweep over the unnamed routines, driven through play, finds a majority executing and a
substantial minority not. Re-derive with `tools/reach_sweep.lua`; the hot tail is the backlog worth
taking next. Pick a batch by intersecting the leaf set with **measured execution**: a leaf nothing
dispatches is a slot spent for nothing, and roughly half of any size-ordered candidate list is dark.

**The instrument lies on this game unless gated.** A plain read tap counts *any* read of an entry
byte, and this ROM folds blocks of itself for anti-tamper (§1.1) — so an ungated sweep reported
**every** unnamed routine as reached, including routines independently proven dark. The tool now
requires the program counter to be at the address. Its header warned about the mirror failure
(encrypted opcode regions making everything look unreached); the prescribed sanity check, tapping a
known-executing address, is blind to this direction.

★ **A PC gate still cannot tell an entry from a loop head.** A back-branch to an interior address
counts as a dispatch, which is how an interior block once looked like a live routine. Confirm that a
hot address is an entry — something must *call* it — before spending a batch slot on it.

★ **AND IT CANNOT COUNT A SPINNER.** Where a routine waits on the raster, the program counter passes
its entry region on every turn of the wait, so the tap reports iterations of a spin as though they
were dispatches. The effect is not subtle: an address our own machine measures at zero dispatches
reports tens of thousands of PC hits, purely because it lies inside a busy spin. **A hit count is
only a dispatch count for a routine that does not wait.** For anything that does, the decidable
facts are the static call sites and the structure of the wait — use those instead, and say which
you used.

---

## 9. What is not established

- ★ **The last era is not reached by the driver.** §4.3 shows why: the rung proportions differ in
  that era, and the measured proportion is the one the other four produce. Every reachability
  number in this file comes from runs with that gap in them, so a routine used only in the last era
  would read as unreached. Nothing here has been shown to be dead on that evidence alone.
- **Which physical axis is which** — under ROT90 the labels invert and the shadow-to-bank path is
  not traced end to end.
- **Whether the retire helpers' sub-pixel difference is intentional** (§4.6).
- **What each individual substep value selects** (§1). The walk the phase/substep pair takes is now
  observed — four outer modes, and an inner cycle that returns to a mid value once per life — but
  what any one substep *selects* is not established, and the differing consumer masks mean it may
  not be a single sequence at all.
- **`fillCellRun`'s other call chain** (§7). One chain is now understood as a repair guard. The
  other root and its two callers are unreached by every instrument pointed at them, including a
  driven real-machine sweep under free play with sibling text routines in the same run proving the
  tap fires. Initials entry was never reached either, so a routine used only there would still read
  like this.

## 10. Known defects in the frozen layer

- A routine declares a range stopping short of where its body runs on, and another is a byte-exact
  interior slice of a third — the same tail transcribed three times. Dispatch is by address and
  every entry resolves to a body starting there, so nothing misbehaves.
- Overlapping declared ranges are widespread rather than isolated, and `stepcheck` is blind to
  duplication: it only asks whether a target is an instruction start. Re-derive the extent by
  parsing the range headers; do not trust a figure written here.
