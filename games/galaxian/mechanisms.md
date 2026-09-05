# Galaxian — mechanism map

A code-grounded model of how Galaxian plays, derived from the idiomatic + frozen-oracle routine bodies and
confirmed against the real ROM under MAME. This is a **living** document: it is regenerated whole as the
idiomatic decompile spiral climbs, and currently covers the **leaf helpers** lifted in decompile batches 1–2.
The higher-level per-frame orchestration that drives them — the main loop and the state dispatchers — is
translated but not yet idiomatically decompiled, so it is described here only as far as the leaves reveal it.

**Confidence tags** — never recalled, always grounded or derived: `[seen]` a MAME observation terminates the
chain (a write-tap value trajectory, a confirmed dispatch/consumer); `[code]` a confident reading from the
routine's behaviour with MAME not yet consulted for that specific claim (a register/VRAM/hardware-latch
output the work-RAM tap cannot see, or a state the captures did not reach); `[guess]` plausible, unverified.
The tag on each routine here is the one recorded in `idiomatic/names.js`, which is the single source for every
name/role/tag; this prose cites those names, never contradicts them. Cells named `loc_<addr>` are roles read
from the code but not yet promoted to a descriptive identifier — their role is described in prose regardless.

## RNG and the attract / sequence state machine

**Pseudo-random draws.** The machine keeps one byte of randomness in RNG_SEED (0x401e), and advanceRandomSeed [seen] is the entire generator. It reads the current seed, forms `seed*5 + 1` truncated to eight bits — built up as two successive doublings (seed*2, seed*4) added back to the original seed, then incremented — writes the result back into RNG_SEED, and returns that same byte as the draw. It carries no other state; the gameplay code that needs a random value simply calls it and takes whatever byte comes back.

**The dwell cascade.** Everything else in this subsystem turns on a top-level step index, SEQUENCE_STATE (0x400a), and a small down-counter block that sits just below it in memory at loc_4009 and loc_4008. The primitive tying the tiers together is tickCascadeCountdown [seen]: handed a pointer, it decrements that byte, and while the byte is still nonzero it just returns; only on reaching zero does it step to the very next byte in the same page and increment *it*. Aimed at loc_4009, this is exactly a carry — when the dwell counter at loc_4009 finally runs out, the carry lands one cell up in SEQUENCE_STATE (0x400a) and bumps the sequence to its next step. Both users of the primitive aim it at loc_4009, so the machine advances by letting a dwell timer expire.

**Two ways of ticking the dwell.** tickSequenceDwellTimer [code] is the plain form: each frame it points at loc_4009 and runs one cascade tick, so a step whose handler is this one lasts loc_4009 frames and then advances (this plain handler was not entered in the captures observed so far, so it stays [code]). tickPrescaledSequenceTimer [seen] stretches the same idea: it first decrements a sub-timer at loc_4008 every frame and returns while that byte is still counting; only when loc_4008 wraps to zero does it reload loc_4008 to 60 and pass a single tick down into the loc_4009 tier. Under the prescaled handler, then, loc_4009 is decremented just once every 60 frames, and SEQUENCE_STATE only advances after loc_4009-many such intervals — a far longer dwell for the same reload value.

**Reloading and hand-advancing.** reloadSequenceDwellTimer [code] simply stamps 80 (0x50) back into loc_4009, re-arming the mid tier for another dwell. advanceSubstateAndReloadDwell [code] couples that with a manual step: it increments the counter it is given — both callers hand it SEQUENCE_STATE (0x400a) — and then reloads the dwell, so the step advances at once and the fresh step is granted a full 80-count dwell instead of waiting for the timer to run down on its own.

**Step-setup handlers.** Some steps do real work on entry rather than merely wait. enterSequenceStep1 [code] forces SEQUENCE_STATE to 1 and arms the dwell cascade short, writing 3 into both loc_4008 and loc_4009. primeVramFillAndAdvanceStep [seen] is a heavier setup: it zeroes the 128-byte flag block at FLAG_BITS_BASE (0x4100) and two status bytes (loc_425f and loc_4224), points the VRAM_WRITE_PTR (0x400b) two cells into the tile grid at VRAM_BASE+2 (0x5002), loads loc_4009 with 32 as a page/dwell count for the fill that follows, and increments SEQUENCE_STATE. initPlayfieldState [code] is the fullest reset of the family, the entry into a fresh play field: it turns both start-button lamps off (START_LAMP_0 and START_LAMP_1 at 0x6000/0x6001), zero-fills four work-RAM spans — the 0x4100 flag block, the object spans beginning at OBJ_ACTIVE_FLAG (0x4200) and at loc_4218, and the large block at loc_4260 (through 0x42a5) — clears loc_425f, writes 1 into loc_4226, advances SEQUENCE_STATE, arms loc_4009 to 32, and points VRAM_WRITE_PTR at the grid base VRAM_BASE (0x5000). clearStridedTable [seen] is a small per-step reset that broadcasts zero across nine work-RAM cells spaced two apart from loc_4028 (0x4028, 0x402a, … 0x4038).

**Credit-driven transition out of attract.** Two routines watch the credit/start count at loc_4002. advanceGameStateOnCredit [code] runs right after the step handler on each pass: if loc_4002 is zero it does nothing, but when a credit is present it advances the GAME_STATE index (0x4005) and wipes the sub-state cluster back to a known start — clearing loc_4007, SEQUENCE_STATE (0x400a), loc_41c2, the sound-sweep countdown loc_41df, and MESSAGE_SCROLL_ENABLE (0x40b0) — so inserting a coin restarts the sequence machine down its play branch. driveStartButtonLamps [code] is the visible face of the same count: gated on bit 5 of loc_425f (clear means the lamps are disabled, and it forces both off), it otherwise leaves the lamps untouched when there are no credits, lights START_LAMP_0 with one credit, and additionally lights START_LAMP_1 once two or more are banked.

**Advance gates.** A cluster of one-line routines stamps "armed" markers that other handlers poll. armStateAdvanceGate [code] writes 3 into gate byte loc_41b5 and armSubstateAdvanceGate [seen] writes 3 into gate byte loc_4195; each is invoked from the same conditional test and merely flips its byte nonzero so the state (respectively sub-state) handler reading it takes its advance/proceed path. armBehaviorGateOnInputOrTimer [code] is the input-facing arm: it bails unless bit 0 of OBJ_ACTIVE_FLAG (0x4200) is set (its enable) and bit 0 of the behavior gate loc_4208 is still clear (not already armed). A control bit in loc_4006 then selects the trigger. With that bit clear it takes a timer path, arming loc_4208 only in the frames where the low five bits of loc_425f are all zero — that is, once every 32 counts. With the bit set it takes an input path: it picks one of the two input shadows — IN1_SHADOW (0x4011) when bit 0 of loc_4018 is set, otherwise IN0_SHADOW (0x4010) — masks it against the complement of the matching guard byte (loc_4014 or loc_4013 respectively) and tests bit 4; a live bit arms both loc_4208 and its companion flag loc_41cc. clearGateOnPendingRequest [code] is the teardown counterpart: when bit 0 of the request flag loc_420b is set it acknowledges the request by zeroing loc_420b and also clears the behavior gate loc_4208; with nothing pending it leaves both untouched.

