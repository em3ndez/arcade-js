# Time Pilot — how the machine actually works

A code-grounded model of Konami's Time Pilot (`timeplt`, 1982), built from the translated ROM, from
the routines the idiomatic layer has rewritten, and from observations of the real machine under
MAME. Its companion is `gameplay.md`, which describes the same game from the outside using only the
public record and deliberately knows nothing about the code. Where the two meet is the interesting
part: this document exists to answer the questions `gameplay.md` could not, and to be honest about
which ones it still cannot.

**Every claim carries a confidence tag, and the tags are not decoration.**

- **`[seen]`** — observed on the real ROM under MAME. Our engine may be in the chain, but the
  reference must be the real machine. A pixel diff against a MAME golden is `[seen]`.
- **`[code]`** — derived from the behaviour of a translated routine. The mechanics are exact,
  because the lift is faithful; the *role* is inference.
- **`[guess]`** — plausible and unverified. Not to be relied on.

**A number is `[seen]` only if its evidence chain terminates in MAME.** A dispatch count from our
own `Machine` replaying the ROM is our engine, however long the window, and an
idiomatic-versus-oracle equality is our JavaScript against our JavaScript. Both are good evidence
about the *port* and both are `[code]`. This is not pedantry: several claims in this document's
history were tagged `[seen]` on the strength of a measurement taken from our own machine, and the
error is invisible once written.

A wrong role stated confidently is worse than no name at all. Where the code cannot settle
something, this document says so rather than choosing.

**How this was written.** The method requires this file to be rewritten WHOLE each understanding
pass, from `gameplay.md`, blind to its previous version — never patched. A patch preserves the
previous reading's blind spots; a rewrite forces re-derivation. This revision honours that: the
previous map was not opened, and each of the eight area re-derivations behind it carried an explicit
prohibition against reading or citing it. Seven returned in time to inform the text; the eighth,
on the character plane, arrived after §8 had been drafted from adjacent evidence — and checking §8
against it when it did arrive is what caught a false claim that section was carrying. That is
recorded in §8 rather than quietly corrected.

The body stands as that rewrite. Grounding that lands **between** passes is folded into the section
it belongs to rather than held back for the next one — the same method requires that too — so a
`[seen]` claim may sit inside a section the rewrite produced, and an open question may have been
struck off since.

★ **This revision was FOLDED INTO, not rewritten whole, and that is a deviation rather than the
clause above.** The between-passes clause licenses grounding that arrives between passes; the
cluster-6 pass is a pass, so it does not cover it. The reason the fold was allowed is narrower and
worth stating plainly: the standing body rests on eight blind area re-derivations, and a confirmer
working one cluster is not positioned to reproduce them — replacing them from a single cluster's
evidence would have destroyed the wider derivation to look tidy. **A whole rewrite is therefore
OWED, and this note is the record of that debt** rather than a licence to keep folding.

Blind is not the same as ignorant, and the difference is worth stating. Two working notes that the
`[seen]` grounding record lives in refer to the old map by section number, and those were read for
the observations, which exist nowhere else. So the topics that previously had sections were known;
their content and wording were not. The structure below follows `gameplay.md`'s outside-in order and
what the evidence actually turned out to be.

---

## §2 The frame: one interrupt, four modes

### Everything happens in the vblank interrupt

The NMI vector's whole job is to reach one routine, and that routine is the game. There is no
vblank-flag poll anywhere in the ROM; the hardware asserts the interrupt only while a latch bit is
set, and the service turns that bit off on entry and back on in its epilogue. `[code]`

The service, in the order it runs:

1. **Copy the sprite shadow to the hardware** — first, before anything else, so the picture is
   written during the blanking interval.
2. **Disarm its own interrupt and kick the watchdog.** Note this happens *after* the sprite copy,
   so the disarm is not protecting it.
3. **Recompute screen flip** from the cabinet setting and the current player, and drive the
   flip latch. The sprite copy therefore uses the *previous* frame's flip decision.
4. **Mirror all five input and dip ports** into consecutive cells, complemented, unconditionally.
5. **Bump two frame counters** — one plain binary, one BCD — and tick three countdown timers that
   floor at zero.
6. **Run the coin service.**
7. **Dispatch the sequence machine**, with the epilogue's address pushed as the arm's return.

The epilogue restores both register banks plus the index registers, and does one piece of work of
its own: hand a single queued byte to the sound CPU and pulse its interrupt line. `[code]`

★ **One routine is the whole of that hand-off, and it is the machine that says so.** A write tap on
the sound-data latch under MAME, across boot, attract, the demo and driven play, recorded every
single write from one instruction — no second writer anywhere in the image. The interrupt line took
exactly twice as many writes, a high from one instruction paired with a low from the next, and a
read tap at the routine's entry counted the same number of dispatches as there were latch writes.
`[seen]`

★ **That address is split by DIRECTION and this is a standing trap.** Written it is the sound latch;
READ it is the scanline counter, a different device behind the same number. The load-from-it sites
scattered through the raster-wait code are not reading back what the sound path wrote. `[code]`

**The foreground program is not a game loop.** Boot ends by jumping into a command-ring drain that
spins on an empty ring, takes a (command, argument) pair, marks the slot free, and dispatches the
low nibble through a sixteen-way table — for ever. All game logic hangs off the interrupt; the
foreground exists to service the ring.

Every clause of that is now watched rather than read. The drain is entered **once** — its one
entrance from outside fired exactly once in every MAME run, one of which contained a whole
credited game and its game-over, and the loop head was fetched exactly one more time than its own
branch back into itself, so every other arrival is the loop's own jump. Boot reaches it by a JUMP
at the stack seat boot installed, so **there is no return address anywhere for it to return to**:
over 4.5 million fetches of the loop head the stack pointer took ONE value. The table read it
delegates to, tapped in the same runs, showed three and four distinct stack pointers, so the single
value is a measurement and not a blind instrument. And the interrupt really is the other half of
the pair: all 8764 vblank interrupts of a 150-second session were accepted two bytes below that one
seat, so in two such sessions the background never interrupted the machine anywhere but here.
`[seen]`

**Almost all of the foreground is the empty-ring spin.** On undriven attract the loop head was
fetched 3291149 times while the eleven distinct arms of its table were dispatched 1308 times
between them — about one fetch in 2500 consumed a command. `[seen]`

**The low nibble really is the selector, and one experiment could have refuted it.** A command byte
poked repeatedly into the ring cell the read cursor names produced dispatches of the arm that
nibble's table slot holds and none of any other arm; the same run with a different nibble moved the
dispatches wholesale to that nibble's arm; and the control run, identical but for the poke,
dispatched neither. The two zero taps are not blind — each is shown firing under identical wiring in
its sibling arm. What is NOT established is the ORDER — the ROM frees the pair before running the
arm, so a command may re-use the pair it arrived in, and a read two frames later cannot see that.
`[seen]`, except the ordering, which stays `[code]`

### ★ The round engine's service list is not a per-frame list

The round phase's arm is a straight run of `call`s — a scenery dispatcher, several per-slot
handlers, the shot sweeps, the chained-hit window, the base-sixty counter, the meter and the
cloud multiplexer, in that order. Each member has exactly one transfer-in and they sit three
bytes apart, so membership is not inferred: it is the instruction stream.

**It does not run once a frame, and prose calling it a "once-per-frame list" is wrong.** Read
taps on four of its members returned identical counts to each other in every run and well short
of the frame count — 13094 against 17764 frames on undriven attract, 11712 driven, 8040 on a tape
that never fought back, 9192 on a two-player tape. Attributed by mode, **every one of those
dispatches is in the round mode and none in any other**, and even inside the round mode the list
is short of the frame count, so a second gate sits below the mode. That gate is not identified
here. `[seen]`

The consequence reaches further than cadence. Anything the list counts measures **dispatches of
this list**, not time: the base-sixty counter it steps takes 84, 95, 120 and 140 frames to
complete one wrap on four different tapes. `[seen]`

### The four modes

A two-level index drives everything: an outer **phase** masked to two bits, dispatched through a
four-entry table, and an inner **substep** dispatched again inside each arm — with a different
width per arm, and two of the four arms not masking at all.

The registry declined for two passes to say what these sequences were. **They are now established
by observation of the real machine, in two independent captures:** `[seen]`

| phase | what it is |
|---|---|
| 0 | boot wipe — blanks one screen column per frame, then hands over |
| 1 | attract — the copyright strip, the score and how-to pages, then the demo launch |
| 2 | credit taken, "push start" |
| 3 | the round engine |

★ **Phase 3 is necessary for play and not sufficient**, and the difference matters more than the
phases themselves. The attract **demo is launched by entering phase 3 with the play flag off** —
one life, real game logic, the era index advancing as it runs. It is not a recorded replay.

So the play flag, not the phase, is what separates a game from a demo. Anything that treats
phase 3 as a play detector will count the demo as a game, and since the demo is where most
attract-mode execution comes from, that error silently corrupts any measurement keyed on it. This
is the single most useful thing to know before pointing an instrument at this machine.

**The inner substep is a per-life cycle within phase 3**, returning to a *mid* value rather than
zero each time a life is lost — so reading it as a simple progression misleads. `[seen]`

**Not claimed:** what every substep value selects. Several were never observed in any run; two of
them are real code with real bodies, reachable by some path none of our tapes drove — a two-player
game and the high-score entry screen being the obvious candidates. One is a bare `ret`.

### Coin, credit, and a distinction worth keeping

Three cells are easy to conflate and mean different things: `[code][seen]`

- the **port mirror** is rewritten from the hardware every frame, unconditionally, so a non-zero
  value proves a contact was closed and nothing more;
- the **coin-pulse count** is bumped only after a debounce sees idle-then-pressed, and counts
  solenoid pulses the machine still owes the mechanical counter;
- the **credit count** is a separate BCD cell reached only after the coinage arithmetic.

An accepted coin is therefore not a banked credit on any setting that charges more than one coin
per credit.

★ **Two slots, two mechanical counters, two byte-identical drivers.** Each coin slot owes its own
counter its own pulses, and each has its own debt cell, its own 48-frame pulse timer and its own
LS259 line — the two driver routines are identical for all thirty-six bytes but three operands.
A pulse energises the line, releases it at the half-way count, and pays one off the debt as it
ends, so two coins come out as two separate pulses rather than one long one.

Watched under MAME against an undriven run as the control: with no coin the line, the debt and the
timer took no write at all; with five coins the line took five writes of one and five of zero,
the timer took 240 decrements — exactly 48 per pulse — and the second slot's driver, dispatched
every frame throughout, drove nothing whatever. `[seen]`

### Work RAM is cleared three times, and only one of them is the power-on wipe

| clear | extent | when |
|---|---|---|
| `ldir` at `0x0091` | `0xA800`-`0xAFFF` — **all of it** | once, from reset: the reset routine falls through to `jp 0x0069` and the wipe is the third thing it does |
| `ldir` at `0x2860` | `0xAA80`-`0xAADF` (the shot array) | attract/demo setup |
| `ldir` at `0x286D` | `0xA800`-`0xA97F` (the record array and the block after it) | attract/demo setup |

`[code]` for the extents, read off the setups; `[seen]` for the timing.

**Every work-RAM cell therefore has the power-on wipe as a writer**, and a "nothing else writes
this" claim about any of them is a claim about the game's own stores, not about the whole history
of the byte. Because the wipe is a real instruction and not the emulator starting RAM at zero, a
cell's post-reset value is a property of the machine and can be relied on: it is why the sprite
publish's turned-round arm runs exactly once on a cold machine whatever the RAM powered up holding.

★ **The two narrower clears are NOT a round init.** They sit behind `ld a,(PLAY_ACTIVE) / and a /
jr z` — taken only when the play flag is CLEAR — so they run when the demo sets itself up and are
skipped when a credited game starts. `[seen]`: over 200 s each, attract entered that routine three
times and ran both clears three times, once per demo start, while a run containing a real game
entered it once, on the frame the start press raised the play flag, and ran them zero times. They
are not keyed to the round either: `startNextRound` took zero dispatches in both runs while the
round number still advanced through the per-player context copy.

There is a second door to the power-on wipe, and it cannot open on a genuine image: `call nz,0x0069`
at `0x01FD`, after folding 256 bytes from `0x0E33` and subtracting 0xFD. The fold over the real
image comes to exactly 0xFD, so the call is not taken — another member of the anti-tamper family
above, whose failure arm is "wipe everything and start again". `[code]`

### What a coin buys: two slots, each with its own price

The coinage switches are read once, complemented, and unpacked through a small ROM table into one
byte per coin slot — `COIN_SLOT_1_RATIO` and `COIN_SLOT_2_RATIO`. Each byte packs **the number of
coins required, less one, in the high nibble and the credits awarded in the low**, and the accept
arm for that slot keeps its own accumulator: a coin steps the accumulator by one unit of the high
nibble, and only when it reaches the required count is the low nibble added to the BCD credit
count and the accumulator drawn down. The two slots are wholly independent, price included.
`[seen]` — forced switch values under MAME produced exactly the coins-and-credits pair MAME's own
label gives each setting, each destination following its own nibble alone.

Free play is not a price. Either slot set to it raises `FREE_PLAY`, and the accept path then skips
the credit arithmetic entirely rather than charging zero. `[seen]`

### Free play is a different start button, not a discount

There are two start paths and they are not the same routine. The coin path debits the credit
cell in packed BCD. The free-play path **charges nothing at all** — it has no credit arithmetic
in it — and it is reached only through callers that first test `FREE_PLAY` and, in one case, also
require the credit cell to be zero. So a free-play cabinet does not run the coin path with the
price set to nought; it runs different code. `[seen]`

That path reads both start buttons and tests the two-player one **first**: with both held, a
two-player game starts. It stocks the started players' blocks from the lives setting — both
blocks for two players, one for one, with the other player's block cleared.

★ **This is why an instrument pointed at a coin cabinet sees the routine at zero.** Across four
driven MAME runs on the default coinage — including one that started a real two-player game by
inserting four coins — a read tap at its entry counted nothing. Forcing the coinage port to Free
Play and pressing a start button with no coin inserted made it run, and pressing the *other*
button made it take the *other* arm, with neither arm's program counters appearing in the other
run. `[seen]`

The consequence for anyone measuring this game: **a reachability sweep run on the default DIPs
cannot see the free-play half of the machine at all**, and a zero there means the cabinet, not
the code.

### The ROM checks itself, and a bad copy desynchronises rather than dying

The image is threaded with folds: a routine sums or exclusive-ors a block of ROM, applies a
trailing constant, and on a genuine image the result is zero. What hangs off a non-zero result is
the interesting part, because none of it is a clean failure. `[code]`

Four distinct corruption targets were identified:

- **the outer phase** — several sites rewrite it with an expression that is the identity only on a
  genuine image, and the dispatch then masks the result, so a tampered ROM lands in a *plausible*
  phase carrying a stale substep. It does not crash; it desynchronises.
- **the inner substep** — the game-over teardown's "clear the index" is itself a fold.
- **a live countdown timer** that other code tests against zero.
- **the video-enable latch** — two folds drive it, so a tampered image can simply go black.

This has a direct consequence for our own instruments, and it is why every reachability sweep here
must gate on the program counter: **a plain memory read tap counts the ROM reading itself.** See
§10.

It also means a routine can look live and be dead. Several call sites exist only behind a failed
fold and never execute on a genuine image, and several of their targets are not routines at all —
they are word tables that happen to disassemble. `[code]`

Two more sites fold a checksum into a cell that also carries live state, which is what makes this
idiom dangerous to a reader rather than merely clever. One sums thirty bytes of the image onto the
**sequence phase** and stores the result back into the phase cell; another folds a word of the
image into the **sequence sub-step**. On a genuine image the trailing constants net the fold to
the value the sequence actually wanted, so the cell behaves; on a patched one the machine walks
into a different phase instead of failing. `[code]`

★ The reader's hazard is not the trap, it is the naming. **These cells have writers that are not
about what the cell is for**, so a name derived from the obvious writer will be right about the
role and wrong about the cell — and any claim of the form "nothing else writes it" is false here.
Enumerate every writer before naming a cell in this game; the power-on clear of work RAM counts as
a writer too, for every cell inside it.

---

## §3 The world moves, not the ship

`gameplay.md` §4 quotes the public record: *"The background moves in the opposite direction to the
player's plane, rather than the other way around."* The code says exactly that, and says it in one
instruction.

### The camera is the player's own velocity, negated

`loc_1f42` reads the era index, picks a velocity table, and calls the heading→velocity lookup for
the player's current heading. Its continuation, `loc_1f55`, writes that vector **negated** into
`WORLD_SCROLL_Y` and `WORLD_SCROLL_X`. Every world-static object then has that pair added to its
position once a frame. The ship's sprite entry is pinned and never rewritten, so the ship cannot
move; adding the negated player velocity to everything else is what turns the stick into flight.
`[code]`

There is no separate camera and no scroll register. **The camera is a subtraction**, and the cells
holding it are the single most load-bearing pair in the game.

**Not claimed:** that the pair is only ever written from that path. It is the negated player
velocity where we have traced it; nothing here proves no other routine writes it.

### ★ The two halves of the camera are CROSSED against the glass

The pair is named for the sprite-record field each half lands in, and that is the **native raster**
frame. The board is ROT90 clockwise, so those are not the player's axes: `display_x = 239 -
native_y` and `display_y = native_x`. Composed, the cell that feeds a sprite's **Y** byte is the
one that moves the picture **sideways**:

| cell | positive value slides the world |
|---|---|
| `WORLD_SCROLL_Y` | **LEFT** on the glass |
| `WORLD_SCROLL_X` | **DOWN** the glass |

Measured under MAME three ways, each of which could have come out the other way. The rotation
itself: the same frame captured with and without `-norotate` matched ROT90-clockwise with **no
residual at all**, while the nearest rival mapping left thousands of pixels wrong. Each cell alone:
a read tap fed every reader a value of our choosing while the game's own writes stood, and the
world's native motion followed that cell on its own axis at each parallax fraction and moved on the
other axis by **exactly zero**. And end to end: the displayed picture at the two ends of a forced
window shifted along one screen axis and not the other, in the predicted direction. `[seen]`

★ **Prose written in DISPLAY axes calls these the horizontal and the vertical scroll, and is
CROSSED against the names rather than in disagreement with them.** The frozen oracle's
transcription of ROM 0x4017 reads them that way. It is a difference of convention; neither reading
is wrong about any byte, and the transcription is faithful either way.

### The player's speed rises with the era — and so, therefore, does the world's

`loc_1f42` buckets the era index and hands out a different velocity table for each bucket:

| era index | table | peak magnitude | pixels/frame (8.8) |
|---|---|---|---|
| 0 | 0x5E00 | 256 | 1.00 |
| 1–2 | 0x2E3E | 306 | 1.19 |
| 3 and up | 0x08FA | 331 | 1.29 |

Those tables are three rungs of a closed ladder of six that steps evenly by 25 — the other three
peak at 206, 231 and 281. **The player is never given any of those three**, and the skipped rung is
not simply "the slow end": it takes the third, fifth and sixth rungs and steps over the fourth.
`[code]`

★ **The fourth rung is not reachable by anything.** Both shims that would select it are uncalled,
and its only other mention in the ROM is a deliberate checksum trap that jumps into it as if it
were code. A rung of a closed, evenly-stepped ladder exists in the data and is wired to nothing.
`[code]`, read from
the ROM words directly.

★ **The six tables are one waveform scaled.** Each of them is the 256-peak table multiplied by its
own peak and rounded, never off by more than two units in the last place, and all six carry the
*same* off-symmetry headings — identical rounding scars in identical places. The tables differ by a
scalar and by nothing else: same heading map, same turn geometry. `[code]`

That is what licenses reading the ladder as a ladder of **speeds**. Had the tables differed in
shape, an entry that picks one would be selecting a flight *character* — how a thing turns, not how
fast it travels — and every claim above about who is faster than whom would be the wrong kind of
claim to make about it.

★ **A rung does not identify a routine.** These tables are chosen by short shims — mostly a table
load and a jump, though a couple simply fall through into their target — and the shims fan out over
several distinct bodies. **Only two of those bodies move anything**: one adds the velocity term once,
the other adds it twice, so the second sends objects faster than every rung of the first. The
remaining bodies only look a velocity up and hand the pair back; they write no memory at all, and a
`fly`-shaped name would be false for anything that reaches them.

Every body has a shim selecting the lowest table, so "the slowest rung" picks out several different
routines. And one body is entered two ways — a short prologue falling into the body proper, each
with its own shim — so even body-plus-rung leaves two entries sharing a description. **What
identifies one of these entries is the body it reaches together with how it enters; the rung alone
names nothing.** `[code]`

★ This is worth stating plainly because the public record appears to have missed it. `gameplay.md`
§2 records that *"the plane is always flying forward at what appears to be a fixed speed; no public
source describes a throttle or brake"*, and question 17 asks whether the player's speed is fixed.
**It is not — it steps up twice over the five eras.** Both descriptions are true of the same
machine: since the player's velocity IS the world scroll, a faster player renders as a faster world
rather than as a faster plane, and there is nothing on screen for a spectator to measure it against.

### Depth: the same displacement, applied in fractions

Scenery does not receive the whole camera displacement. An era-keyed dispatcher walks a list of
per-object handlers, each of which applies a **fraction** of the shared pair to its object before
stepping to the next slot. Four fractions exist, and they are one family by arithmetic rather than
one dispatch group:

| rung | applies | who calls it |
|---|---|---|
| ×1 | the whole displacement | world-static objects, reached outside the scenery list |
| ×5/4 | a quarter more than the world | the scenery dispatcher |
| ×3/4 | three quarters | the scenery dispatcher |
| ×1/2 | half | the scenery dispatcher |

A rung that over-travels at ×5/4 is not an error: something moving *faster* than the world reads as
nearer than the world, which is what the front layer of a parallax stack must do.

The arithmetic helpers underneath are pure — they read no scroll cell, touch no object and write no
memory. The wrappers own every memory access. That division is why the helpers are named for what
they compute and the wrappers for what they move. `[code]`

**Measured under MAME:** each wrapper matched its own fraction on every dispatch and the other two
on none, with zero mismatches, and every dispatch sat inside the eight scenery slots. `[seen]`

The final era's band is not the others rearranged — it is built from a different set of pieces.
Where the middle eras place a three-tile object at the fastest rung, one at three quarters and
one at half, the last era places **two** two-tile objects at the fastest rung, two single tiles
at three quarters and two at half. The fastest rung there carries the smallest multi-tile object
in the game. `[seen]` for the composition, from the dispatch counts of the era-4 run; `[code]`
for reading the tile counts off the wrappers.

### Depth tracks sprite size — strictly, in the eras we have watched

Each handler places its object's tiles before stepping the slot, so the handler body records how
big its object is:

| era index | handler list | tiles per rung (×5/4, ×3/4, ×1/2) |
|---|---|---|
| 0 | `2d15, 2d36, 2d36, 2d68` | 3, 2, 1 |
| 1–3 | `2d21, 2d36, 2d36, 2d68` | 3, 2, 1 |
| 4 | `2d2d, 2d2d, 2d62, 2d62, 2d68, 2d68` | 2, 1, 1 |

The nearest layer carries the largest sprite and the farthest the smallest, which is the prediction
the naming rests on and it could have failed. `[code]`

★ **But "strictly monotone" holds only for the first four eras.** The last era's ×3/4 and ×1/2
objects are the same size, so the ordering there is monotone and not strict. Its scenery set is
smaller and more numerous — `gameplay.md` §5 describes the final era as an asteroid field rather
than clouds. Every sweep we have run stops long before it, so the strict form was an artifact of
coverage. See §10.

★ **A dispatch ratio measured at exactly 1:2:1 across the rungs is evidence about WHICH LIST RAN,
not about the family.** Era 0's list contains ×3/4 twice and the others once each; the last era's
contains each twice, which is 1:1:1. The measured ratio therefore dates the capture rather than
describing the mechanism.

### "The era" is not one switch

Three subsystems read the same era index and divide it differently:

- the player's speed: `{0}`, `{1,2}`, `{3,4}`
- the player's turn rate: `{0,1,2}`, `{3,4}` — see §5
- the scenery: `{0}`, `{1,2,3}`, `{4}`

The first two are decided in the same chain, at different boundaries, so the
player's own handling divides the era index two ways by itself.

Both are consistent with the five rounds the public record describes, and neither implements an era
as a bundle of settings. The difficulty curve and the scenery curve step at **different rounds**.
A reader who assumes one era boundary will predict changes that do not happen.

The scenery split is no longer only a code reading. A MAME run holding the era index at 4, whose
undriven stretch ran at era 1, put both arms of the scenery dispatcher under one instrument, and
every wrapper's dispatch count came out as the dispatcher's own count times its multiplicity in
that arm's list — exactly, at both eras, with each arm's members sitting at zero in the other's
context. Two wrappers belong to the final era and to nothing else. `[seen]`

The rest is `[code]`.

### Difficulty also climbs INSIDE an era, on a rung of its own

The era is not the only difficulty axis. A second cell holds a **rung** that climbs while a life
lasts: it is seeded per player at life start, bumped each time a countdown of base-sixty wraps
expires, and clamped at fifteen. The era and the rung are then packed into one index — era in the
high nibble, rung in the low — which selects a ten-byte row from a table of five eras by sixteen
rungs, and one routine scatters that row over twelve cells.

### ★ And the cabinet's Difficulty switch sets where that rung STARTS and how fast it climbs

The rung is not only a per-life ramp; the DIP decides the ramp's two ends. A three-bit field of
DSW1 is unpacked at boot into one cell, and the credited-game init uses it to index an eight-record
table of four bytes each. Three of the four bytes are the rung a round STARTS on, chosen by rounds
completed — under 6, 6 to 10, 11 and up — and the fourth is how many wraps of the base-sixty
counter one rung lasts. `[seen]`

Driven through all eight DIP positions on the real ROM under MAME, one process per position, and
read back from the DERIVED cells rather than from the port:

| MAME's own label | index cell | start rung, rounds 1-5 / 6-10 / 11+ | wraps per rung |
|---|---|---|---|
| 1 (Easiest) | 0 | 0 / 2 / 6 | 13 |
| 2 | 1 | 0 / 3 / 7 | 12 |
| 3 | 2 | 0 / 4 / 8 | 11 |
| 4 (default) | 3 | 2 / 6 / 10 | 10 |
| 5 | 4 | 4 / 8 / 12 | 9 |
| 6 | 5 | 7 / 10 / 13 | 7 |
| 7 | 6 | 11 / 13 / 14 | 5 |
| 8 (Difficult) | 7 | 15 / 15 / 15 | 5 |

Both directions were watched, and either could have come out backwards: as the setting hardens the
start rung RISES and the wraps per rung FALL. At the hardest position the start rung is already the
clamp, so the ramp is over before it begins. The first column was watched arriving in the per-player
block and then in the rung cell itself at every one of the eight positions. `[seen]`

★ **The attract demo runs on one fixed record whatever the cabinet says.** The same eight runs, read
before a credit was taken, all produced the third record: the attract path reaches the loader
through a call site that passes a literal 2 where the credited-game path passes the DIP cell. A
demo is therefore no guide to how the cabinet is set. `[seen]`

★ **"Easy / medium / hard" is the wrong reading of the three bracket bytes.** They are not three
difficulty tiers — all three come from the SAME record, so from the same DIP position, and what
selects between them is how many rounds the player has completed.

**The row is difficulty settings, and it was watched being applied.** As the rung climbed under
MAME, the destinations took a monotone ladder of values: a fire cooldown period stepping 0x32,
0x28, 0x1E; an aim window widening; a spawner's cap going 0, 1, 2; a draw threshold climbing 0x50
through 0xA0. Two of the twelve are the reload periods of live countdowns the **vblank service
itself** decrements and six other sites reload — a period-and-countdown pair that a row of
unrelated constants could not produce. `[seen]`

So a round gets harder as it goes on, independently of which era it is, and an attract run that
never reaches the clamp is seeing only the bottom of that ramp. What each of the twelve cells
governs is not fully settled: most are read by spawners, aim windows and fire cooldowns, two are
read by paths this pass did not tie to attacking. `[code]`

### The era index advances during the attract demo

The demo is not a canned replay — it runs the real play arm, and the era index moves while it runs.
`[seen]` Anything that attributes a dispatch to "a game being played" on the strength of the era
index or the play arm alone will count the demo as a game. See §2 and §10.

---

## §4 Objects: one array, two tables, and two ways onto the screen

### Every object is a record and a sprite entry, indexed in lockstep

There is **one** record array and **one** sprite-entry array. The "actor array" and "scenery block"
are bands within them, not separate tables. `advanceToNextSlot` states both strides in four
instructions — record `+0x10`, entry `+2` — and that ratio of eight fixes the mapping:

```
entry = 0xAA10 + (record - 0xA800) / 8
```

Every record/entry base PAIR in the lift obeys it. `[code]` (Not every `ix`/`iy` literal is such a
pair — the shot array and a structure outside the object arrays are loaded into the same registers,
and several routines put a sprite-entry base in the record register.)

| band | records | entries | who owns it |
|---|---|---|---|
| the player | `0xA800` | `0xAA10` | armed once per life, refreshed each frame from its heading |
| actors | `0xA810`–`0xA8F0` | `0xAA12`–`0xAA2E` | one small handler per slot, each hard-coding its own pair |
| scenery | `0xA900`–`0xA970` | `0xAA30`–`0xAA3E` | the era-keyed parallax dispatcher |

Player shots are the exception: a **separate** six-slot array at `0xAA80` with no sprite entries at
all. `[code]`

### A coordinate is split across both tables

An actor's position is 16-bit 8.8 fixed point whose **whole byte lives in the sprite entry** and
whose **fraction lives in the record**. Motion is a single 16-bit add that writes both halves back.

```
ld h,(iy+0x31)   ld l,(ix+0x03)   ld de,(0xa808)   add hl,de
ld (iy+0x31),h   ld (ix+0x03),l
```

This is why the drift routines touch two tables to move one thing, and why a reader expecting a
position to live in one place will not find it. `[code]`

### The record layout

Offsets `0x00`–`0x05` and `0x0E`–`0x0F` mean the same thing to every family. **`+0x08`..`+0x0D` do
not** — the player keeps the camera there, a shot keeps its frozen velocity there, and actor
families use them differently again. Any single name for that block would be wrong for somebody.

| off | meaning |
|---|---|
| `+0x00` | state code / occupancy — see the lifecycle below |
| `+0x01` | the heading the object is turning **toward** |
| `+0x02` | current heading, a full byte = 256 steps of the circle |
| `+0x03` | Y fraction |
| `+0x05` | X fraction |
| `+0x08` | shape byte the entry's tile code is refreshed from |
| `+0x09` | animation step — a countdown that is ALSO the index into the run |
| `+0x0A` | which run of shape bytes this record animates through |
| `+0x0E` | release delay, then a general cooldown |
| `+0x0F` | slot ordinal, stamped once per life and used as an identity key |

★ **Some record bytes are per-slot PARAMETERS, stamped once per era and never touched by the slot's
own handler.** One routine reads a table block chosen by the era and distributes its bytes to
`+0x04`, `+0x06` and `+0x07` of six named records — so a byte inside the record array can be read by
code that has nothing to do with that slot. The clearest case is `0xA8F6`, offset `+0x06` of the
last actor record: six retire sites outside it copy it into whatever record they are retiring, as
that record's cooldown. `[seen]` for the value travelling — it is `0x1E` through the attract demo
and `0x42`, `0x48`, `0x4E` across a driven game, restamped six times by the era loader. Anyone
reading the offsets table as "every byte of a record belongs to that record" will misread these.

★ **The ordinal at `+0x0F` is stamped by ONE routine, on the whole array at once, at life start.**
It walks twenty-three records sixteen bytes apart from `0xA810` — which is the actor band and the
scenery band entire, every slot but the player's — clearing each occupancy byte and writing that
record's position from one. Read back on the real ROM under MAME in the frame it ran, three times
in one driven game, the twenty-three bytes held 1 through 23 and the twenty-three occupancy bytes
held zero. `[seen]`

Two routines then use it as an IDENTITY rather than a round-robin index, and between them they are
what makes it a key: when a shared timer expires one of them stores a dying record's own ordinal,
plus a top bit, into a single cell at `0xA821`; the appearance driver on the dying path reads that
cell and RETIRES its object outright unless the low seven bits are its own ordinal. So the cell is a
token, granted to one slot at a time, and the ordinal is how a slot recognises that it holds it.
`[code]` for what the token buys — only that it is consumed exactly once, on the first value, and
that the same dispatch posts a ring command.

The record holds **no** whole coordinate for actors, no sprite code and no colour. Those are in the
entry: X, tile code, attribute (colour plus two flip bits), Y. `[code]`

### The lifecycle of a slot

Five per-slot handlers share one ladder, and it is the ladder that defines the states:

```
ld a,(ix+0x00) ; and a ; ret z     ; 0x00  free
inc a ; jr z,<live>                ; 0xFF  live
inc a ; jp z,0x2b52                ; 0xFE  held -> release it
        jp 0x2b93                  ; anything else -> dying