**Epilogue.** The deliberately-unnamed loc_090b is a bare stack-cleanup tail shared by an enqueue path: it restores the caller's saved HL and returns, contributing no state of its own.

## The object / formation field: records, motion planning, sweep, paths

Galaxian keeps its aliens in two overlapping representations. There is the *formation*
— the neat ranks that hang at the top of the screen and sway back and forth — and there
are the individual *object records*, compact structs in work RAM that each alien carries
with it once it peels off to dive. The routines in this subsystem seed those records, keep
the formation's occupancy bookkeeping current, oscillate the whole block sideways, and then
run the little state machine that flies one alien down a curved path toward the player and
back. A single object record is read one way by the sprite builder and another way by the
flight AI, and the two disagree about which byte is "X" and which is "Y" — that is not a bug
but the rotated-monitor convention showing through, described where it bites below.

### Seeding the field

Two routines lay down the initial contents of the interleaved object-shadow field at screen
or formation init. `seedObjectRamShadowField` [seen] is the worker: it copies thirty-two
consecutive source bytes into every *other* cell of the destination, writing to 0x4021,
0x4023, 0x4025, … 0x405f (stride two), so it populates just one column of an interleaved,
two-fields-per-slot table without touching the alternating cells. `seedObjectShadowFromRom`
[seen] is the fixed-source front door for it — it points the copier at the ROM template
`STRIDED_TABLE_SRC` (0x1d71) and runs the same strided fill, so the shadow field starts life
holding the canned formation template baked into ROM.

### The occupancy summary and the sway bounds

The live formation is tracked as a small bitmap, the `OCCUPANCY_GRID` (0x4123): six rows,
ten columns, with rows spaced sixteen bytes apart. `summarizeFormationOccupancy` [seen]
reduces that grid every so often into the derived cells the rest of the field logic reads.
It first ORs each of the six rows across its ten columns and writes the six results into
`ROW_OCCUPANCY` (0x41e8) — but behind two leading guard cells it zeroes first, so the row
summaries actually sit at 0x41ea..0x41ef. It then ORs each of the ten columns down its six
rows into `COLUMN_OCCUPANCY` (0x41f0), again behind guards (three of them, summaries landing
at 0x41f3..0x41fc).

From the column summaries it derives the pair of horizontal sweep limits. Scanning inward
from the rightmost column, it starts a bound at 34 and steps it up by sixteen for every empty
column it passes, stopping at the first occupied one (and snapping back to 34 if the whole
rank is empty). Scanning inward from the leftmost column, it starts a second bound at 224 and
steps it *down* by sixteen per empty column. The two land as a word in `FORMATION_X_BOUNDS`
(0x4210), low byte the from-the-right limit and high byte the from-the-left limit. The
consequence is the arcade's signature behavior: as the outer columns are shot away, both
bounds march inward, so the surviving block sways within an ever-tighter horizontal window.

Finally it folds four region-clear flags. ORing the top four row summaries and toggling bit 0
gives loc_4221; ORing all six gives loc_4220; ORing seven slots of the object table `OBJ_TABLE`
(0x42d0) at stride 0x20 gives loc_4226; ORing eight more slots from loc_42b1 into that running
value gives loc_4225. Because each is XORed with one, bit 0 of these cells reads *set* precisely
when the region it covers is empty — they are "this area is clear now" signals that higher-level
logic consumes to decide when a wave or region is finished.

### Sweeping the anchor and mirroring it

The formation's horizontal position is a single 16-bit anchor word at loc_420e. A mover walks
that anchor one count toward whichever `FORMATION_X_BOUNDS` limit it is heading for, throttled
to once every four frames, and steered by the sweep-direction flag `OBJ_SWEEP_DIRECTION`
(0x420d). When the anchor reaches the upper limit the mover calls `setSweepDescending` [seen],
which simply stores 1 into 0x420d so subsequent frames count the anchor down; when it reaches
the lower limit it calls `setSweepAscending` [seen], which clears 0x420d back to 0. The two are
a matched pair — the endpoints of the oscillation — and between them the anchor eases back and
forth, carrying the whole formation with it.