```

| code | state | left by |
|---|---|---|
| `0x00` | free | a spawn |
| `0xFE` | held — spawned, waiting out its delay | `releaseHeldObject` promotes it to live and re-arms the delay |
| `0xFF` | live | a hit writing `0xF0`, or drifting onto a retire line |
| `0xF0` | just hit | converted to a countdown |
| `0x01`–`0x3B` | dying, animating | counts down; at zero the slot is retired |

The held code is stored literally on a live spawn path: `ld (ix+0x00),0xfe`, inside the routine that
walks the actor band, which the round engine's service list calls unconditionally. The very next instructions read
the slot's delay and promote `0xFE` to `0xFF` when that delay has already expired, so "held" and
"live" are set by one piece of code a few bytes apart. `[code]`

### An animation is a run of shape bytes, walked BACKWARDS by its own timer

A record's animation is three bytes of the record and one table. The selector byte picks a run out
of a table of run pointers; the step byte is counted down once per dispatch and the count it lands
on is the INDEX into that run, so the shape walks the run from the far end toward the front and
**stops at the run's first entry** when the count reaches zero — a step already at zero is left
alone and nothing at all is written. `[seen]`: watching one record's three bytes on the real machine
gave several distinct selector-and-count pairs, and in every one the shape byte was the byte the
ROM's own run for that selector holds at that count.

The three sites that START an animation all load the same step, `0x20`, and each run is `0x20` bytes
long — so a freshly started animation walks the whole run and comes to rest on its first byte.

Every run in that table begins with the same shape. That shape is therefore what a record is left
standing on once its animation has run out, and one routine writes a band of five records straight
into that state: the shape, and a zeroed step. Those five are STOPPED, not started — a zeroed step
is never raised by the countdown itself, which reads the step and returns before writing anything,
so nothing steps them again until one of the three arming sites fires. `[code]`, and the shared first byte is a property of the table anyone
can re-derive.

### Retiring and hiding are the same store

Two retire helpers do the same job by different idioms — one stores from a zeroed register and also
clears the sub-pixel fractions, the other stores immediates and leaves them — and their
caller sets are statically disjoint, which is what makes them two families' helpers rather than two
versions of one.

What actually removes an object from the picture is zeroing the entry's Y: the DMA turns `Y = 0`
into a hardware value that puts the sprite entirely above the first visible raster line.
`hideAllSprites` does the identical store to every entry at once, and the caption-hiding routine
does it to four. **"Retired" and "hidden" are the same write; the occupancy byte is the only thing
that distinguishes them.** `[code]`

### The retire lines are the player's antipode

`hasReachedRetireLine` tests two three-pixel windows: Y at `0xF8`, X at
`0x04`. The player is pinned at `(0x84, 0x78)`, and `0x78 + 0x80 = 0xF8`, `0x84 + 0x80 = 0x04`
modulo 256. Both lines are **exactly halfway round a wrapping axis from the ship** — the farthest
an object can get behind a camera that never moves. `[code]`

★ **The window is three pixels wide, so it can be stepped over.** An object whose whole part moves
more than three pixels a frame on the retiring axis can jump the line and go round again. Whether
anything in the game is that fast is unresolved; the shot family notably uses its own explicit range
test instead of this routine, which is suggestive and not proof.

### Two ways onto the screen — and shots use the second one

**Sprites** reach the hardware through a DMA that runs first thing in the vblank service, copying
two 48-byte shadow bands into the two hardware sprite banks. It is the largest routine in the game.
It does two things beyond copying:

1. **It encodes Y** as `~(Y + 0x0E)`, which is exactly the inverse of what MAME reads back — so the
   shadow's Y byte is literally the sprite's native top row. `[code]`
2. **It reorders the bands**, and the reorder is a priority arrangement. MAME paints from the
   highest hardware offset down, so the lowest offset is painted last and wins overlaps. The DMA
   places three scenery entries at the very lowest offsets and the rest at the very highest.

★ **Which byte of a sprite is which is settled, and the flipped variant is what settles it.** A
sprite is two bytes in each bank. Bank 0 holds the horizontal coordinate then the tile code; bank 1
holds the attribute — colour with two flip bits — then the vertical coordinate, encoded so that the
hardware reads back `241 - value`. The DMA's own transform table is the proof, because the flipped
variant has to mirror the same quantities: it complements the bank-0 first byte past fifteen
(`240 - X`), leaves the second alone (a tile code has no handedness), toggles exactly two bits of
the bank-1 first byte (the two flip flags), and merely steps the bank-1 second byte on by one —
which is the *same* encoding applied to `240 - Y`, since `241 - (Y+1) = 240 - Y`. Four transforms,
one reading, no spare parts. `[seen]`: with the cabinet dip at cocktail on player two's turn, every
one of bank 0's 48 bytes matched the mirrored reconstruction, and the flipped arm went from 1
dispatch to 3008 in step with the orientation flag; upright, both banks matched the plain
reconstruction on all 48 bytes.

The single upright dispatch of the flipped arm is not noise. Boot clears the whole of work RAM, and
the DMA runs BEFORE the store that sets the orientation flag, so the first publish of a cold machine
is always the turned-round one. `[seen]`

★ **A coherence check that could have failed and did not:** the three entries the DMA promotes to
front-most are exactly the ones the fastest parallax rung occupies, and the slowest rung lands at
the back. *Nearest moves fastest* and *nearest paints in front* are two independent mechanisms that
agree. `[code]`

A second variant of the DMA handles the flipped cabinet by mirroring every sprite **in software** —
`240 - X`, `240 - Y`, and both flip bits toggled. MAME's sprite drawing has no flip handling at all,
because the tilemap is flipped in hardware and the sprites are flipped by the ROM. `[code]`

**Player shots are not sprites at all.** They are painted as 2×2 blocks of character cells through a
double-buffered display list: a per-shot routine appends address/code/attribute quads to a list, and
inside the vblank service one walker blanks the *previous* frame's cells while another writes this
frame's, after which the list is copied over and the write pointer reset. Both walkers test the
cell's colour-RAM priority bit and **skip the cell if it is set**, so the shot layer refuses to
scribble over foreground and HUD cells. `[code]`

### Multi-tile objects are not a structure

`placeAbuttingTile` writes **only two bytes** — the next entry's coordinates, one sprite pitch along
— and then steps both cursors. Neither it nor its diagonal sibling copies the tile code or the
attribute; those were seeded for all eight scenery entries at round init. So a "three-tile cloud" is
three ordinary sprite entries whose coordinates are recomputed from the first every frame.

That is what makes the slot budget legible. Each era's dispatch list sums to **exactly eight**
scenery slots: four objects costing 3+2+2+1 in the early eras, six objects costing 2+2+1+1+1+1 in
the last. The number of objects changes with the era; the number of slots never does. **A bigger
scenery piece is bought by having fewer of them.** `[code]`

### The cloud multiplexer: the same sprite, drawn twice

Eight scenery slots produce up to sixteen images. A routine waits until the raster has passed a
slot's last line, then moves that slot half a screen in **both** axes, so the same sprite is drawn a
second time lower down the frame.

The "request bit" is written by an explicit store, once per slot per frame and gated on game state,
at the DMA's own tail. What it would store is the *encoded* Y plus 0x80, and the carry out of that
addition decides whether the slot is displaced at all: when it is set, the Y store and the partner X
bump are both skipped and the slot keeps whatever the copy loop wrote. Either way the bit ends up
set. `[code]`

**The slots the tail sets are the scenery band entire, and the DMA's own reorder is what hides
that.** The tail reaches eight sprites at bank offsets 0, 2, 4 and 38, 40, 42, 44, 46 — which look
like two unrelated groups until you undo the copy: they are the three scenery entries the DMA
promotes to the front-most hardware offsets and the five it sends to the back, i.e.
`0xAA30`-`0xAA3E` with nothing else. So the request is posted for every scenery slot and for no
actor. `[seen]`: on frames sampled just after the tail had run, exactly those slots read as their
transform plus `0x80` on the horizontal byte with the top bit set on the vertical one.

★ **Across a gated frame, the bit's state tracks serviced against not-yet-serviced.** The tail sets
it over exactly the slots the multiplexer walks — the two cover the same slots in the same order —
and it ends set on both arms of the branch, so once the tail has run they are all set. The
multiplexer clears the bit when it services a slot, and it runs several times over a frame. `[code]`

**It is not only a flag, and that matters to anyone tempted to move it.** The multiplexer feeds the
whole byte, bit 7 included, into its comparison against the beam — the byte reaches that comparison
unmasked — so the bit shifts the firing threshold by half a screen rather than merely being tested.
Masking it before that compare would not be harmless, and the flag cannot be relocated or stored
elsewhere. `[code]`

What the bit means **outside** that gate is a separate question. The tail returns early unless the
sequence cells say a round is running, and outside it the bit is simply the top bit of the encoded
Y. Whether the multiplexer ever runs outside the gate is not established here.

**There are two versions, and they differ by one byte per block.** Re-verified from the ROM this
run: the two routines are byte-identical across their whole length except for **eight** bytes, every
one at the same offset within its block — the displacement of the branch after the beam test.

- one jumps **forward**: skip a slot whose beam has not arrived
- the other jumps **back to the block head**: spin until it does

They are used together — the skipping one is called repeatedly, interleaved with other work, to
catch slots opportunistically, and the spinning one runs last as the backstop that guarantees every
request is serviced before the frame ends. That pairing repeats in each of the routines that use
them. That contrast is the strongest evidence that the *wait*
is what the second one is for. `[code]`

**Not claimed:** which twin runs more often. Two agents once produced confident and opposite
orderings, and the instrument that would settle it cannot count a routine that waits. See §10.

---

## §5 The player's ship

### Three different numbers of directions, and the public record conflated them

`gameplay.md` asks how many facings the ship renders and fires at, and reports the public claim of
"eight locked facings plus transitional angles". The truth has **three layers**, and that is why the
record is muddled: `[code]`, the rendering and the live heading range `[seen]`

- **The stick names eight targets.** There really are exactly eight, so the public description of
  the *control* is right.
- **The ship renders thirty-two.** The heading is rounded to the nearest of 32 sectors and drawn
  from sixteen tiles plus a mirror. It never locks to eight.
- **It fires along all 256.** A shot's velocity is looked up at the **raw** heading byte, not the
  rounded one.

So a shot fired mid-turn goes exactly where the ship is pointing, at an angle the sprite cannot
depict. The heading itself is a full 256-step byte, and all 256 values were observed live.

### ★ The ship can about-face — the public record's contradiction is resolved

StrategyWiki says the plane *"can't about face"*; arcade-history says you can flip 180° quickly and
calls it a core tactic. **arcade-history is right.**

The turn law takes the shorter way round to whichever of the eight targets the stick names, and
contains **no special case, no cap and no refusal** — a half-turn difference simply turns the
increasing way. It is *slow*, not impossible: about three quarters of a second in the first three
eras and just over half a second in the last two. StrategyWiki was most likely describing that
feel. `[code]`

The turn rate is **per era, not per difficulty** — it steps up with the era, and nothing on the
player's path reads a difficulty setting at all.

### The ship never moves, and its speed is not fixed

The player's sprite **position** is written once per life and never again; the tile code and
attribute are refreshed every frame from the heading, as §4's band table says. Everything the
player experiences as
flight is the world moving the other way — see §3. The consequence is worth stating twice: the
player's velocity *is* the camera, so raising it speeds up the entire world.

There is **no acceleration and no momentum**: both velocity components are recomputed from the
heading every frame and stored. The speed changes only because the era selects a different velocity
table. `[code]`

### Shooting: the public record's single-source claim is correct

`gameplay.md` carries a StrategyWiki claim it flags as unverified — that one press launches a burst
of three shots and the button must be released before firing again. **The code confirms all of
it.** `[code]`, with the ceiling and cadence `[seen]`

- A **rising edge** on the fire bit loads a pending count of three. Holding the button leaves the
  edge history saturated and never re-arms, so **release really is required.**
- Shots leave one every six frames.
- The table has **six slots**, which is the hard ceiling on screen.
- A shot carries four times the ship's world velocity while the world scrolls back at one, so it
  travels at **three times the ship's on-screen speed** — and therefore speeds up with the era too.
- **There is no lifetime.** A shot dies when it hits something or reaches the edge of the picture.

### Which panel the machine reads

The control read hands back the word of whichever cabinet panel currently faces the picture,
selecting on the same flag the interrupt latches into the flip-screen line — so which panel is
"live" is fixed by hardware outside the routine. Its callers then split that word three different
ways: the stick nibble, the fire bit edge-detected into a burst, and, in initials entry, individual
bits shifted into their own one-bit histories. That is what makes the whole word the product rather
than any one field. `[code]`

### The velocity tables are hand-drawn, not computed

Worth recording because it is a fact about the authors. The heading→velocity table is **not** a
cosine: a computed cosine disagrees with the ROM at most indices. It is a monotone quarter-wave
whose differences run one step near one axis and eight near the other, mirrored and negated into
the other quadrants. A drawn circle, not a calculated one. `[code]`

It has small defects, and they are in **every** table at the same indices — so they were introduced
once and scaled. The worst is a zeroed entry where its neighbours demand a value: it costs almost no
speed but rotates the direction, so an object turning steadily through that heading steps
**backwards** and then jumps forwards. Axis samples are also duplicated, making two adjacent
headings identical.

**Not claimed:** that any of this is visible in play. It is a fact about the data, and nothing here
says a player can see the twitch.

### ★ Where a heading points on the glass — the three ingredients are now composed

Mapping the heading byte to "up" or "left" needs the screen rotation, the vertical inversion and
the table's sign convention put together. All three are now measured on the real machine, in §3.

Driven over a whole attract run, **every one of the 256 heading bytes was observed**, and the camera
pair traces a circle around them: `WORLD_SCROLL_Y = −R·cos θ`, `WORLD_SCROLL_X = −R·sin θ`, with
θ = h·2π/256 and no residual anywhere reaching a tenth of a pixel. The residuals repeat in mirrored
quadruples, which is the same one-defect-scaled-four-ways the table's shape already shows above.
Negating that circle back into the player's own motion and rotating it onto the glass:

| heading | the player travels |
|---|---|
| `0x00` | LEFT |
| `0x40` | DOWN |
| `0x80` | RIGHT |
| `0xC0` | UP |

Left, down, right, up — so the heading byte increases **counter-clockwise on the glass**. `[seen]`

★ **This is the direction of TRAVEL and nothing more.** That the ship's *nose* is drawn along the
same direction is a separate claim, about `spriteForHeading`, and no one has measured it. Do not
read this table as a statement about the sprite.

---

## §6 Killing, and being killed

### There is no "kill routine"

Ten distinct collision tests exist. The shot-versus-target sweep is one of three shot paths, and the
two biggest targets in the game — the Mother-Ship and the 1940 bomber — are reached only by
open-coded inline loops that share no code with it. **Most of them kill the player**; the rest mark
only the other object, and one of those is the pickup test. `[code]`

Any statement of the form "kills happen in *the* collision routine" is wrong about this machine, and
a reader who instruments one path will under-count.

### One byte means "destroyed", and each family decides what it means

Every one of the ten tests writes the same marker into the victim's state byte. Most of them also
post the score at that instant, and three zero a hit counter as well; what none of them writes is
sound or animation. Those belong to the victim's own handler, a frame later. `[code]`

For an ordinary enemy craft the handler replaces the marker with a countdown on the first frame,
pays the kill there, and counts down to zero before freeing the slot. During the countdown a
three-phase explosion plays, and **the wreck keeps flying through the first phase**.

★ **The countdown is shorter than it looks.** While the value is still high the object is
decremented *twice* per frame, so the elapsed time is not the state value in frames — it is about
forty-six. Reading the state byte as a frame count overstates the explosion's length. `[code]`

The kill is also **paid in two places at two times**: the score posts at the instant of collision,
while the sound and the quota decrement happen one frame later, in the handler. `[code]`

### ★ The quota is 56, and it never changes

The manual says you advance by destroying 56 enemies and landing 7 hits on the Mother-Ship, and
`gameplay.md` flags two open questions about it — whether 56 holds for every era and loop, and what
counts toward it.

**The quota is one work-RAM byte counting down from a value loaded once at boot from a single ROM
byte, and that byte is `0x38` = 56.** Re-read from the image for this document. It is not era-keyed,
not loop-keyed and not difficulty-keyed. `[code]`

★ **What the quota reaching zero DOES is now watched, and it is the Mother-Ship.** Forcing the
counter to zero on the real ROM under MAME armed the two-slot object four times in one run, each
arming raising the flag and writing seven into that object's counter in the same frame; the run that
did not force it never armed it once. The two halves of the manual's sentence are the same event.
`[seen]`

The cell it is reloaded from is `KILL_QUOTA`, and "once at boot" has now been watched rather than
read: a write tap across a run covering boot, attract, the demo and a driven game recorded exactly
one write to it, at boot, of `0x38`. Its only reader is the routine that starts a round. `[seen]`

The escalation the manual describes for later rounds is real but lives in a **different cell**,
banded by rounds completed. So "harder" never means "more enemies to clear".

**What counts toward it: only the seven ordinary enemy-craft slots.** Every call site of the
decrement that is reachable sits in the generic craft-death ladder, reachable only from those seven
slots' handlers. One further call site exists, in a short block the transcription skips and to which
no static reference was found. Enemy
projectiles, the 1940 middle-size bomber, the Mother-Ship and the pickup all use other handlers and
none of them touches the quota. Projectiles shot down still **score**; they simply do not move the
meter. `[code]`

★ **And that settles the last open question in the public record about the screen furniture.** The
bar along the bottom is a direct rendering of the quota cell — its run length is the cell shifted,
with a partial tile from the low bits. `gameplay.md` records one source calling it a "time bar" and
flags it as ambiguous. **Nothing in this game times the player.** The bar is the kill meter, and 56 and the bar are the
same fact. (The interrupt does tick short countdown cells — see §2 — but none of them races the
player or ends a round.) `[code]`

### The 1940 bomber takes four hits

Its counter starts at three, absorbs three, and the object dies on the hit that finds it at zero.
The manual says four; StrategyWiki says three, twice. **The manual is right.** `[code]`

That counter is `HITS_REMAINING`, and the routine a hit lands in is what fixes the mechanism: with
the cell non-zero it decrements it, puts the object's state byte back to alive, requests a sound and
returns the object to its live handler — the hit is ABSORBED and nothing else changes. Only a hit
that finds the cell already zero falls through to the explosion and the retire. Watched under MAME
the cell was armed to three by one routine and walked down 2, 1, 0 by that absorb path. It is not
the cell's only writer: power-on clears the WHOLE of work RAM — `0xA800`-`0xAFFF`, the `ldir` at
`0x0091` — so every cell in the page is written at boot and none is exempt. Two narrower blocks are
cleared again later, but by the ATTRACT SETUP rather than by a round: both `ldir`s sit behind a test
of the play flag, and a driven run that took the credit ran neither of them. Sole-writer claims elsewhere in this document are about the
game's own stores, not about the power-on wipe. `[seen]`

★ **The object wears its damage.** The second era's dresser reads the same cell as *the most it can
take minus what is left* and steps a shape base in fours on the result, so a fresh bomber and a
three-times-hit one are drawn from different blocks of the sprite ROM. It is a two-tile object, and
the pair is mirrored — tiles swapped and both flipped — on whichever half of the heading circle it
is in. `[code]` for the arithmetic; `[seen]` that both mirror arms fire, in equal numbers, on a
capture whose per-arm write counts sum exactly to the dispatch count a read tap measured
independently.

★ **And this is what "ramming zeroes its hit counter" is.** The sweep that runs the player against
this one object writes the destroyed marker into both and then zeroes `HITS_REMAINING`, so the
contact kills outright rather than costing one hit. That sweep's conjunction never passed on any
tape we have driven, so the path is read and not watched. `[code]`

The same arithmetic on the Mother-Ship's counter of seven implies **eight** shots rather than the
advertised seven — flagged deliberately as the one number here that a capture should confirm before
anyone repeats it, because it contradicts the manufacturer.

### Ramming

`gameplay.md` carries a single-source claim that colliding with an enemy credits its points, and
that ramming the Mother-Ship on its last hit still advances you. Both are true, and they are
**separate mechanisms**: `[code]`

- ramming an ordinary enemy craft posts a score; ramming an enemy *projectile* does not;
- ramming either big two-slot target **zeroes that target's own hit counter** as well as marking
  it, so the contact kills it outright rather than costing it one hit. There are two such tests,
  one per target, built to the same pattern and neither shared with the other; the counter each
  one zeroes is the counter that target's handler decrements to absorb a shot.

### Four sweeps run the ship against the field, and one of them is survivable

The collision system is a chain of near-identical sweeps, entered from more than one place and
gated on the frame counter's low bit — not, measured at one of the sweeps, once per frame.
Each takes a run of records and the matching sprite entries, guards on the player being alive,
measures a wrapped box between the player's entry and each object's, and writes the destroyed marker
into whatever it finds. They are chained: each leaves its cursors where it stopped and the next
picks them up, so together they cover the whole field band by band, with a different box size per
band. `[code]`

★ **They differ in what else they write, and that is the mechanism.** Two also write the marker into
the player's own state and post a score — those are the collisions that kill you. One writes the
player's state but posts nothing. **The last writes only the object**: the player is untouched and
nothing is scored, so whatever it reaches is destroyed on contact without harming the ship. Every
call site hands that last one a run of exactly one object, always the same slot. `[seen]` for the
slot and for the marking; what that object IS has not been established here.

### Dying

Nothing in the public record describes what happens when you die. All of the following is new: `[code]`

- Being killed is **the same event** as an enemy being killed — a collision test writes the same
  marker into the player's state byte. `[seen]`: a MAME write tap recording the program counter at
  every write of `PLAYER_STATE` through a driven game finds every writer of the destroyed marker to
  be a collision sweep, and every such write followed within a frame by the death countdown's reload
  and, at its end, by the life-start routine writing the live value again. **How many sweeps that is
  depends on the eras the run reaches**, which is worth stating because it is the kind of number a
  reader banks: a run confined to the second era sees three, and a run that spends its first round
  in the first era sees a fourth — the wider-boxed arm of the ram test against the big two-slot
  target, which only the first and last eras select.
- A seven-arm explosion is drawn into the **character plane**, coloured by era.
- A life is deducted, the player's context block is saved, and the players swap.
- **Respawn is at the same pinned screen position**, with a fixed heading and `WORLD_SCROLL_Y` /
  `WORLD_SCROLL_X` zeroed.
- ★ **There is no invulnerability window.** The only thing protecting a fresh plane is that its
  state byte is not yet the live value — and it becomes the live value a couple of instructions
  before the position is written.
- ★ **The era's kill counter is not reset by dying**, and the enemy craft already on the field are
  not cleared. The projectile and pickup slots are re-initialised, and so is the 1940 bomber — both
  its slots are cleared and its delay re-seeded — along with a reload of the era parameters. The
  bomber's hit counter is not touched here; it is re-seeded whenever the bomber arms.
- If the round had already been won, the advance is applied on the way out, so **the win is not
  lost by dying during the warp**.

### The Mother-Ship, as far as the code goes

It is a **two-slot object** — one entity occupying two consecutive slots — and it is armed when the
kill meter reaches zero, both slots are free and a frame gate comes round, with a per-era velocity
table. ★ **The quota and the Mother-Ship are one mechanism, not two.** The arming path ORs the kill
counter with both occupancy bytes and returns unless all three are zero, then raises a flag and
writes seven into the object's own fifth byte. So the manual's "destroy 56 enemies, then land 7 hits
on the Mother-Ship" is a single sequence in the code: the 56th kill is what puts it on the field, and
the 7 is an immediate two instructions later. `[seen]` for the arming, watched four times. Hits count **from any angle**: the test box is
symmetric on one axis and merely long on the other, and that length is the sprite's own, not a
facing test. ★ **Its hit count never falls below five across appearances.** The re-entry path tests
the counter and writes five only if it is already under six — so the first two hits survive a
departure and everything after them is undone. Damage accumulates exactly that far and then stops.

★ **While it is out, five of the seven ordinary craft slots exist and two do not**, and the whole
machine knows it through one flag. That flag is raised by the arming path and cleared only by the
next round start or life start — so it stays up after the object dies, until the round turns over.
Every reader of it reads it as "the last two craft slots are taken": the shot sweep
takes an arm that runs FIVE craft instead of seven and then falls into a sweep against the
Mother-Ship itself; a spawn walk shortens its own run to five; the two ordinary per-slot handlers
for exactly those two records return early; and the parachutist spawn refuses outright. The
arithmetic closes — the craft run's base plus five strides IS the Mother-Ship's record. `[code]`

Measured, with a control: two MAME runs identical but for one line of the driver, whether the kill
counter is forced to zero. In the control the flag never left zero and the five-craft arm took
**zero** dispatches while the caller that chooses between the arms took 2090; with the counter
forced, the flag went up four times and that arm took 1361, every one of them attributed to the
flag-set state and none to the flag-clear state the same run entered nine times. `[seen]`
The 1940 bomber is different again: its counter is re-seeded every time it arms, so against it
nothing persists at all. `[code]`

The counter is a byte of the Mother-Ship's own record, and the three things the map says about it
are three different instructions on that one byte: the arming path writes **seven** into it, the
absorb path decrements it and puts the state byte back to alive, and the re-entry path compares it
against six and writes five only when it is below. `[code]`

★ **The ram test against it is era-keyed, and that is the only thing the era changes here.** Two
arms exist, identical instruction for instruction except for the width of one axis of the box;
the caller picks the wider one for the first and last eras and the narrower one for the middle
three. Same objects, same second axis, same three writes, same tail into the chained score — so
this is one hitbox at two widths and not two mechanics. `[code]`

The wider arm is not exotic. A game starts in the first era, so it is the arm that runs for the
whole of a player's first round: a driven MAME run dispatched it 912 times, and its destroy path
— the player marked, the target marked, the counter zeroed — fired twice. `[seen]`

Not established: which edge it enters from, and whether it fires at the player.

★ **Clearing the field is staggered, and it reuses the ordinary death countdown.** The sweep that
pays for the cleared field does not simply delete the live actors: it walks fifteen records and
writes an increasing seed into every live one — 0x14, then 0x1E, then 0x28, stepping by ten — and
posts an award for each. Those seeds land in the same state range an object's own death countdown
occupies, so each slot dies a little later than the one before it. Only the seeds at or above
sixty are high enough to take the arm that re-arms the full countdown and asks for a sound; the
lower ones simply run down and retire. So the first actors cleared vanish quietly and the later
ones explode. `[code]`

This also fixes something a reader would otherwise get wrong: the state byte of an object slot is
not a small alphabet of free / alive / destroyed. A second system writes a *range* of values into
it, and a routine that assumes the destroyed code is the only way into the countdown is wrong.
`[seen]` — one of those seeds was caught in a write tap on undriven attract.

---

## §7 Score, and the ladder that ends

### Nothing awards points directly — everything posts

Scoring goes through the same command ring the foreground loop drains. A routine that wants to
award something queues a (command, argument) pair; the ring drops the pair if the slot is still
occupied, so **an award can be lost under load** rather than queued behind others. `[code]`

This matters for reading the game: a scoring routine does not score, it *posts*. And one command
carries most of the awards, keyed by argument — which is why attributing a post to any single
routine is wrong. `[seen]`: a capture watched arguments arrive with no chain running at all,
proving the command has several independent posters. The posters found cover the swept field, the
1940 bomber, a formation, the Mother-Ship, the parachutist ladder, the chained ramp, and a bare
repaint; two of those routines post from more than one site.

★ **The ring carries no sound at all**, which is worth saying because it is the natural assumption
and it is wrong. Its sixteen commands are caption drawing at several colour phases, caption
erasure, the score, the remaining-plane icons and the round number — and several entries point at a
bare `ret`. Sound has an entirely separate queue, handed one byte per frame to the second CPU by
the interrupt epilogue. `[code]`

### The chained-hit ramp wraps rather than capping

Consecutive kills inside a window step the award up. A routine outside the poster, on the round
engine's service list, ticks that window down and holds the step at zero once it has run out — so
the chaining is enforced from *outside* the routine that benefits from it.

★ **At the top it wraps and keeps going.** `[seen]`, on the real machine: step 7 posts argument 8,
step 8 posts argument 1, step 9 posts argument 2. **The step counter keeps incrementing past the
table; it is the argument that cycles.** A reader assuming the counter saturates would predict the
top award repeating, and it does not.

Honest scope: reaching the top of the ramp was **seeded** in that capture, not played. Under the
same tape unseeded, natural play reached the fourth rung — and that unseeded run was the attract
demo rather than a credited game, so it is not evidence about a player either. The wrap is real
machine behaviour; whether anyone reaches it in play is a question none of this answers.

The window is reloaded to thirty and ticked down once per dispatch of that service list rather than
once a frame, and the ramp has a seam worth knowing: the routine that posts and the
routine that ticks the window sit at different points in that service list, so **a kill landing one
frame after the window expires posts the bottom award while leaving the old step standing.** `[code]`

### The score is six BCD digits and it rolls over

Three bytes, low byte first, packed BCD, per player, with the high score kept separately. The adder
discards the final carry, so the score **wraps at 1,000,000**. The readout suppresses leading zeros
and always prints the last two digits — which are permanently `00`, because every award record has
a zero low byte. `[code]`

That answers a puzzle in the public record: a recorded score of 15,000,000 is fifteen rollovers and
a scorekeeper, not a wider counter.

### ★ Extra lives: the ceiling is real, the "mode" is not

`gameplay.md` records a Wikipedia-only, uncited claim that extra lives stop at 960,000 and the game
enters a "survival of the fittest" mode. The code settles it.

Once a frame, while play is active, the machine takes the **high byte** of the active player's score
and searches for it in a table chosen by one DIP bit. Both tables were read straight out of the ROM
image (re-verified independently for this document):

| DIP | schedule | last award |
|---|---|---|
| factory setting | 10,000 then every 50,000 | **960,000** |
| alternate | 20,000 then every 60,000 | **980,000** |

These reproduce the manufacturer's own DIP table byte for byte.

**So the number is right and the framing is wrong.** Past the final entry the search simply misses,
and the miss path does exactly one thing: it clears the one-shot latch, the same as any other miss.
No counter moves, no mode is entered, nothing distinguishes "past the last threshold" from "between
two thresholds". "Survival of the fittest" describes the *consequence* of getting no more planes;
there is nothing in the ROM that switches mode. `[code]`

★ **And the ceiling is not permanent.** Because the key is the score's high byte and the score rolls
over at a million, the high byte returns through the low values and the whole ladder awards again.
On a marathon the player collects the full schedule once per million. That is a code-derived
prediction and no capture has tested it. `[code]`

The award is latched by a single bit so each threshold pays once, and since no single award can
raise the high byte by more than one step, no threshold can be jumped over. `[code]`

The award has now been watched paying out. Through a driven MAME run, a write tap with
program-counter attribution recorded the lives cell taking writes from exactly three instructions
— the decrement on a death, the context copy that swaps a player in, and **this routine's
increment** — and the increment fired on the frame the score crossed the first threshold on the
setting the cabinet was running. Nothing else in the game gives a life back. `[seen]`

The reserve display is posted with the count from **before** the increment, which is the same
convention the context-swap path uses: what the player sees is the cell minus the plane in the
air. `[code]`

### Parachutists: the ladder, the cap, and the era that has none

The parachutist is a **singleton** — one dedicated record and sprite entry with one manager, not a
pool. `[code]`

- **The ladder is 1,000 / 2,000 / 3,000 / 4,000, then 5,000 for every one after.** Four table
  entries, and a compare that sends every rung from the fifth onward to the same award record. The
  manual's chart trails off in an "ETC."; the cap the secondary sources assert is really there.
- **There are none in the final era.** The manager's first three instructions read the era index,
  compare, and return. The two sources that addressed the question were right; the one that said
  parachutists appear in every era was wrong. `[code]`
- **It arrives at the edge of the field, ahead of you.** The manager places its singleton at one
  of sixteen positions selected by the player's current heading — every one of them within a tile
  or two of the wrapped field's border, and every one of them within about forty degrees of the
  direction the plane is pointing. So it is not dropped at random and it is not dropped behind
  you: it enters from the edge you are flying at. The placement is armed on a cooldown and only
  on alternate frames. `[seen]` — a write tap on the singleton's two coordinate bytes matched the
  ROM table against the live heading on every one of nineteen placements, across eight different
  heading sectors.

  ★ Reading that table without the machine is a trap: the object's two coordinate bytes are
  `+0x31` and `+0x00` of its sprite entry, and taking them in the wrong order turns "ahead of
  you" into "behind you" for seven of the sixteen. The player's own entry reads `+0x31 = 0x78`,
  `+0x00 = 0x84`.
- **The rung counter is reset by the routine that places a plane on the field**, which is the same
  routine that pins the player's sprite at screen centre — so it covers both losing a life and
  starting a round, which is the shape the secondary record claims. Two routines write the cell in
  play — the life-start reset and the ladder's own increment — and a MAME write tap found no third
  in a driven run. It is not the whole writer set: the cell sits inside the block the boot clear
  wipes, so boot writes it too. `[seen]`

### Killing the Mother-Ship pays for the field it clears

`gameplay.md` notes that every source says the remaining craft are destroyed and **no source says
whether they score**. They do: every live actor slot is given a death code and its own award post,
worth twice a first chained kill. `[code]`

### Two-player state is kept independently — with one exception

Lives, round, era and score are per player: a sixteen-byte context block is swapped in and out for
the active player, and the score triples are addressed per player directly.

The swap itself is three cells and one bit. A one-bit index says who is up; losing a life copies
the live sixteen-byte block out to the index's own save and, if the *other* save still shows lives
left, flips the index, arms a delay and restarts the sequence step — and the block belonging to
the player now named is copied back in later, by a different routine. So a hand-over moves no
data at the moment it happens: it moves the *index*, and everything per-player follows because
everything per-player is addressed through it. `[seen]`

★ **Which value is which player is fixed, and it is fixed outside the swap.** Index zero is player
one. Three separate sites say so and none of them is the swap: the announcement caption is posted
at one record for zero and the next record for one, and those two records are identical but for
the single glyph that the score readout independently fixes as the digit one versus the digit two;
the score drawer chosen on zero is the one the two-player HUD pairs with the "1UP" caption; and a
one-player start arms the first save block and writes zero into the second. `[seen]`

**A one-player game can never hand over**, and that is not a special case in the code — it falls
out of the same test. The one-player start paths write the starting count into the first block and
**zero** into the second, and the branch into the swap is taken only when the block the index does
not select has a non-zero first byte. Measured on two MAME runs differing in one line — which
start button the driver pulses — the swap fired nine times under two players and **zero** times
under one. `[seen]`

**The HUD follows the index, on the glass and not merely in RAM.** Reading the glyph codes out of
video RAM at both score fields through a two-player game, the inactive player's six cells stand
still and the active player's move, swapping at every flip. In a one-player game the second field
is the blank glyph for its whole length: the same routine that draws two score fields when the
two-player flag is set draws one and then blanks six cells when it is clear. `[seen]`

★ **The parachutist rung counter is not in that block.** It is a single shared cell. In practice
every hand-over re-places a plane, which clears it — so the sharing is invisible, but it is sharing
and not separation, and a change to the hand-over path could expose it. `[code]`

---

## §8 The character plane: text, the meter, and a routine nothing reaches

The screen has two layers. Sprites carry the ship, the enemies and the scenery (§4). **Everything
else is character cells** — the captions, the score, the round number, the progress meter, the
player's own shots, and the explosion that plays when the player dies.

### Captions are glyph runs, with one exception the name does not cover

A caption is painted by walking a run of glyph codes terminated by a fixed byte, giving every cell
of the run one colour. The runs its callers select decode, through the board's own tile layout,
into the English captions the public record independently names — and two of them spell out the
exact bonus settings the hardware reads off the dip switches, which is a strong check that the
bytes really are glyphs. `[code]`

★ **Two records are not text at all.** They select second-bank tiles with three pen levels — a
shaded banner strip in which a byte is a *piece of a letter* rather than a letter. The routine is
the same; the data is a different kind. Anyone reading its name as "draws text" will misread those
two. `[code]`

The copyright caption is different again: it is stamped as **sprites**, into four display-list
slots, by a routine that reads nothing and can therefore be re-stamped harmlessly. A sibling hides
exactly those four slots by zeroing their vertical byte — the same store that retires an object
(§4). `[seen]`: it really does execute, so the glyphs are written and then painted over by the
tilemap. Written-and-occluded, not never-written.

**When it is hidden is the start of a game.** A write tap on one of those four bytes, attributed by
program counter through driven play, sees the stamper writing it over and over and the hiding
routine zeroing it on the frame the play flag goes up — the two paths that raise that flag, one per
start button, both call the hider first. `[seen]`

### A caption's colour flashes because three handlers take turns, not because one cycles

Four command handlers draw a caption from the same record table. One takes the colour stored in the
record. The other **three ignore that byte and derive the colour from one cell, each adding its own
fixed offset** before masking to four bits. Post them in rotation at the same caption and its cells
change colour every few frames; post only one and the colour is whatever that cell holds, held
still. The three offsets are **0, 5 and 10** — equally spaced round the sixteen-colour wheel the
mask implies — and the fourth handler, the one that takes the record's own colour byte, is the entry
the handler table sends index 1 to. `[code]` for the offsets, which are immediates in the image.
`[seen]` — a write tap on the colour cell under an attract caption attributes the rotation to three
separate arrivals through the shared painter, and across a long attract run each caption index was
drawn at one and only one value of the source cell, so no single handler ever changed its own
colour. Re-measured from the other side: a read tap at each of the three entries, logging the
accumulator and the source cell together, found the `+10` handler painting caption 27 at source
value 2 and caption 28 at source value 3, every time and at no other value, across 90 s of attract
and a 200 s driven game. A handler that cycled its own colour could not do that. `[seen]`

The source cell is not a frame counter. It is written from a ROM table on the sequence's own steps,
takes a handful of values in an attract loop, and never reaches the wrap its four-bit mask implies.
`[seen]` for the values, `[code]` for the writers.

### The progress meter is the quota, drawn

The bar along the bottom is a direct rendering of the kill-quota cell: its run length is the cell
shifted down, with an eight-level partial tile from the low bits, in era-keyed tiles. `[seen]`

Grounded by forcing the quota cell alone for the three frames before a snapshot, in MAME runs
otherwise identical: two runs forcing the same value gave byte-identical images, and two values
four apart differed in one 8×8 character cell at the bottom of the glass and nowhere else. So the
cell the routine writes is the cell the player sees, and four kills are one tile.

This is why §6 can say flatly that the game has no timer. The bar and the 56 are the same fact
rendered two ways, and the single public source that called it a "time bar" was watching the kill
meter fill.

### The nibble-pair drawer draws DECIMAL digits, not hexadecimal

One drawer masks a value to four bits and indexes a sixteen-entry table of glyph codes at 0x0DCC;
its only caller splits a byte into high nibble then low, which invites the reading that it prints a
byte in hex. It does not. Decoded through this board's own character layout, entries 0-9 of that
table are the glyphs `0`-`9` and the remaining six are not letters: three are blank tiles — one of
them the blanking glyph the whole game erases with — one is a period, one is an unrelated shape,
and the last repeats the glyph `3`. So the table covers only the digits a packed-BCD byte can
hold, which is what the machine keeps its counters in. `[code]`

### Leading zeros are blanked, and one flag carries the whole number

The suppressing twin of that drawer takes the same nibble but chooses the glyph three ways: a
non-zero digit indexes by its own value and steps a flag on; a zero indexes the blank while the flag
is still clear; a zero indexes the digit `0` once it is set. The flag lives in the caller across the
whole number and is cleared before the first digit, and the drawer that lays a number's last two
digits is the NON-suppressing one — so a value of zero still shows its final digits. `[seen]` — a
tap logging the digit, the flag and the destination on every dispatch caught the same digit zero
painting the blank with the flag clear and the digit `0` with it set, the flag turning over exactly
at the first significant digit.

### A pictogram strip counts in thirties, tens, fives and ones

One command handler clamps its argument below a hundred, splits it into counts of thirty, ten, five
and one, and lays a row of pictograms at a fixed place in the character plane — a different picture
per denomination, and a different SIZE: one tile for the units, two for the fives, and a four-tile
block for both the tens and the thirties, the last two differing only in which tiles and which
colour. The row is padded out to its end with the blanking glyph. `[code]`

★ **Both the four-tile and the two-tile painter have now been made to run, and the argument that
reaches the splitter in attract is not the round number.** A read tap on the splitter's accumulator
says the value it is handed on the path the attract loop and a driven game both take is **1** — the
constant, from the first of the two posting sites — so the strip lays one unit pictogram and
thirteen blanks, and the fives and thirties painters cannot fire. Holding `ROUND_NUMBER` and both of
its saved copies at 37 for a whole run changed nothing, which is the cleanest evidence that this
path does not read that cell. Posting the ring command directly with the argument 37 — one thirty,
no tens, one five, two units — dispatched the four-tile painter exactly once, the two-tile painter
exactly once and the single-tile painter twice more, and a write tap caught the two-tile one laying
codes `0x32`/`0x33` and the four-tile one laying `0x23`-`0x26`, both coloured `0x11` a plane below.
`[seen]`. **The strip is fourteen positions long whatever the value**, padded out with the blanking
glyph. The second posting site, the one that passes `ROUND_NUMBER`, still needs a completed round
and no tape has finished one.

### A grid of empty boxes runs at power-on, and is wiped before the attract loop

Between the dip-switch read and the first interrupt, one routine tiles 28 of the character plane's
32 lines with a 2×2 block of four fixed codes. Decoded through the board's own character layout the
four are the corners and edges of **a closed 16×16 box**, so what the plane carries is a grid of
hollow boxes, 16 across and 14 down. `[code]` for the tiles.

It really is on the glass, and it really does go. `[seen]`: a census of the same 896 cells found the
plane already blank before the fill (all blanking glyph), the full pattern standing from frame 35 to
frame 236 with the video-enable bit set, 812 cells left at frame 240, and none at frame 300 — the
boot wipe, which cannot start until the interrupt does. About three and a half seconds of a cold
machine, once per power-on, and never again: the tiling routine dispatched once in every run and the
block-stamper 224 times, to 896 distinct cells with no cell written twice.

This is a power-on pattern, not a background. Nothing in the game draws on it and nothing restores
it.

### Player shots live here too

Shots have no sprite entry. They are painted as 2×2 blocks of cells through a **double-buffered
display list**: one walker blanks the previous pass's cells, another writes this pass's, and the
list is then copied onto the blank list wholesale and its cursor reset — all inside the interrupt.
Both walkers check each cell's colour-plane priority bit and **skip the cell if it is set**, so
shots refuse to scribble over foreground and HUD cells. `[code]`

★ **The pairing is now measured, not derived.** A write tap over the whole character plane on the
real ROM under MAME, attributed by program counter and compared per pass rather than per frame: over
3767 passes with a non-empty set on either side, the set of cells the blanking walker erased was
EXACTLY the set the painting walker had written on the pass before — equality tested in both
directions, with no exceptions. The tap is not blind to the alternative: twenty-six other program
counters wrote the same plane in the same run and were bucketed separately, the kill meter's two
stores alone taking 25392 writes. `[seen]`

Two consequences a reader would otherwise get wrong. The pass is a dispatch of the shared drain, not
a video frame, and the count of pending entries is read off the low half of each list's own cursor —
so a cursor that scales to a count of zero is **not** an empty list, and both walkers run 256 times
on it. And the blank list's cursor carries a top bit the copy adds, which its walker masks away
before scaling; the mask cannot change the entry count, only whether the list reads as empty, and
that for exactly one cursor value in 256.

The publish step has an empty branch, and it is the branch that keeps the two buffers in step:
when the staging list has nothing in it, a separate routine puts **both** cursors back to their
empty sentinels rather than copying nothing over a stale erase list. Measured under MAME by
program counter, that routine wrote the two heads an equal number of times, while the copying
branch wrote only the staging head. `[seen]` The same routine is what empties the pair at
initialisation.

### ★ A routine that is live, correct, understood — and never reached

`fillCellRun` fills a fixed-length run of cells with one byte. Under every instrument pointed at it,
including a four-minute driven run of the **real machine** with sibling routines in the same sweep
proving the tap fires, it has **never once dispatched**. `[seen]`

It is not dead code. It belongs to a screen our instruments never reach.

Its call sites sit in two sequence sub-steps that the attract loop never enters — confirmed three
independent ways, the cleanest being that the sub-step cell never takes either value across a
3602-frame capture. What arms them is the routine that checkpoints the live player block and then
writes that sub-step directly; the second of the two hands off to the sub-step that arms the round
HUD. So this is the **inter-round / player-change transition**, and a demo that never finishes a
round never performs one. `[seen]` for the zero dispatches and the sub-step observation, `[code]`
for the arming path.

### A whole animation machine sits behind the same door

`fillCellRun` is not alone behind the inter-round transition. A **five-step animation state
machine** on the player's own sprite is dark by exactly the same measurement: a dispatcher that
switches on a step cell and calls one or two handlers per step, the five handlers, the two
routines that initialise the step block, and the sound the first handler requests — every one of
them at **zero dispatches**, across an undriven run, a one-player driven game played to game
over, a two-player driven game, two free-play runs and an era-4 poked run. `[seen]`

The absence is worth something only because the same instrument, in the same runs, was counting
five-figure dispatches at other addresses in the same sweep — tens of thousands at a sprite
dresser and at a scenery wrapper. The taps fire; these routines do not run.

What the machine *does* is readable even though it is never seen to run: each step recolours the
player's sprite attribute from a counter, preserving the attribute's top two bits and replacing
the rest, and hands on to the next step when its counter runs out. One step alternates the colour
field every frame between a value and zero; another alternates between two values every fourth
frame, on a countdown. That is two different flashes at two different rates. `[code]`

**What it is FOR is not established, and this is the honest shape of the gap:** the code fixes
the mechanism and cannot fix the occasion. Death is ruled out — §6's write tap shows dying goes
through the state byte and the death countdown, not through this cell — which leaves a
celebration, a hand-over or a bonus screen, and nothing we can reach distinguishes them. The
routines therefore keep their addresses.

No `call` or `jp` to the dispatcher exists anywhere in the ROM. Its address appears as a
little-endian word at five offsets in the image and not one of them is the operand of a call or a
jump: four sit inside unrelated data or instruction streams, and the fifth — the one that looks
like a conditional call, because the byte before it is `0xD4` — is the second byte of a
`set 2,h`. That is a second method answering the same question as the sweep, *can control reach
this address*, and it agrees.

It is still **not** a dead-code claim. The dispatcher could be reached through a computed address
or from a span the disassembly has not covered, and a routine reached only from the screen our
instruments never see would look exactly like this either way.

★ **An earlier reading of ours had this wrong, and how it was wrong matters more than the error.**
It held that the routine was the repair half of a *check-then-repair pair*: that a reachable routine
inspects a thirteen-cell colour strip and, on finding a cell wrong, jumps to the branch that
repaints it.

The inspection is real — thirteen cells in the colour plane, stepping one cell along the line. **The
repair is not.** That failure arm jumps into **caption data**, which is this ROM's anti-tamper idiom
(§2). It is a tamper check whose failure is a deliberate crash, and the same document already
describes two other traps of exactly that shape.

The misreading was convincing because the branch target was taken for a routine **on the strength of
a transcribed file existing for that address** — and that file is itself a decode of caption data as
code. §10 records the general form, because it will happen again.

**Also refuted, and it was our own hypothesis:** that the routine belongs to high-score initials
entry. The initials screen is a different sub-step and never calls it. `[code]`

### Two more routines nothing reaches, and they are not the same kind of thing

`fillCellRun` above is unreached because its screen is. Two others are unreached for reasons worth
separating, because only one of them is a limit of our tapes.

**`startNextRound` is unreached because no tape has finished a round.** It steps the round number,
rolls the era on and wraps it after the fifth, sets the round's difficulty byte by round bracket,
refills `KILL_QUOTA` into the kill meter, and arms a flag. Three MAME sweeps dispatched it zero
times, and a write tap corroborates from the other side: every write to the cells it touches came
from the sixteen-byte per-player context copy instead, never from this routine. Its two doors are a
completed round and a life lost while the round-over flag is set, and that flag was never once
non-zero in a run covering boot, attract, the demo and a driven game. `[seen]` for the zeros;
`[code]` for what it does.

**`loc_13cc` is unreached AND unnamed, deliberately.** It floods a 27-by-28 rectangle of the colour
plane with a byte the active-player selector picks, sets one sequence cell and counts another down.
Neither of those two cells took a single write in a whole run, which is a second instrument agreeing
with the zero dispatches. ★ And its two arms — chosen on the screen-flip flag — write **the identical
rectangle with the identical byte**, ascending from one corner or descending from the other. The
flip test changes only the ORDER of the writes, which can matter against the raster and nowhere
else. A name built on the flip would assert a difference in the result that does not exist, and a
name built on the flood alone would drop the sequence stepping that is half of what it does. So it
keeps its address. `[seen]` for the zeros; `[code]` for the identical rectangles.

★ **One of this game's "nothing reaches it" entries is reached — by the two-player start.** A
guard comparing a character cell against a copy of itself takes its passing arm once, in the
credit mode with play already active, on a tape that coins twice and presses the two-player
button; the machine runs on normally for thirteen thousand further frames afterwards. Eight
single-player sweeps and four grounding tapes reached it zero times. The lesson is the one this
section already teaches, with a new instance: **an unreached set is a fact about the states the
tapes drove**, and two-player was the state nobody had driven. `[seen]`

### The cursor helpers are exact inverses

Stepping the character cursor forward and back are two routines on the same axis, and the leading-
zero suppressor depends on it: it blanks a digit and returns so that the caller's following advance
nets to zero, which is only coherent if the two are exact inverses. `[seen]`: the retreat helper
fires, but on a small fraction of its sibling's dispatches — exactly the shape a suppressor that
runs only on the digits actually suppressed should have.

---

## §9 What the code settles

`gameplay.md` ends with two dozen numbered questions the public record could not answer, ordered by
how much a faithful reimplementation depends on them. This section answers the ones the lifted code
can, and says plainly which it cannot. **Every answer here is `[code]` unless marked otherwise** —
derived from the ROM, not watched on a screen.

| # | the question | the answer |
|---|---|---|
| 1 | Is the quota 56 for every era and every loop? | **Yes, always.** One byte, loaded once at boot from ROM. Not era-, loop- or DIP-keyed. The later-round escalation lives in a different cell. |
| 2 | What counts toward the 56? | **Only the seven ordinary enemy-craft slots.** Not projectiles, not the 1940 bomber, not the Mother-Ship, not the pickup. Projectiles still score. |
| 3 | Mother-Ship behaviour | Partly. Two-slot object, armed after a delay, per-era speed. **Hits count from any angle**, and the count **never falls below five across appearances** — the first two hits persist, later ones are undone. Which edge it enters from, and whether it fires, are open. |
| 4 | Does clearing the Mother-Ship pay for the enemies it sweeps? | **Yes** — one post per live slot, and they explode in a ripple. |
| 5 | Does ramming credit the points? Can you ram the Mother-Ship and still advance? | **Both yes, by separate mechanisms.** Ramming an enemy craft posts a score; ramming a projectile does not. Ramming the Mother-Ship zeroes its hit counter, so it dies outright. |
| 6 | The 1940 bomber: three hits or four? | **Four.** The manual is right; StrategyWiki is wrong. |
| 10 | Parachutists in the final era? | **No.** The manager reads the era index and returns immediately. |
| 11 | Is the pickup ladder capped at 5,000? | **Yes, hard.** Four table entries, then the same award for ever. |
| 12 | What resets the ladder? | The routine that places a plane on the field — which covers both a lost life and a new round. |
| 17 | Is the player's speed fixed? | ★ **No.** It steps up twice across the eras, and the public record appears to have missed it. See §3. |
| 18 | Is there an extra-life ceiling at 960,000 and a "survival of the fittest" mode? | ★ **The ceiling is real; the mode is not.** The bonus table simply ends. And rollover restarts the whole ladder. |
| 20 | Score width and rollover | **Six BCD digits, rolls at 1,000,000.** A recorded 15,000,000 is fifteen rollovers. |
| 21 | What happens when you die? | Fully answered, and all of it new — **no invulnerability window**, respawn at the pinned position, and **the kill counter is not reset**. See §6. |
| 22 | Two-player independence | **Yes** for lives, round, era and score, and now watched rather than derived: a two-player MAME run alternated the two players nine times, with each one's score field moving only while it was up. ★ The pickup rung counter is a **shared** cell, masked by the fact that every hand-over clears it. |
| 24 | Is there a timer anywhere? | ★ **Nothing times the player.** The bottom bar renders the kill quota; the source calling it a "time bar" was describing the kill meter. Short countdown cells exist in the interrupt (§2), but none races the player. |

### The pattern in the misses

The public record is not sloppy; it is **outside-in**, and every place it goes wrong is a place
where the inside and the outside genuinely look different.

- It calls the player's speed fixed because **the plane never moves on screen.** The ship is pinned
  and the world is what accelerates, so there is nothing on the glass to measure the change
  against — and the enemies speed up too.
- It reports a "time bar" because a bar that fills toward an event looks like a clock.
- It splits three ways on the bomber's hit count because a counter that starts at three and dies on
  the fourth hit can honestly be described either way, depending on whether you count the one that
  kills it.
- It could not settle what happens on death because **nothing about death is visible except its
  consequences.**

Where the record and the code disagree, the record usually describes the *experience* correctly and
the mechanism wrongly. That is worth remembering when using it as evidence: `gameplay.md` is a
reliable witness to what a player sees and an unreliable one about why.

### What the code cannot settle, and what would

These need the real machine, not more reading: `[code]` is the wrong instrument for all of them.

- **Whether the speed-up is perceptible.** The numbers differ; whether a player can tell is a
  question about eyes.
- **The Mother-Ship's entry edge and whether it fires.**
- ★ **Whether the Mother-Ship really takes seven hits or eight.** The same arithmetic that gives the
  1940 bomber four hits from a counter of three gives the Mother-Ship eight from a counter of
  seven — contradicting the manufacturer. Flagged rather than published.
- **Formation composition and the bonus window** — the per-era spawn parameter table is not
  transcribed. See §11.
- **What the player actually perceives of the era boundaries**, given that the two subsystems that
  read the era index divide it at different rounds.

---

## §10 What our instruments can and cannot see

Most entries here have already caused a false claim; the rest are limits caught before one could
form. They are recorded as instrument properties, not as history, because each will cause the next
one too.

### ★ The oracle's own fidelity has a scope, and it is narrower than the claim it carries

**This is the most important limitation in the document, because everything else rests on it.**

The translated layer is described as byte-exact against MAME. That is true, and it is scoped: it
holds for routines the golden capture actually **dispatches**. `tools/pixel_suite.py` drives its
tape with `Coin 1` and `1 Player Start` and nothing else — **no fire, no direction** — for
`SECONDS = 30`, `GOLDEN_FRAMES = 1802`. A routine that tape never reaches contributes no evidence in
either direction. It is **unobserved, not verified.** A substantial fraction of the registry is never dispatched under
the golden tape, and no figure for it is quoted here on purpose: the shape is what is durable, and
anyone who needs the number should measure it rather than inherit it.

The consequence reaches the whole idiomatic layer. Each idiomatic module is proved memory-equivalent
**to the translation**, never to MAME directly. Where the tape dispatches, that composes into a
chain back to hardware. Where it does not, it is a proof of agreement with an **unverified
reference** — internally consistent and unanchored.

`games/timeplt/tools/unit_equiv.sh` is the instrument that would close this: per-routine
equivalence, tape-configurable, fire- and direction-capable, 90-second default, entry list rebuilt
from `translated/` at run time. **It is wired into no gate, no Makefile target and no hook, and has
never been shown to run clean.** Recording this gap is not closing it.

The gap was already known in exactly one place. `idiomatic/test/equivalence-5211.test.js` says, in
capitals: *"THE SHARED DRIVEN TAPE IS TOTALLY BLIND TO THIS ROUTINE, AND THAT IS THE HEADLINE. The
coin -> start tape never presses fire, so no shot slot is ever live."* Every artifact carrying the
claim forward stated it unqualified. **A caveat that lives in a test comment and is absent from the
durable record is functionally not known at all** — the next reader inherits the confident version.

★ **But do not over-read the tape's input list, because it mis-states the fix.** The capture is not
thirty seconds of a title screen. The attract **demo runs the real play arm** — the era index
advances during it and it fires — so a substantial amount of gameplay code is dispatched with no
input at all. That is why coverage is a large fraction rather than a sliver. The same test file says
so: *"The real teeth are the undriven ATTRACT demo, which does fire, and a crafted space."*

So the honest form of the gap is not "gameplay is never exercised". It is: **the only gameplay the
oracle has been checked against is whatever the demo happens to do, and the demo is not a player.**
It never collects a parachutist, never dies deliberately, never finishes a round, never reaches the
later eras — and, being one plane, never hands over to a second player, which is a whole branch of
the round machinery the demo cannot enter at all. Adding *any* input would not close this; adding input that reaches **what the demo never
does** would, which is precisely what `unit_equiv.sh`'s tape parameter exists for.

### ★ A driven tape measures the eras it reaches, and it reaches two

The strongest not-reached list this document has produced was wrong about three routines, and the
reason generalises. A tape that coins up, flies and fires never survives four rounds, so it lives in
the first two eras — and whole families of handler are gated on the era with `cp 2` and `cp 4`. On
one sweep three cluster routines read as never dispatched; holding the era cell at 4 while play ran
dispatched them 8225, 38749 and 48894 times.

So a not-reached row is a statement about which ERA the tape lived in before it is a statement about
the code, and the fix is cheap: hold the era and sweep again. The poke has to be written every
frame, not once a second, because a routine that borrows a different rate row writes the era cell
twice in three instructions and leaves it on whatever it last set.

What the technique does NOT reach is anything gated on a round actually ending — see §8.

### A read tap over-counts, because the ROM reads itself

This ROM folds blocks of itself through anti-tamper checksums, and a memory read tap counts a
checksum pass as a hit. Under an ungated sweep, routines two agents had independently proved dark
showed non-zero counts. Any reachability instrument here must gate on the program counter. `[code]`

### A PC-gated tap cannot tell an entry from a loop head

The gate re-triggers on every turn of a wait, so a routine that spins on the beam reports its
iterations as dispatches. The decisive case: an address our own machine measures at **zero**
dispatches reports **54659** PC hits on the real machine, because it lies inside a busy spin and is
never called at all in that run. `[seen]`

**So a PC hit count is a dispatch count only for a routine that does not wait.** For anything that
waits it is an iteration count wearing a dispatch's clothes — which is precisely the class the
raster and sprite-multiplex work lives in. Two agents once produced confident and opposite frequency
orderings for the multiplex twins; both should be disregarded, and nothing available settles it.

### A call-site grep misses computed dispatch, in both directions

The mnemonic form `(call|jp|jr) 0xADDR` misses a call whose target is computed and loaded into a
register first; `0x181d` scores zero by it and is a genuine entry, reached as a pushed return
address that the transcription renders as `m.call(0x181d)`. The `m.call` form in turn misses tail jumps the transcription
renders as something else. **Take the union of both forms and treat even that as a lower bound**,
because table dispatch is invisible to either. A zero from one form alone means "look harder", never
"not an entry". `[code]`

### ★ A transcribed file is not evidence that its address is code

The lift faithfully transcribes whatever bytes it is pointed at. A `translated/loc_<addr>.js`
therefore records that somebody attempted a decode at that address — **never that the address is an
entry point.** Several files in the layer are decodes of *data*: velocity tables reached only by
anti-tamper traps, and caption records sitting a few bytes from a real routine. Several of them
give themselves away by calling addresses outside the ROM entirely.

**No exhaustive determination of this set has been made.** Treat it as open rather than as a list.
The cases below are additions to that set, not a closure of it.

This deserves its own entry rather than a line in the list above, because the misleading artifact is
a **file** — the most authoritative-looking object in the repository. Most other limits on this page
are a measurement lying, and a measurement invites suspicion. A checked-in source file does not,
which is why this one cost a false claim in §8 of this very document and survived hours of drafting
before anything caught it. `[code]`

#### The worked example: one address that refuses to have a single answer

**0x0F8D is read as a table by two routines and jumped to as code by a third.** It has exactly three
references in the image, and they do not agree about what it is.

- 0x0F8C is `c9`, a `ret`. 0x0F8D through 0x0F96 is `f1 01 f1 02 f1 03 f1 04 f1 05`, and real code
  resumes at 0x0F97.
- 0x3381 doubles the selector (`add a,a`), points HL at 0x0F8D and takes the byte there through the
  index-and-fetch restart at 0x0008; it then steps one on and takes the next byte as well.
- 0x33AE doubles the selector, points HL at 0x0F8D, forms the address through the index-only restart
  at 0x0018, and copies exactly two bytes — `ldi` twice.
- 0x5308 is `jp nz,0x0f8d`. The value tested is a byte-sum walked over a block of the ROM by 0x43E8
  and handed down a chain of tail jumps before being compared against 0x67.

★ **The two-byte record is the reading the USING CODE performs, not our reading of the bytes.** Both
readers double the selector before indexing, and both consume two consecutive bytes; the table's own
content agrees, a constant first byte against a second running 1 to 5. Nothing in the bytes says
"two-byte record" — the arithmetic in front of them does, and that is where a code/data
determination has to come from.

★ **And the reference graph cannot settle code-vs-data here, even in principle.** The third
reference arrives only on the arm where that sum fails to match — one of the self-checks §2
describes — so the tamper arm makes the data a jump target ON PURPOSE. An instrument that asks "is
this address the target of a transfer" answers yes, correctly, about a routine that does not exist.
`[code]`

#### A misdecode that MANUFACTURES a call-graph edge

`translated/loc_307f.js` transcribes 0x307F-0x3089 as instructions. Those bytes are a **caption
record**: the first two are a destination in video RAM, the third a colour, and the rest a glyph run
closed by 0xB9 — the terminator `drawTextRun` tests. 0x307F is one entry of the pointer table at
0x0C50 that the caption routines index to choose which one to paint.

★ **Its misdecoded `djnz 0x3074` is the only transfer into 0x3074 in the whole image.** A linear
decode from every byte offset finds that one and no other, and the little-endian word `74 30` occurs
nowhere, so no table names it either. A routine's entry status currently rests on a misdecode. That
is worse than a bad decode sitting inertly in the layer: it manufactures an edge, and anything
deriving entry points from the reference graph inherits it as evidence.

On this evidence 0x3074 is interior rather than an entry. **0x306A-0x3073 is untranscribed**, and it
is that routine's real prologue — two `iy` loads and a pair of immediates into H and L — which the
transcribed body at 0x3074 continues. Its siblings at 0x3058 and 0x308A open with the same two `iy`
loads and reach the same tail at 0x309B, so the family's shape puts the boundary at 0x306A. `[code]`

**0x1F76–0x200B is a five-frame tilemap animation, not code.** Five records of thirty bytes, each
six rows of five tile codes with the blank glyph as the pad, copied into the character plane and
its colour plane by a loop that takes both counts from ROM bytes. A seven-way compare ladder picks
the record from a per-object countdown, and two of the five records are each selected by two of
the seven arms, so the shape grows and then shrinks; the fifth record is entirely blank and erases
it. `translated/loc_1f99.js` and `translated/loc_1f2e.js` are both this field decoded as
instructions and belong on this list.

**0x5254 is not a routine.** It is the loop tail of 0x5211, and `translated/loc_5254.js` is a
second transcription of bytes `translated/loc_5211.js` already carries; the idiomatic layer covers
them inside `destroyTargetsHitByShots`. No pointer anywhere in the image names the address, and
its only inbound transfers are two branches from inside 0x5211's own body.

#### A data table decoded as a hundred bytes of instructions

`translated/loc_2251.js` decodes 0x2251-0x22B8 as instructions ending in a `halt`. 0x2251 is one of
three sibling tables — 0x218C, 0x2251, 0x22FA — all opening `3c 3c 3c 3c`, and all three are handed
to the same reader at 0x2123, which takes the table's first byte as a countdown seed and writes the
table's base into work RAM as a pointer. That reader treats all three as data, and only one of them
has a file. Its single transfer, `jp 0x2251` at 0x213D, sits behind a test on the work-RAM pair
0xADFB/0xADFC: the anti-tamper idiom again. `[code]`

#### The bytes exist twice

`translated/loc_1098.js` covers 0x1098-0x1198 and inlines the block beginning at 0x10F8;
`translated/loc_10f8.js` transcribes 0x10F8-0x1198 over again. Benign today — the only transfers
into 0x10F8 are two branches inside 0x1098's own range, so nothing enters it from outside its owner
— but it is exactly the duplicate-transcription shape `translation.md` warns about, where one span's
bytes exist in two files and the copies drift the moment either is edited. `[code]`

#### Two refusals, and they are the method working

At 0x0F8D and at 0x1F99, agents writing the idiomatic layer DECLINED to produce a module and said
why, rather than carrying the frozen decode forward. Both addresses already carry a `translated/`
file, so the refusals did not prevent the defect — they stopped it propagating into the layer that
ships. In a project carrying this defect in its own oracle, an agent that will not treat data as
code is the system learning rather than repeating, and it is worth recording as a result and not
only as an absence. `[code]`

### ★ A rewrite's header is silent about the ROM BY RULE, and silence is not a finding

The entry above is about a layer that says too much: a transcribed file asserts a decode it was
never in a position to justify. This is its mirror, and it costs the same kind of false claim from
the opposite direction.

A comment in `games/<game>/idiomatic/` may describe THAT FILE and nothing else — not the ROM, not
the frozen decode, not a sibling routine. So when a rewrite's header says it steps over a byte
unread, that is a true and complete statement about the rewrite, and it carries **no claim
whatever** about what the byte is. The header is not being cautious; it is forbidden to say.

★ **So an enforced silence reads exactly like a finding of absence, and it fails hardest where it
matters most.** The routine that DOES use the byte is a different file — precisely the one this
header may not mention. The caption record's colour byte is the worked case: most of the routines
that index the caption table never read it — some take a colour from a work-RAM cell instead, some
write no colour at all — so their headers correctly report skipping a byte, while the one reader
that unpacks the record's full header takes the colour from exactly that byte. Read the skippers'
headers as a refutation and you conclude the byte has no role, in the teeth of the ROM.

Ask the ROM, and enumerate the readers — never a header that was told not to talk about them.
`[code]`

### ★ "Dark" means dark in the eras the tape visits — and one list proves it

The driven tape does not get far into the game, so a routine serving later content reads exactly
like dead code. This is not a worry; it is measured. The three shims that arm the player's velocity
table decay in precisely the order that says where the tape stops:

| shim | selects for | PC hits |
|---|---|---|
| 0x594E | era 0 | 5784 |
| 0x5965 | eras 1–2 | 962 |
| **0x596B** | **era 3 and up** | **2596** (attract, era 3) / **2821** (era 4 held) |

`[seen]` for the counts; `[code]` for which era each arm serves, which is read from `loc_1f42`.

★ **The zero this table once carried for `0x596B` was the tape's, and a later sweep collected the
number.** An undriven attract run that reaches the fourth era dispatched it 2596 times, all of them
attributed to era 3; a driven run holding the era index at 4 dispatched it 2821 times, all at era 4;
and two runs that stayed in eras 0-2 dispatched it zero times. So the row's own prediction — era 3
and up — held, and the lesson below stands for a better reason than it did: the arm was never dark,
only unvisited. `[seen]`

Four of the twelve addresses on our own "proven dark, do not spend a batch slot" list are one cause:
`0x596B` is the player's top-speed arm and has since been watched executing thousands of times,
`0x5860` and `0x58A4` are later-era enemy shims — and
`0x59D7` **is not code at all.** It is the slowest velocity table, dark because a program counter
never enters data.

Two lessons, and the second is the uncomfortable one. Striking `0x596B` off as dead code would
delete the arm that gives the player its top speed. And a list that cannot distinguish *data* from
*unreached code* excludes the right things for a reason that does not generalise — the same
blindness will admit a data table as a candidate just as readily. Entry candidacy needs a code/data
determination the sweep does not supply.

### Our own engine is not a grounding instrument

A measurement from `new Machine(ROM).runFrames(...)` is our engine replaying the ROM. It earns
`[code]`. This is stated twice in this document on purpose.

★ **A read tap counts the debugger's own reads.** A Lua `read_u8` from a frame notifier goes through
the tap like any other access, and the program counter it is attributed to is wherever the CPU
happens to be parked — so a per-frame sample of three cells produced three IDENTICAL, plausible
program-counter histograms concentrated in the command-ring drain loop, a routine that reads none of
the three. Two things caught it: the counts summed to exactly the frame count, and the loop's own
disassembly reads `0xACxx`. Guard every debugger-initiated access with a flag the tap checks, or the
instrument reports its own footprints as the game's.

★ **A dip override can read back as not-taken on the frame it is set.** Setting the cabinet dip and
reading `0xC200` in the same notifier call returned the unchanged default, and the field's own value
also read unchanged — yet the override had taken: later in the same run the port read with the bit
set, the field reported the new value, and the game's cocktail cell was non-zero for a quarter of
the run. Read a dip back on a LATER frame. An immediate read-back is a false negative, which is the
failure mode most likely to make someone abandon a working experiment.

### ★ MAME persists DIP positions between runs, and `-nowriteconfig` does not stop it

MAME writes `cfg/<game>.cfg` regardless of `-nowriteconfig`, which covers the `.ini` files and
not the per-game configuration. DIP positions therefore **survive from one process to the next**,
and with two runs going at once the last to exit wins.

This is not hypothetical here. Run from a fresh configuration directory this machine's dip ports
read `0xFF` and `0x4B`; run from the repository's own directory they read `0x7E` and `0x4A`,
because an earlier session's coinage experiment left three switches off their defaults —
both coin settings and the life count. Every grounding run this port made before this pass
inherited that cabinet and recorded its ports faithfully without anyone noticing they were not
the defaults. Nothing measured that way is wrong; it is just a measurement of a machine nobody
chose. **Pass `-cfg_directory` per run.** `[seen]`

### ★ A DIP switch can be driven, but not by the obvious call

`field:set_value()` is a digital override. On a multi-position DIP it **returns success and does
nothing** — the port reads back unchanged, which is the exact shape of a check that cannot fail.
`field.user_value = n` does move it: driven through all eight positions, this machine's
difficulty switch read back as eight distinct port values in the right bits.

One trap comes with it. Applied on the first frame, the write lands before the port defaults are
seated and drags **other fields on the same port** with it — setting difficulty took the life
count from 2 to 0. From frame sixty on, the neighbours hold. Read both ports back after the write,
every run, and print them. `[seen]`

### ★ A duplicated tap doubles a count and passes its own assert

An instrument this pass wrote listed four addresses twice, installed two write taps on each, and
counted every write twice. The count-assert passed, because the list really did contain that many
entries. What caught it was arithmetic against a neighbour: a routine dispatched 22 times stores
two cells in the same breath, and the tap reported 22 for one and 44 for the other. The general
form is the one this section already records — **a broken instrument returns a believable number,
never an error** — and the defence is to cross-derive every count against something that must
agree with it.

### ★ Two routines the memory-equivalence contract cannot express

Memory-equivalence drops the T-state clock deliberately: a rewrite is judged on the bytes it leaves
in RAM, never on how long it took. Two routines on this machine fall outside that. They are facts
about how the machine works, not unfinished work, and neither is waiting on anyone.

**0x0F97, the non-spinning twin of `multiplexSpriteSlots`.** Its eight blocks each test one slot's
request byte against the LIVE RASTER COUNTER at 0xC000, and that counter advances with the T-states
the routine itself spends — so each read the ROM makes sees a later beam position than the read
before it. A rewrite that charges nothing sees the entry position every time, and the two part
company wherever the beam crosses a block's threshold mid-routine. This is measured, not argued: run
against the frozen layer on real dispatches, under the driven tape and under undriven attract alike,
a cycle-free rewrite diverges on a MINORITY of them. That minority is the dangerous shape — a spot
check of one entry finds the two identical, and the first cell to part company is a sprite-RAM byte
the oracle displaced by half a screen while the rewrite left it alone. `[code]`, and emphatically
so: both arms of that comparison are ours.

**0x0B93, the foreground command-ring drain.** It is a loop with no exit of its own; the ring is
refilled from outside it, by the interrupt. The engines that drive this port schedule that interrupt
on something the running code produces — the T-states it charges, or its arrival at a declared poll
address — and a cycle-free JavaScript loop produces neither, so the ring is never refilled and the
loop spins for ever. Measured under the poll-PC engine `runCycleFree`: with the oracle in that path
the run reaches its whole frame budget in milliseconds; with a cycle-free rewrite there it reaches
the first frame boundary, never reaches a second, and has to be killed. Under the cycle-driven
harness the two arms look identical instead, which is not a contradiction — a short capture there
does not dispatch this routine at all, so that harness settles nothing either way. `[code]`

★ **The discriminating rule, because it is the transferable part.** The test is not *"does this
routine read a timing register"* — it is **"does this routine's behaviour depend on time IT ITSELF
consumes"**, including "does it make progress only because time passes". A routine that WAITS on the
raster converges however long it takes; one that SKIPS on a raster test does not. The waiting twin
`multiplexSpriteSlots` is already idiomatic, dispatched, and a transparent swap under the
whole-machine gate — same register, opposite outcome. That contrast is what shows the rule
discriminates rather than merely excusing the two routines it excuses.

---

## §11 What is still open, sorted by what would close it

★ **Transcription is essentially complete; understanding is not.** After two corrections to its own
derivation, an audit of the untranscribed remainder of the ROM found **almost no established real
code in it** — what is left is very largely data tables, among them several of the velocity tables.
Not all of those tables are outside the transcription: the lowest one is transcribed in full, by the
file this section later holds up as the model. And "no code at all" would overstate it, because one
short block in the remainder decodes cleanly and calls the quota decrement. The distance between
"we have the ROM in JavaScript" and "we know what the game does" is **not a lifting gap.** It is a
reading gap and a grounding gap, and sorting the open questions by which one they need is the most
useful thing this section can do. `[code]`

### (i) Answerable from code already lifted — just read it

These need someone's attention, not a new capture and not a new lift.

- The meaning of the in-round sub-state cell that most per-frame handlers key on.
- The roles of most handlers on the gameplay call list. Their slot bank and dispatch key are known;
  what they *are* is not.
- What the two paired display lists hold. The mechanism is clear, the content is not.
- Which enemy class each velocity shim serves. The ladder and its call sites are mapped; the
  classes are not, beyond the two identified for the shared sprite picker (the first two eras'
  common craft).

### (ii) Answerable only from code or data not yet read

- **Formation composition, spawn rates, and the bonus window.** The per-era, per-difficulty spawn
  parameter table is a large untranscribed data block. Enemy counts and speeds live there. This is
  where `gameplay.md`'s questions 8 and 9 go, and neither can be answered without decoding it.
- **What the difficulty DIP actually changes.** Nothing on the player's path reads it — not speed,
  not turn rate, not the quota. It must act through the spawn parameters, which is the same block.
- The one ring command whose handler is real code with no transcribed file. Several other commands
  also lack a file, but they all resolve to the same bare `ret` that §7 already accounts for.

### (iii) Answerable only on the real machine

- Whether the per-era speed-up is **perceptible**.
- The Mother-Ship's entry edge, and whether it fires.
- ★ **Whether the Mother-Ship takes seven hits or eight.** The arithmetic that gives the 1940 bomber
  four hits from a counter of three gives the Mother-Ship eight from a counter of seven, which
  contradicts the manufacturer. One capture settles it; until then, do not repeat either number as
  established.
- Attract-mode composition — which eras the demo shows. A partial observation says the demo ship
  lives in the second era, consistent with the claim that this set never demos the first, but a
  single short capture is not a whole attract cycle.
- Whether the ship's **nose** is drawn along its direction of travel. The travel direction itself is
  settled (§5); which way `spriteForHeading` points the sprite for a given heading is not, and a
  16×16 sprite eyeballed off a snapshot is not the instrument for it.
- **What the per-player colour byte at `0xAD0C` IS.** Every reader treats it as a colour — three
  caption handlers at offsets 0, 5 and 10, the round-number digits, a colour-plane fill, a straight
  store into the colour plane — but it is byte 12 of the sixteen-byte per-player context block,
  `[seen]` being saved and restored by the two block copies, and one writer uses it as a
  has-this-changed marker that steps the sequence when the ROM table it walks stops changing. It
  takes four values in an attract loop and two in a driven game, and never approaches the wrap its
  four-bit mask implies. A name has to survive all of that and none of ours does yet.

### The states no instrument has visited

The difficulty tiers, deliberate death, the later eras, the loop wrap, and high-score initials
entry. Each is a hole of the same shape: code serving it reads as dark.

Two-player alternating play is no longer on that list. A driven MAME run that presses the second
start button reaches it: both save blocks arm, the active-player index alternates,
and the routines that serve the hand-over execute. What the run did NOT reach is a hand-over
*between eras* — both players stayed in the first two — so the interaction between a swap and an
era change is still dark.

- **The high half of the sequence sub-step table.** The dispatcher masks the sub-step to four bits
  and jumps through sixteen words, but a tap on its own dispatch byte recorded only nibbles 0-7
  across boot, attract, the demo, the credit state and a driven game. Slot 15 is a bare `ret`
  reached by nothing else in the image; whether it is a deliberate idle rung or a filler for an
  index the machine never produces is not decidable from any state we have driven, which is why
  `loc_15b5` keeps its address.

★ **And the fix is cheap and already demonstrated.** Poking the stage cell is a working grounding
technique on this game — exactly as poking board state was on Donkey Kong. A driver that sweeps the
stage cell through each of its values with the reach sweep running would convert most of this list
into real evidence for the cost of one MAME run. That is the single highest-value instrument left
unbuilt.

### A defect the coverage audit turned up in passing

Several files in the translated layer transcribe **data as code** — velocity tables reached only by
anti-tamper traps, and caption records sitting a few bytes from a real routine. No exhaustive
determination of the set has been made. They
are not wrong about any byte; the lift is faithful. They present data as routines, which will
mislead anyone reading them as behaviour, and it already has: see §8 and §10. Several sibling files
get it right — they declare themselves data in the header and throw if called, and one of them
covers a kind the bad set does not, records of tile and attribute pairs. That is the convention the
others should follow. Recorded here
rather than fixed, because fixing it is a lift change and this is a map. `[code]`