Each time the anchor advances, its new low byte is mirrored into a small strided side-table so
consumers see the current offset without re-reading the word. `broadcastToStridedTable` [seen]
is the primitive: it writes one byte into nine cells at 0x4028, 0x402a, … 0x4038 (stride two).
`broadcastNegatedSweepToStridedTable` [seen] wraps it for the sweep — it takes the anchor's low
byte, negates it (two's complement), and fans that across the same nine cells, so the table holds
the *negated* sweep position. The reset path uses the same nine-cell writer to blank the table to
zero.

### From grid cell to screen position, and the axis swap

Each alien's home square is packed into one byte of its record, at record+7: the high nibble's
row bits and the low nibble's column bits. `positionObjectFromGridCell` [code] unpacks that into
on-screen coordinates. The row bits (masked to 0x70) set record+3 to 124 minus three-quarters of
the row value, spacing the ranks vertically; the column bits set record+4 to the swept anchor
loc_420e plus the column times sixteen plus a seven-pixel hotspot offset. Because record+4 is
built from the moving anchor, every alien's placement tracks the sway automatically.

The counterintuitive part surfaces when that record is turned into hardware. `renderObjectSprite`
[seen] builds a four-byte sprite record from the object struct: when the primary active bit
(record+0 bit 0) is set it copies the sprite number from record+0x16, writes the sprite's
horizontal slot as record+3 minus 8, and writes the vertical slot as the complement of record+4
minus a caller-supplied row offset. So the field the *row* bits filled becomes the sprite's
horizontal position and the field the *column* bits filled (complemented) becomes its vertical
position — the game's logical X axis is the display's Y axis, the rotated-cabinet mapping made
literal in the record layout. `renderObjectSprite` also folds the signed heading at record+5 into
a display attribute: it repeatedly adds or subtracts a 24-step turn until the angle settles into a
narrow sector, then maps that to a facing attribute added onto the base attribute at record+0x0f,
nudging the sprite a pixel on the diagonal cases. A secondary-active object (record+1 bit 0 with
the primary bit clear) instead gets a fixed sprite number 7 and the alternate attribute at
record+0x12; an object with both flags clear is parked off-screen at 248,248.

### The per-object flight state machine

Once an alien breaks formation it runs a small state machine keyed off a state index in its
record (record+2 for most handlers), and each of the routines below is one of those states.

`commitMoveToTargetX` [seen] is the shared tail of the target-picking states: given a chosen
target X it stashes it at record+0x19, computes the signed per-frame delta record+9 = current
coordinate (record+4) minus target, zeros the three-byte move accumulator at record+0x1a..0x1c,
and bumps the planner's sub-state at record+2 so the next state takes over the actual motion.
Its callers first choose that target relative to the shared player-position reference loc_4202,
clamping it into a band on the appropriate side, or substitute a fixed target.

Two mirror-image handlers walk a canned trajectory out of the `PATH_STEP_TABLE` (0x1e00).
`advanceObjectPathStep` [code] reads the per-object cursor at record+0x13, adds the next table
byte to record+3, then adds (or, if the direction bit record+6 bit 0 is set, subtracts) the
following byte from record+4; should record+4 plus a seven-pixel margin cross the near edge it
forces the state to 5 — the fall-away/return branch — otherwise it advances the cursor past the
pair, ticks a move throttle at record+0x10 (reloading it to four on expiry), nudges the
cross-step at record+5, and decrements the leg counter at record+0x11, advancing the state when a
leg finishes. `advanceObjectPathStepAscending` [code] is the mirrored arm reached when the
direction bit is set: it adds the step-table byte to record+4, advances the cursor, ticks the
same throttle, steps the heading at record+5, and on a completed leg advances the state and
reloads the next leg's parameters — throttle 3, leg count 12, heading 244, cursor 0.

`homeObjectXTowardPlayer` [code] is the homing state. It bumps a frame counter at record+3, then
steers the object's 16-bit coordinate:subpixel pair (record+4 high, record+9 low) toward the
player reference loc_4202 by roughly four times the signed gap each frame — the fixed-point step
carries a small rounding bias so it converges cleanly and does not jitter when already lined up —
and when the dwell timer at record+0x10 counts down to zero it advances to the next state.

`initObjectPhaseSteps` [seen] is a phase-entry state that reads the alien's grid cell at record+7,
derives a step count n as the low two bits of the inverted value, and records n+1 as the step
count at record+0x16, writes a derived code byte ((n+1)<<4)+140 into record+3, arms a phase
timer of 24 at record+0x10, advances the sub-state, and clears the ready flag at record+0x0f —
re-arming that flag to 24 only when n came out zero, so single-step phases signal ready
immediately while longer ones hold.

`advanceObjectFlightCurve` [code] generates the swoop itself. It runs ((record+0x18 low two
bits)+1) integration steps of a cross-coupled fixed-point rotation over two 16-bit accumulators
held in the record (hi/lo at record+0x19/+0x1b and record+0x1a/+0x1c). Each step adds twice the
*other* accumulator's sign-extended high byte into this one, with a guard that treats a resulting
high byte of exactly 128 as an overflow and reverts it. The two accumulator high bytes trace out a
rotating vector — a circle in fixed point — and those high bytes are the curved offset the dive
handlers add onto the alien's screen position, which is what gives the dive its arc.

`settleObjectXAtRest` [seen] is the come-to-rest state. Each frame it looks at record+4 and, if the
8-bit-wrapped distance from the rest value 200 is already under five, holds; otherwise it steps
record+4 up by one. So an object eases the field upward one count per frame until it lands in a
narrow band around 200 and then simply stops.

The last state routine here does no memory work at all: loc_090b [code] is the small shared stack
epilogue at the end of the enqueue path — it restores the caller's saved value and returns.

### Steering the whole formation, clamps, bonuses, and slots

Individual dives are chosen by weighing the current battlefield. `accumulateObjectPositionWeight`
[code] is the per-object term in that sum and works entirely in registers, writing no memory. It
contributes nothing unless the object is active, its vertical coordinate sits in one of two
52-row bands measured from 128, and its horizontal delta from the player reference loc_4202 falls
in the lower half; when it qualifies it folds a heading flag bit, two bits of the delta, and the
band selector into a 0–15 index, reads a signed step from the `OBJ_STEP_TABLE` (0x1a45), and adds
it to the running total. Its caller sweeps this across the object tables once every thirty-two
frames and turns the accumulated weight (together with the anchor-versus-player gap) into a small
0/4/8 command written to `OBJ_MOVE_CMD` (0x423f) — the field's decision about how to press its
attack.

`markValueOutOfRange` [code] is a tiny saturation arm belonging to a value fold: when a companion
routine finds its input beyond range it jumps here, which pins register B to the fixed 0x80
sentinel rather than letting the fold wrap. It is the "clamp overshoot" leaf of that computation.

`bumpCountIfNeighborsInactive` [code] is a scoring/bonus test used when an alien is deactivated. It
peeks the two object slots two and four entries ahead (record+0x20 and record+0x40) and returns the
running count incremented by one only when *both* of those neighbours are already inactive,
otherwise leaving it untouched — a small bonus awarded for finishing off an isolated straggler,
which its caller folds into the score/sound request it raises as the object dies.

Finally, `activateDescriptorSlot` [seen] initializes one 32-byte entry in the
`DESCRIPTOR_SLOT_TABLE` (0x4330). Given a descriptor number at the pointer it is handed, it selects
slot (number − 1), lands on the slot base at 0x4330 + index·32, and stamps the fixed init pattern:
the active flag at [0] set to 1, [1] cleared, [2] to 0x0d, [4] cleared, [5] to 0x0c, and the slot
index written back into [7]; fields [3] and [6] are deliberately left as they were. This is how the
higher-level sequence brings a descriptor entry online.

## Player ship, projectiles, dive scheduling, and object animation

### The player ship

The ship's horizontal position is a single byte in `loc_4202`, and `moveControlledObjectAndStageSprite` [code] is what nudges it each frame and hands it to the sprite hardware. `OBJ_ACTIVE_FLAG` (0x4200) bit0 says whether the ship is live. When it is, the routine picks a movement byte: with `loc_4006` bit0 clear it takes the automatic steering command in `OBJ_MOVE_CMD` (0x423f) (the path used when the machine drives itself), and with that bit set it takes a human control port — `loc_4018` bit0 choosing `IN1_SHADOW` (0x4011) over `IN0_SHADOW` (0x4010). Bit3 of the chosen byte steps the position down while it is still at or above 23, and bit2 steps it up while it is still below 233, so the ship is pinned inside the [23,233] band. The position is then staged for display: it is one's-complemented and offset by 128, paired with code 6, and written as four identical (value, code) pairs into `OBJ_STAGE_BLOCK` (0x4054) — the ship occupies four adjacent hardware sprite entries. When the ship is not live there are two fallbacks: if `loc_4201` bit0 is set the current position is staged under code 7 with no clamping, otherwise `loc_4202` is parked at 0 and staged under code 6.

### The player's shot

`advancePlayerShot` [code] services the four-cell timing block that is the player's single bullet: a gate `loc_4208`, a position counter `loc_4209`, a field `loc_420a`, and a retire flag `loc_420b`. While the gate's bit0 is set (a shot is climbing), the counter drains by 4 every frame and the routine raises `loc_420b` exactly when the drained value lands in the narrow near-end window [14,17] — the counter's two chained subtractions borrow only across that band, so nothing else trips the flag. That flag is the shot's "reached the top" signal, and a companion routine at 0x08e5 acknowledges `loc_420b` and tears the gate `loc_4208` back down. While the gate is clear (no shot in flight) the counter is reset to 220, parked at the bottom of its travel, and the field `loc_420a` is loaded from the ship's X in `loc_4202` when `OBJ_ACTIVE_FLAG` bit0 is set, otherwise zeroed — this locks the shot's launch X to wherever the ship is sitting. Sharing this region of memory is `loc_090b` [code], a bare epilogue that only restores a saved HL and returns; it is the common exit of a separate enqueue path and has no work-RAM effect of its own.

### Enemy projectiles

`advanceAndRenderProjectiles` [code] integrates and draws seven ten-byte records that begin at `loc_4260`, each carrying two five-byte sub-slots laid out as {active, sub-position, position-low, position-high, velocity}. A phase bit in `loc_425f` bit0 chooses which sub-slot leads on a given frame; when it is clear the routine bumps the first sub-slot's sub-position by 2 and begins on the second, so the two sub-slots alternate which one is fully serviced. For each record it works the leading sub-slot: an inactive slot is simply marked for deactivation; a live one has its sub-position advanced by 2 (an overflow deactivates it), its 16-bit position integrated by twice the sign-extended velocity byte, and is deactivated when the high byte drifts out of the vertical window (high plus 0x10 falling below 0x20 means off the top or bottom). Deactivating zeros the active, sub-position, and high bytes. The routine then writes the sprite shadow at `loc_4081` (stride 4), taking the sprite Y from the sub-position and the sprite code from the complemented position-high. `loc_4018` bit0 acts as the screen-orientation flag here: when clear it mirrors the Y (complement, minus one) and adds one to the code on the first three records; when set it uses Y-minus-four and subtracts one on those same three. As it steps to the next record it also bumps the trailing sub-slot's sub-position by 2.

`flagProjectileHitOnPlayer` [code] is the per-entry collision test run against that same 0x4260 block (walked as fourteen five-byte entries). It ignores an entry whose first-byte bit0 is clear. For a live entry it measures the ship X in `loc_4202` against the entry's X (record offset 3) and the entry's Y (offset 1, biased up by 31) against the caller's player-Y delta, splitting into a near and a far band: in the far band the X must sit within the delta (plus a 2-unit bias); in the near band the Y must fall within 9 units and the X within 11. On an overlap it clears the entry's first byte to deactivate it and raises `HIT_EVENT_FLAG` (0x4204), the signal that the ship has been struck.

### The object-animation state machine

Four routines run a short per-object animation for a deactivating object, chosen by the sub-state index kept at record offset 2. `armObjectAnimAndRequestSound` [code] is the sub-state-0 entry: it seeds the three animation timer/step fields (offsets 16, 17, 18 to 4, 4, and 28), advances the sub-state so this seeding happens only once, and posts a sound-effect request into `loc_41df` — 0x07 when the object's position field (offset 7) is below 112, 0x17 at or above it. `tickDeactivatedObjectAnim` [code] is the sub-state-1 tick: it counts a fast field (offset 16) down, and on each elapse reloads it to 4 and bumps a companion field (offset 18), then counts a slow field (offset 17). When the slow field elapses, the same position threshold decides the object's fate — below 112 it is retired by clearing the state byte at offset 1, while at or above 112 the fast field is reloaded to 50, the companion is reseeded from the global byte at `loc_422d` plus 32, and the sub-state advances. `endObjectAnimOnTimerExpiry` [code] is the sub-state-2 tick, a plain dwell that counts offset 16 down and clears the state byte (offset 1) on the frame it reaches zero, retiring the object. `noopAnimDispatchSlot` [code] is the sub-state-3 slot, a deliberate do-nothing so the four-entry sub-state table has a valid final target. Throughout, it is the clearing of the state byte's bit0 that pulls an object out of this animation run.

### Dive and formation scheduling

`rampCounterToCeiling` [code] is the slow pace/difficulty ramp. It acts only while `OBJ_ACTIVE_FLAG` bit0 is set and the inhibit flag `loc_422b` bit0 is clear. A two-tier prescaler — outer `loc_4218` reloading to 60, inner `loc_4219` reloading to 20 — steps the counter `loc_421a` up by one on each double-wrap and clamps it at 7. Worth noting: `loc_421a` is a live counter that climbs over play, not a fixed base; it is reset elsewhere on a stage advance.

That inhibit flag `loc_422b` is the one `expireActivityGatedTimer` [code] tends. While `loc_422b` bit0 is armed and at least one activity gate is open — `loc_4224` nonzero, `loc_4221` nonzero, or `loc_4226` bit0 set — it ticks the countdown `loc_422c` and clears `loc_422b` the moment it hits zero, ending a timed, activity-gated phase. Because the pace ramp and the delayed-event scheduler both refuse to run while `loc_422b` is armed, this timer's expiry is what releases them.

`scheduleDelayedEvent` [code] arms a delayed attack. It gives up unless `OBJ_ACTIVE_FLAG` and `loc_41ef` both have bit0 set and `loc_422b` bit0 is clear. A mode bit in `loc_4006` picks the path. Clear runs a two-tier timer (outer `loc_4245` reload 60, inner `loc_4246` reload 5) and, only when the whole cascade elapses, arms a fixed triple — `DELAYED_EVENT_TIMER` (0x422f) to 90, `loc_424a` to 45, and `DELAYED_EVENT_ARMED` (0x422e) to 1. Set ticks only the outer timer and, on its elapse, derives a payload instead: 2 when `loc_4221` bit0 is set, otherwise a value folded from the byte-sums of the two-byte words at `loc_4177` and `loc_421a` (bailing out if the latter sums to zero), then fans that payload into the timer and `loc_424a` through bit-rotations before marking `DELAYED_EVENT_ARMED`.

`fireDelayedEventRequest` [code] is the one-shot that consumes what was armed. While `DELAYED_EVENT_ARMED` (0x422e) bit0 is set it counts `DELAYED_EVENT_TIMER` (0x422f) down each frame; on the zero tick it disarms itself and, only if `OBJ_ACTIVE_FLAG` and `loc_41ef` both have bit0 set, raises `DELAYED_EVENT_REQUEST` (0x4229) — the fire-now signal the rest of the game acts on.

`selectAttackerRowScan` [code] decides which formation row an attacker launches from. The stage/formation selector `loc_421b` seeds both the starting slot number and a base value: nonzero gives slot 2 with base 157, zero gives slot 1 with base 132. It then scans up to four two-byte slots of `ROW_OCCUPANCY` (0x41e8), advancing only while neither byte of a slot has bit0 set and stopping at the first occupied slot, and stores the resulting (slot, base) pair into `loc_4213` for the object-AI row scans to read.

`armFormationAdvanceTrigger` [code] arms the "advance the formation" one-shot. Only when both status gates `loc_4220` and `loc_4225` have bit0 set and the pending word `loc_4222` is not already armed does it write 1 into that word — an enable low byte of 1 and a zeroed countdown high byte. A later consumer picks this delayed one-shot up to step the formation selector `loc_421b`, reseed the formation anchor, and reset the pace counter `loc_421a` back to zero.

## Sound

Galaxian's audio is discrete hardware, not a sound CPU: the game reaches it by
poking a small bank of write latches. Six of them, `SOUND_W_REG0` through
`SOUND_W_REG5` (0x6800-0x6805), gate the individual noise/tone voices; four
more, the `SOUND_LFO_FREQ` latches (0x6004-0x6007), set the background
low-frequency oscillator; and one pitch latch, `SOUND_PITCH_W` (0x7800), carries
the swept pitch. Rather than write those latches from scattered game code, most
of the audio is composed each frame into work-RAM shadow cells and latched out in
one pass: the pitch shadow `SOUND_PITCH` (0x41c1) feeds the pitch port, and a
composite flag byte `loc_41c0` feeds the two high sound registers. The per-frame
sound driver seeds the pitch shadow all-ones and clears the composite flag, runs
the voice updaters below, then latches the composed bytes out. Nearly everything
here is gated on the frame flag `loc_4007`, whose low bit toggles from frame to
frame, so a voice either acts on even frames only or uses that toggling bit as
its square wave directly.

**The pitch-swept sweep and the occupancy voices.** `driveDecayingSoundSweep`
[code] runs a fading sound effect straight to `SOUND_W_REG4`. It acts only on
even frames (bit 0 of `loc_4007` clear) and only while the countdown `loc_41df`
is non-zero; on each active tick it writes the countdown rotated right two bits to
the register and decrements the countdown, so the emitted value shrinks toward
silence and the effect self-terminates when it drains. Alongside it,
`driveSoundVoicesFromOccupancy` [code] is also an even-frame voice: it sums the
6x10 `OCCUPANCY_GRID` (0x4123, rows sixteen bytes apart) into an eight-bit tally
seeded at 1, then lights one of the three latches `SOUND_W_REG0`, `SOUND_W_REG1`,
`SOUND_W_REG2` per unit of tally, capped at three, zeroing every latch past the
stopping point. The louder the field is populated, the more of the three voices
sound. As a side product it raises the near-empty flag `loc_4224` to 1 once the
tally has nearly run dry (below two), a signal another subsystem's timer consumes.

**The gated square tone.** `driveGatedSquareTone` [code] drives `SOUND_W_REG5`.
While its duration counter `SOUND_TONE_DURATION` (0x41ce) is non-zero it counts
one tick off the counter and writes the frame flag `loc_4007` with bit 0 flipped
to the register; because that bit alternates every frame, the register's low bit
toggles frame to frame, producing the square wave. When the duration reaches zero
it writes plain zero instead, silencing the tone. Its phase-counter caller
re-arms the duration to 8 each time a separate cadence counter wraps, so the tone
pulses in bursts.

**Staging the pitch shadow.** Three routines write the pitch shadow `SOUND_PITCH`
(0x41c1) that the driver latches to `SOUND_PITCH_W` at frame end. The simplest,
`stageSoundPitch` [seen], just parks a byte there and does nothing else.
`stagePitchAndRaiseSoundFlag` [code] stores its input minus one (modulo 256, so
zero stores 255) into the same shadow and additionally raises the composite flag
`loc_41c0` to 1, marking the shadow pair filled for this frame.
`advanceSoundPitchRamp` [seen] is the swept version: it works over a
{countdown, pitch} pair sitting one and two bytes past its pointer (its caller
points it at 0x41c9, so the countdown is 0x41ca and the pitch 0x41cb), and while
the countdown still has ticks left it decrements it, adds a fixed step of four to
the pitch, stores the pitch back and publishes it to `SOUND_PITCH`, then clears
the composite flag `loc_41c0` to zero; when the countdown is drained it idles.
The composite flag thus carries a small graded value across these writers -- the
ramp leaves it 0, the staged-pitch path leaves it 1, and the sequence engine
below leaves it 2 -- and the driver latches whatever the last writer of the frame
left into the two high sound registers.

**The sound-sequence engine.** A second, richer audio path plays scripted
sequences of tone/duration commands out of ROM tables. It has three armable
channels, each with an active-flag byte -- `loc_41d2`, `loc_41cf`, and
`SOUND_SEQ_ACTIVE` (0x41cd) -- a shared 16-bit read cursor `SOUND_SEQ_PTR`
(0x41d3), a current-tone cell `loc_41d5`, and a shared duration timer `loc_41d6`.
Two routines here arm channels. `armSoundSequenceOnRequest` [seen] fires only
when its request gate `loc_41d1` holds exactly 1: it consumes the request
(clearing the gate), raises this channel's active flag `loc_41d2` and the timer
`loc_41d6` to 1, and points the cursor at the sequence table `loc_1e68`; any
other gate value leaves everything untouched. `armSoundSequenceForSelector16`
[code] is a dispatch arm keyed to a request selector -- notably the value read
from `loc_41df`, the very cell `driveDecayingSoundSweep` treats as its decaying
countdown, so that cell does double duty as a sequence selector here. Only when
the selector equals 0x16 does this arm act, clearing its sub-flag `loc_41cf`,
raising `SOUND_SEQ_ACTIVE` and the timer `loc_41d6`, and pointing the cursor at
table `loc_1edf`; every other selector belongs to a different arm and is a no-op.

Once armed, `advanceSoundSequenceChannel` [code] plays each channel one step per
frame from its descriptor. An inactive descriptor (its flag byte zero) does
nothing. Otherwise it stages the composite flag `loc_41c0` to 2 and publishes the
current tone `loc_41d5` to the pitch shadow `SOUND_PITCH`, then ticks the shared
duration timer `loc_41d6`; while the timer still runs there is nothing more to
do. When it expires it pulls the next command byte from the cursor
`SOUND_SEQ_PTR`: the end marker 0xe0 deactivates the channel (its flag byte
zeroed), while any other byte is a packed command -- its low five bits index
`SOUND_TONE_TABLE` (0x17a9) to load the next tone into `loc_41d5`, its high three
bits index `SOUND_DURATION_TABLE` (0x17c8) to load the next duration into
`loc_41d6`, and the cursor advances past the consumed byte. The three channels
are stepped in turn each frame, so several scripted voices can play at once.

**The LFO level fan.** `broadcastSoundLfoLevel` [seen] sets the background
oscillator. It saves a level byte to the shadow `SOUND_LFO_LEVEL` (0x421f), then
fans that byte across the four `SOUND_LFO_FREQ` hardware latches, rotating it
right one bit between each write so the four latches receive successively rotated
copies of the same value. Its callers feed it either a per-frame decaying level
(counting the saved level down and re-broadcasting) or, on request, a fixed value
slammed into all four latches at once.

**Silencing everything.** `silenceSoundAndDisableIrqStars` [code] is the hard
quiesce used at state transitions and input-init. It sets the four
`SOUND_LFO_FREQ` latches to 1, clears all eight sound registers from
`SOUND_W_REG0` upward to zero, clears the interrupt-enable latch `IRQ_ENABLE`
(0x7001) and the starfield-enable latch `STARS_ENABLE` (0x7004), and drives the
pitch latch `SOUND_PITCH_W` all bits high (0xff). It therefore does more than
mute audio: killing the two 0x7000-block latches also halts the vblank interrupt
and stops the starfield in the same sweep.

(The deliberately-unnamed `loc_090b` is a bare pure-stack epilogue that simply
returns; it is a shared tail target rather than a sound routine in its own right.)

## Coins, credits, the HUD, score display, and the message scroller

Everything a player sees on the border of the screen — the credit count, the two score readouts, the little "player up" marker, and the messages that flash and scroll across the field — is produced by a cluster of small painters that share one font convention and one video-memory layout. Underneath them sits the coin machinery that decides how many credits the machine actually owes. This section follows that chain from the coin slot to the glyphs on the tilemap.

### Booking a coin into a credit

Coin accounting lives in two adjacent work-RAM bytes: a coin-phase flag at `loc_4001` and the banked credit count at `loc_4002`. They implement a two-coin ratchet whose behaviour is chosen by the current game mode. When a coin pulse is recognised, the machine looks at the phase flag: if it is clear this is the *first* coin of a pair, so `setCoinPhaseFlag` [code] raises `loc_4001` to 1 and stops — no credit is granted yet. When the next coin arrives the flag is already set, so it is cleared again and the credit count at `loc_4002` is advanced instead. That is the "two coins, one credit" coinage; a different mode advances the credit count directly on each coin (or twice), so the ratchet is bypassed. Whichever path grants the credit, bumping `loc_4002` also raises a companion request flag (`0x41c9`) and enqueues a sound-command word (`0x0701`) so the coin-accepted chime plays; that enqueue unwinds through the small stack-restoring epilogue at the deliberately-unnamed `loc_090b`, which simply pops the caller's saved pointer and returns.

The credit count is bounded on both ends. `clampCreditsToMax` [code] is the overshoot arm of the advance: if the count is ever found already past its ceiling it is pinned straight back to 99 (`0x63`), the largest value the two-digit readout can show. In one particular mode the machine instead *presets* the bank: `presetCreditCount` [code] clears the phase flag at `loc_4001` and writes 9 into the credit count at `loc_4002` in a single stroke, seeding a fixed starting balance rather than counting up to it.

The physical coin mechanism is gated from that same credit count. Whenever fewer than nine credits are banked the coin-lockout latch `COIN_LOCKOUT` (`0x6002`, whose D0 is the board's coin_lock output) is held at 1; once the count reaches nine or more, `clearCoinLockout` [code] drops the latch to 0. So the coin slot's accept/reject gate flips as soon as the bank fills to nine — the machine stops taking money well before the display ceiling of 99 is in play. `clearCoinLockout` doubles as the ">= 9" tail of that decision, so the two arms of the test share one exit.

Separately from the lockout coil there is a mechanical coin *meter* to drive, and `pulseCoinCounter` [seen] shapes that pulse. It rotates the current value of a pulse-width timer right by three bits so that bit 3 of the timer lands in bit 0, and writes the result to the coin-counter output `COIN_COUNTER_0_LATCH` (`0x6003`); only that low bit is wired to the meter. Because it is fed the countdown value of the timer cell (`0x4003`) and then decrements that same cell, the meter output sits high for the upper half of each countdown window and low for the lower half, producing one fixed-width electrical pulse per coin booked before the timer runs out.

### Turning counts into digits

Several of these values are held as plain binary but must be shown in decimal. `byteToPackedBcd` [code] is the converter: it takes a binary byte, reduces it modulo 100, and packs the two decimal digits into one byte with tens in the high nibble and units in the low nibble. This is what lets the credit line and the level readout be counted arithmetically yet printed as decimal tiles.

The per-player scores are instead maintained *already* in packed BCD, three bytes each, at `PLAYER1_SCORE_BCD` (`0x40a2`) and `PLAYER2_SCORE_BCD` (`0x40a5`). `selectCurrentPlayerScore` [code] chooses between them from the active-player index at `CURRENT_PLAYER` (`0x400d`): player one (index 0) selects the first buffer, anything else the second. That six-digit buffer is painted a nibble at a time by `drawBcdDigit` [code]. Digits '0' through '9' are the contiguous tiles `0x90`–`0x99`, so a digit d becomes tile `0x90 + d`. The routine also suppresses leading zeros: it carries a blank counter, and while that counter is non-zero a zero digit is drawn as a blank tile (its base `0x80` plus `0x90` wraps modulo 256 to tile `0x10`, the blank cell) and the counter ticks down; the first significant digit clears the counter so every following zero prints as a real '0'. After each cell it steps the write cursor by a stride — the score renderer walks *up* the column with a stride of `-0x20` (one screen row per digit), emitting the high nibble then the low nibble of each of the three score bytes.

### The player-status marker

Beside the scores the machine paints a three-cell column marking which player is up. `selectPlayerStatusVram` [code] hands back the base of that column, choosing `PLAYER1_STATUS_VRAM` (`0x5340`) when the index is zero and `PLAYER2_STATUS_VRAM` (`0x50e0`) otherwise, again keyed off the active player. `paintPlayerStatusColumn` [code] then writes the three cells down that column stepping by the row stride: the top cell gets the supplied character code plus one, the middle a fixed tile `0x25`, the bottom a fixed tile `0x20`. After painting it may retire a status flag: only when bit 4 of the caller's flag byte is clear *and* the gate cell `loc_4006` reads zero does it clear the status-flag cell `loc_40ab` to 0; if the hide bit is set, or the gate is non-zero, the flag is left alone.

### Static labels and column text

The general-purpose text painter is `drawTextColumn` [code]. Given a source pointer, a destination cell, a count and a stride, it copies each source byte minus the '0' code (`0x30`) — the machine's font convention that maps a character code to its tile code — into the destination, advancing the source forward one byte and the destination by the stride each pass. With the negative stride the callers supply it, the text is laid *up* a column one row at a time. It is fed from packed descriptor records: the record supplies the destination cell, the source string, and the run length, and the painter renders that fixed label into video RAM.

### The message painter and its three modes

`renderMessageColumn` [seen] is the richer label engine, and it is indexed by a single byte. The low five bits of that index select a record from the pointer table at `MESSAGE_PTR_TABLE` (`0x235c`); each record names a destination cell in video RAM followed by the text that belongs there. The top two bits of the index choose the mode. With bit 7 set the routine runs in *erase* mode: it walks up the column writing the blank tile (`0x40`) into each character cell until it meets the string terminator (code 63). With neither top bit set it runs in *glyph* mode: each source byte minus `0x30` becomes a tile code written up the column to the same terminator. That is how the fixed HUD captions are stamped and cleared — the score-line dispatcher, for instance, paints one caption for the one-player readout, another for the high-score/level readout, and blanks them as state changes.

With bit 6 set the routine runs in *setup* mode, and this is where the scroller is armed. It records the destination pointer into `MESSAGE_DEST_PTR` (`0x40b5`) and the text pointer into `MESSAGE_TEXT_PTR` (`0x40b3`); it derives the destination's column, computes a per-column cursor cell at `loc_4020 + column*2`, and stashes that address in `MESSAGE_CURSOR_PTR` (`0x40b1`). It clears the whole 32-cell destination column to the clear tile (`0x10`) so the message can grow into a clean field, packs the destination's row coordinate into the top bits of a byte (its low three bits deliberately zero) and writes that packed byte into the cursor cell, and finally sets `MESSAGE_SCROLL_ENABLE` (`0x40b0`) to 1 to hand the column off to the scroller.

### The scroller's countdown

Once armed, the scroller steps one glyph at a time, and the cursor byte it left behind does double duty: its high bits carry the destination row, while it also serves as the scroll countdown. The low three bits of that byte are read as a per-character dwell — when they are non-zero the step does no drawing and simply ticks the byte down, which is the job of `endMessageScrollOnExpiry` [seen]: decrement the countdown at the pointer and, only on the exact zero-crossing, clear `MESSAGE_SCROLL_ENABLE` (`0x40b0`) so the scroller shuts off. Because the byte starts with its low three bits zero, the very first step emits a glyph; each emission then leaves the low bits at 7, giving a seven-frame pause before the next character appears, and this continues until the byte counts all the way to zero and the message is declared finished. When the source text reaches its terminator (`0x3f`) before that, the end is reached through `endMessageScrollOnExpiryFromDe` [seen], a thin adapter that takes the countdown pointer arriving in the alternate register, swaps it into place, and ticks the very same countdown — so the message expires the same way whether it ran out of countdown or ran out of text.

### Re-seeding the video fill cursor

`resetScreenFillState` [seen] re-arms the bulk video-fill machinery that the attract and boot paths lean on, but it is gated by a hardware input: it reads `IN0` (`0x6000`) and, if bit 6 is asserted, leaves everything untouched. Otherwise it rewinds the video-fill write cursor `VRAM_WRITE_PTR` (`0x400b`) back to the tilemap base `VRAM_BASE` (`0x5000`), arms the fill-length counter `loc_4008` to a full page of 32 rows, and clears both the alternate-dispatch flag `loc_401a` and the game-state index `GAME_STATE` (`0x4005`) to zero — putting the display pipeline back at the top of video RAM with a fresh state.

### A shared counter-refill helper

Finally, `reloadExpiredCounterAndTally` [seen] is a small utility that the periodic counter-bank refresh uses rather than a HUD painter proper. When a scan of a bank of countdown cells finds one that has just decremented to zero, this helper copies its reload byte from the source table into the expired cell — re-arming it — and bumps a running tally so the caller can learn afterwards how many cells were refreshed and act on it. It carries no video or coin state of its own; it is the reusable "refill one expired counter and count it" step inside the larger periodic-timer sweep.

## Tile / VRAM drawing primitives, flag-bitmap pack/unpack, coordinate mapping

The tilemap lives in a single page based at VRAM_BASE (0x5000), and the routines
in this subsystem are the low-level hands that write glyph codes into it, plus the
address arithmetic and bit-shuffling that decide *where* and *what* to write. Two
different traversal conventions coexist over that one page, and it helps to name
them up front: the block/pair writers treat the map as 32 cells to a memory row,
so "the cell one row below" is simply the address plus 32 (0x20); the column
drawers instead walk a *display* column by stepping the address down 0x20 per cell
and hop to the neighbouring column with a low-byte add of 98 (0x62). Both act on
the same physical VRAM; the difference is only the direction each one chooses to
sweep.

### Turning a packed coordinate into a cell address

`mapPackedCoordToVram` [code] is the geometry primitive the tile drawers lean on
when a position arrives as a single packed byte rather than as a ready-made
pointer. It splits that byte into its two nibbles and reassembles them into an
address in the VRAM_BASE (0x5000) page. The low nibble, rotated right by two,
supplies the address's high byte through its bottom two bits — so the reachable
page is only 0x5000 through 0x53ff — and its top two bits seed the high end of the
low byte. The high nibble is read as a three-bit field; its bottom bit is rotated
out to become the carry the routine hands back, and the field shifted right one
becomes the byte returned in A. The rest of the low byte is a small complemented
running sum of that field (field-shifted-right plus field plus the rotated-out
bit, complemented and masked to a nibble) added onto the seed bits. The net
result is HL pointing at the tilemap cell for that coordinate, A carrying the
coordinate's bits 6..5, and the carry flag carrying its bit 4 — and callers do
branch on that carry. The dispatch entries that resolve a drawing position (for
example the handler at 0x2055 and its siblings) call this first to obtain HL, then
run the actual paint at the cell it returns.

### Stamping tile pairs

The heart of the block writers is `stampTilePair` [code]. Given a tile code in A,
a destination in HL, and a stride in DE, it writes the code at HL and the *next*
code (A+1) at HL+1, then advances the pointer past the pair by the stride and bumps
the tile code by two, handing back the advanced code and pointer so a caller's loop
can chain one pair straight into the next. Because the store truncates to a byte,
seeding it with 0xff writes 0xff followed by 0x00. `drawFixedTilePairHorizontal`
[code] is just a fixed-seed door onto that primitive: it loads the glyph code 44
(0x2c) and stamps a pair from it, returning the advanced code/pointer for the
caller's chaining loop.

`drawTileBlock2x2` [code] builds a 2x2 glyph block out of two of those stamps. It
uses a stride of 31 so that each stamp — which itself steps one cell past the pair
it wrote — nets an advance of 32, i.e. one memory row down. The first stamp lays
the top pair (A, A+1); the second lays the bottom pair (A+2, A+3) directly beneath
it; DE is left as the caller had it. `drawBottomTilePairRestoreDe` [code] is the
shared tail of that same construction, reachable as the block writer's own
fall-through and from a parallel entry point: with the tile, destination and
stride already staged and the caller's DE saved on the stack, it stamps the second
pair through the same primitive and then restores the caller's DE off the stack
before returning.

The vertical counterpart is `drawDoubleHeightTile` [code], which paints the two
halves of a double-height glyph: the code in A at HL, and the code stepped by two
(A+2) one memory row below at HL+32, leaving DE untouched. `drawFixedTilePairVertical`
[code] is its fixed-seed door, loading the glyph code 44 (0x2c) and painting that
double-height pair at HL — the seed at the top cell and 0x2e one row beneath.

### Column drawing and blanking

`drawTileColumnTriple` [code] copies a short vertical run into a display column.
It reads three consecutive source bytes and writes each into the destination cell,
stepping the destination's low byte down 32 between writes so successive bytes
climb the column, with the high byte held fixed so the walk stays inside its page.
After the three cells it advances the low byte by 98 (0x62); since three upward
steps of 0x20 total 0x60, that leaves a net low-byte increase of two, lining the
destination up on the start of the adjacent column. It returns the advanced source
pointer and destination so a caller can keep feeding it rows. The caller at 0x0367
is exactly such a driver: gated by an active count at 0x4241 and the frame counter
at 0x425f, it pulls three-byte rows out of ROM tables (0x039a and 0x03a6) and draws
them column by column into VRAM starting at loc_5193 (the cell 0x5193) through this
routine.

That same 0x0367 driver, when the frame counter's low six bits are zero, instead
calls `blankTileColumns` [code], which wipes a run of columns rather than drawing
them. Starting from loc_5193 (0x5193) it stamps the blank tile code 16 (0x10) into
three cells per column — stepping up one display row (address minus 0x20) between
them — then advances to the next column by adding 98 to the low byte alone, with
the high byte held fixed across the hop. The column count comes in through B and is
counted down in a way that treats a starting count of zero as a full 256 columns.

`blankTileBlock4x4` [code] clears a compact 4x4 patch of the map. Anchored at
loc_51da (the cell 0x51da) it writes four rows of four cells, with each row start
32 (0x20) beyond the last — so the four rows sit at 0x51da, 0x51fa, 0x521a and
0x523a. Worth noting as a plain fact of the current machine: this block blanker
uses the tile code 64 (0x40) as its "blank", whereas the column blanker above uses
16 (0x10); the two blanking primitives deliberately stamp different codes.

### Packing and unpacking the flag bitmap

A 128-byte flag array based at FLAG_BITS_BASE (0x4100) is kept in two
interchangeable shapes, and a symmetric pair of routines converts between them.
`unpackBitmaskToFlagBytes` [seen] takes a 16-byte packed bitmask at the source
pointer and fans it out, LSB-first, into 128 one-byte-per-bit flags at
FLAG_BITS_BASE (0x4100) — writing 1 for each set bit and 0 for each clear one.
Crucially it returns the source pointer advanced past the 16 mask bytes, and its
callers rely on that: the handler at 0x02fd points it at a table entry at 0x051b,
then treats the returned pointer as the start of the eight-byte template that
follows the mask and copies those bytes to 0x4218.

`packFlagBytesToBitmask` [code] is the exact inverse. It reads bit 0 of each of
the 128 flag bytes at FLAG_BITS_BASE (0x4100) and packs them, LSB-first, back into
a 16-byte bitmap at the destination pointer, returning that pointer advanced by 16
so the caller can chain the next write. The handler at 0x073d uses it to compress
the spawn flags into a bitmap at 0x4180 (which leaves the pointer at 0x4190), then
appends an eight-byte template there — mirroring, in reverse, the unpack-then-copy
shape of the reader.

### Committing the command-queue write-head

The command queue occupying the 0x40xx work-RAM page keeps its write-head index in
the cell loc_40a0 (0x40a0). When an enqueue succeeds — the routine at 0x08f2 finds
the target slot free, stores the two entry bytes, and advances the head (clamped up
to a 0xc0 floor) — it hands the new index to `commitQueueWriteHead` [seen], which
writes it back into loc_40a0 (0x40a0) and then runs the shared stack epilogue that
returns to the original caller. That epilogue is loc_090b [code], a deliberately
unnamed two-instruction tail: it pops the HL the enqueue path saved on entry and
returns, writing no RAM of its own. It is the common exit of the enqueue path,
reached both by falling out of the head-commit above and directly when the target
slot was already occupied and the queue was left untouched.

## Open questions

- The per-frame orchestration (the main loop and the state dispatchers that select these handlers) is
  translated but not yet idiomatically decompiled, so the way the sequence, formation, combat, and sound
  handlers above are scheduled each frame is inferred from the leaves they call, not yet read directly.
- Several handlers stay `[code]` because their state was not reached by the attract + single-coin/one-player
  captures (a credited play branch, a deep formation state, a later board); a deeper poke-cycle capture is
  owed to lift them. A routine whose only writes land in VRAM or a hardware latch also stays `[code]` until a
  video/audio-visible capture grounds it.
- Many work-RAM cells are still named `loc_<addr>`: their role is understood from the routines that touch them
  (described above) but a descriptive identifier is deferred to the cleanup phase rather than promoted piecemeal.
- A further set of leaf routines has been decompiled to clean JavaScript but is **not yet narrated here** — it keeps
  `loc_<addr>` names and `[code]` certs pending its own understanding pass (blind naming + MAME grounding), which will
  fold these leaves into the subsystem sections above. Until then this map covers the routines named in the sections
  above; the newly-decompiled leaves are correct-by-equivalence but their roles are not yet claimed.
