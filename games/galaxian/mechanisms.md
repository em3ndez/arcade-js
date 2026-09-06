# Galaxian — mechanism map

A code-grounded model of how Galaxian plays, derived from the idiomatic + frozen-oracle routine bodies and
confirmed against the real ROM under MAME. This is a **living** document: it is regenerated whole as the
idiomatic decompile spiral climbs, and currently covers the **leaf helpers** lifted in decompile batches 1–5.
The higher-level per-frame orchestration that drives them — the main loop and the state dispatchers — is
translated but not yet idiomatically decompiled, so it is described here only as far as the leaves reveal it.

**Confidence tags** — never recalled, always grounded or derived: `[seen]` a MAME observation terminates the
chain (a write-tap value trajectory, a confirmed dispatch/consumer); `[code]` a confident reading from the
routine's behaviour with MAME not yet consulted for that specific claim (a register/VRAM/hardware-latch
output the work-RAM tap cannot see, or a state the captures did not reach); `[guess]` plausible, unverified.
The tag on each routine here is the one recorded in `idiomatic/names.js`, which is the single source for every
name/role/tag; this prose cites those names, never contradicts them. Cells named `loc_<addr>` are roles read
from the code but not yet promoted to a descriptive identifier — their role is described in prose regardless.

## System primitives: RNG, memory fill, table fetch, and the vblank interrupt

Beneath the game logic sits a small layer of shared machinery that everything else leans on: a pseudo-random number source, a byte-fill loop, an indexed table read, and the housekeeping that keeps the per-frame interrupt firing. These are tiny routines, but they are the ones called from dozens of places, so their exact behavior sets the character of the whole machine.

The randomness comes from `advanceRandomSeed` [seen], a textbook 8-bit linear congruential generator. It reads the current seed out of `RNG_SEED` (0x401e), computes `seed*5 + 1` truncated to a byte, writes that new value back into `RNG_SEED`, and hands the same byte back as this call's random draw. The seed cell is therefore the entire state of the generator — there is no separate output register, the stored seed *is* the last number drawn. Because the routine both advances and returns in one step, callers just take whatever bits they need off the returned byte: the attacker-direction logic pulls the low bit (`& 1`) to pick a launch side, the controlled-object mover tests the top bit (`& 0x80`) to decide whether to nudge left or right, and the formation-object reseed path takes the whole byte as a fresh random Y coordinate. Every one of those draws mutates 0x401e, so consecutive consumers see a walking sequence rather than a fixed value.

`fillMemoryBlock` [code] is the block-store primitive, invoked as the RST-10 vector. Given a destination pointer, a fill value, and a count, it stores the value, steps the pointer forward, and repeats. The count is decremented as a byte, so a count of zero wraps through 255 and produces a full 256-byte fill rather than a no-op — a deliberate way to blank a whole page in one call. When it finishes it leaves the pointer sitting just past the last byte written and the count spent to zero, so a caller can chain a second fill onto the tail of the first. This is the workhorse behind screen clears and RAM resets throughout startup and between rounds: it is what paints an entire VRAM region to one tile code, what wipes object RAM back to a known state, and what blanks message rows. Because the store walks straight through the address space, the same loop that fills work RAM will also write into video RAM or a hardware latch if the pointer is aimed there — nothing about the fill distinguishes RAM from mapped hardware.

`fetchIndexedTableByte` [code], the RST-20 vector, is the standard table lookup. It adds an 8-bit index to a 16-bit base pointer, carrying properly into the high byte so the read can cross a 256-byte page boundary, then loads the byte at that computed address. It returns both that byte and the advanced pointer, so a caller gets the looked-up value and, if it wants, a pointer it can keep reading from. This is how the machine turns a small number into a stored constant: the tile-block drawer uses it to index `TILE_BLOCK_TABLE` (0x215b) by a block number to get the block's tile code, and the screen-setup path uses it to read a per-configuration entry out of the table at loc_0152 selected by two input-port bits. The carry-into-high-byte detail matters — it means these tables are free to straddle a page and the lookup still lands correctly.

The frame heartbeat depends on `rearmVblankInterruptAndRestoreRegs` [code], the vblank interrupt epilogue. When a vblank interrupt is taken, the prologue acknowledges it by clearing the `IRQ_ENABLE` latch (0x7001) so the same interrupt cannot immediately re-trigger, and saves six register pairs. This epilogue is where that gets undone: it writes 1 back into `IRQ_ENABLE` to re-arm the interrupt for the *next* frame, then restores the six pairs in the order the prologue stacked them (iy, ix, hl, de, bc, and finally af, so the restored A/F overwrite the scratch value used to write the latch) and returns through the interrupted address to resume the main loop exactly where it was suspended. This is the single convergence point for the interrupt handler's exit paths, and the re-arm is load-bearing: without that write to 0x7001, only the very first vblank would ever fire and the per-frame loop would freeze after one frame.

Finally, loc_090b [code] is a deliberately-unnamed scrap of shared exit code: it restores HL from the stack and returns, doing nothing to memory. It is the common tail of the command-queue enqueue path — the write-head commit falls straight into it — where the only cleanup left is to undo an earlier save of HL before handing control back to the caller.

## The attract / sequence state machine, dwell timers, credit transition, boot config, and playfield init

### A two-level state machine

Every video frame the machine reads one game-state byte, GAME_STATE (0x4005), and runs the single handler that byte selects out of a five-entry jump table: state 0 wipes and configures the screen at cold boot, state 1 runs the attract demo, state 2 makes the credit/start decision, and states 3 and 4 run the two play variants (a fresh formation and a restored-formation replay). Three of those five — the attract sequence and both play states — then perform a *second* selection on a sub-state byte, SEQUENCE_STATE (0x400a), so each of those phases is really a small inner state machine whose step index lives in 0x400a and whose handlers walk it forward one slot at a time. The whole subsystem is the plumbing that moves 0x4005 and 0x400a around, times how long each step holds, and posts the sound/graphics cues that go with each transition.

### Boot: fill the screen, then latch the operator configuration

Game-state 0 is `fillScreenThenLatchConfigAndAdvanceState` [seen]. Each frame it blanks a 32-byte run of tilemap at the moving cursor VRAM_WRITE_PTR (0x400b) with the blank tile and steps the stored cursor forward, so over successive frames the entire 0x5000–0x53ff grid is cleared, while a per-state timer in loc_4008 counts down. When that timer hits zero the handler does the once-per-boot latch: it resets the state cluster (GAME_STATE to 1, SEQUENCE_STATE to 0, the mode flag loc_4006 to 0, loc_4007 to 1) and folds the DIP/operator settings out of the input shadows into work RAM — the two-bit lives/coin selector from the top of IN1_SHADOW (0x4011) into loc_4000, one bit of IN2_SHADOW (0x4012) into loc_401f, and the cocktail screen-flip bit from IN0_SHADOW (0x4010) into loc_400f — then indexes a four-entry coinage table by the low two bits of the live IN2 port (0x7000) and stores the chosen byte in loc_40ac. It closes by unpacking a packed flag bitmap, seeding the object shadow, writing the player-1 status glyphs at PLAYER1_STATUS_VRAM (0x5340) and two neighbours, and appending two deferred command words to the queue. After this frame GAME_STATE is 1 and control drops into the attract sequence.

### The dwell-timer cascade

The timing spine of the sequence machine is a chain of adjacent countdown cells and one shared primitive, `tickCascadeCountdown` [seen]. Handed a pointer, it decrements the byte there; while that byte stays nonzero the tick is finished, but when it reaches zero the routine steps the pointer to the *next byte in the same 256-byte page* and increments that neighbour — a carry from a low tier into the next tier up. Laid across three consecutive cells — the prescaler loc_4008, the dwell tier loc_4009, and SEQUENCE_STATE (0x400a) — an expiring dwell in 0x4009 carries an increment into 0x400a, which is exactly what advances the sub-state index and steps the sequence forward.

`tickSequenceDwellTimer` [code] points straight at the dwell tier loc_4009 and ticks it, so each frame it draws the dwell down and, on expiry, bumps SEQUENCE_STATE. `tickPrescaledSequenceTimer` [seen] wraps a slower outer stage around the same idea: it decrements loc_4008 first and only when 0x4008 wraps does it reload it (to 60) and then tick loc_4009 — a dwell that steps roughly sixty times more slowly. Seeding and re-arming the cascade is spread across several small helpers. `enterSequenceStep1` [code] sets SEQUENCE_STATE to 1 and arms both tiers to 3 (a brief three-tick hold for the new step). `reloadSequenceDwellTimer` [code] restamps the dwell tier loc_4009 to 80. `advanceSubstateAndReloadDwell` [code] does the pair together — bump the sub-state counter it is handed (both callers hand it SEQUENCE_STATE) then reload 0x4009 to 80. `setSequenceStateByModeAndReloadDwell` [code] instead *forces* the counter to a fixed next step — 4 when the mode flag loc_4006 bit 0 is set, 14 when it is clear — and then reloads the dwell, so a single handler can jump to different sub-states depending on whether a paid game or the attract demo is running.

### The attract sequence (state 1)

State 1 dispatches on SEQUENCE_STATE through its own sub-state table. Sub-state 0 is `initSequenceEnableStarfield` [seen]: it enqueues two setup command words, turns the starfield on via STARS_ENABLE (0x7004), sets loc_4007, clears the per-sequence work cells (CURRENT_PLAYER 0x400d, the two-player flag loc_400e, the mode flag loc_4006, and the short latch loc_4019), seeds the dwell cascade fresh (loc_4008 to 96, loc_4009 to 16), and advances SEQUENCE_STATE. Sub-state 1 is `armStepCountdownAndTickSequenceTimer` [seen], which sets the one-shot latch loc_4019 to 1 and then runs the prescaled timer — 0x4019 is a short countdown that a later attract step decrements, and its expiry is what advances the sequence and clears the flag block. Together these two hold the demo on-screen for a metered interval before the next step.

### The credit transition and starting a game (state 2)

State 2 is where inserted credits turn into a running game. The one-player arm is `startOnePlayerGame` [code]: if the credit counter loc_4002 is zero it simply forces GAME_STATE back to 1 (return to attract), otherwise it spends one credit (loc_4002 minus one), zeroes the 32-byte saved-state snapshot at SAVED_STATE_SNAPSHOT (0x41a0), and enters the round with a null spawn pointer. The round-entry it delegates to sets GAME_STATE to 3, SEQUENCE_STATE to 0, and — crucially — sets the mode flag loc_4006 to 1, marking this as a *played* game rather than the silent demo; that one bit is what later opens the sound cues and, at round end, decides whether the machine loops the round or falls back to attract. The two-player arm alongside it requires two credits and, on a config bit in loc_401f, arms the state-advance gate through `armStateAdvanceGate` [code] before starting.

### The advance gates

Two tiny writers exist only to raise "armed" markers the play handlers later test. `armStateAdvanceGate` [code] stamps the value 3 into loc_41b5, and `armSubstateAdvanceGate` [seen] stamps 3 into loc_4195. Neither does anything else; their whole purpose is to leave a nonzero flag that a state-6 handler reads to decide whether it may take its advance/show path.

### Playfield init (states 3 and 4, sub-state 0)

Both play states share their sub-state-0 entry, `initPlayfieldState` [code], which stands up a clean playfield. It turns both start lamps off (START_LAMP_0/START_LAMP_1 at 0x6000/0x6001), zero-fills the flag block FLAG_BITS_BASE (0x4100) for 128 bytes and three further work-RAM spans (the object-active region from OBJ_ACTIVE_FLAG at 0x4200, the timer/state block from loc_4218, and a large 70-byte span from loc_4260), clears the frame-counter cell loc_425f, sets loc_4226 to 1, advances SEQUENCE_STATE, arms the dwell tier loc_4009 to 32, and points the fill cursor VRAM_WRITE_PTR back at the tile-grid base VRAM_BASE (0x5000) so the next steps can paint the field.

### The play sub-states

Later sub-states carry the round forward. `advanceSubstateAfterDwellAndQueue` [code] is a plain metered step: tick the dwell tier loc_4009, and on its zero-cross reload it to 20, advance SEQUENCE_STATE, and enqueue this step's command word. `restoreSavedStateAndEnterPlaySubstate` [code] is state 4's sub-state 2, the replay path: it expands the saved formation bitmap out of SAVED_STATE_SNAPSHOT (0x41a0) into the flag block, copies the eight-byte template that follows it into the loc_4218 buffer, clears loc_425f and loc_4220, and — when the screen-flip config loc_400f is set — mirrors it into the FLIP_SCREEN_X/FLIP_SCREEN_Y latches (0x7006/0x7007); it then advances SEQUENCE_STATE, arms the state timer loc_4009 to 150, publishes a sub-state pointer into loc_4245, and, only while the mode flag loc_4006 bit 0 is set, posts a five-word intro cue.

The two state-6 handlers are the branch-heavy hinge of the round. `stepPlaySubstate6` [code] (fresh formation) reads the arm gate loc_421d together with the advance marker loc_41b5 and the two-player flag loc_400e: with the gate up it either advances-and-reloads (when both marker and flag are set) or forces the state by mode; with the gate down it either runs the shared reset tail (when either is clear) or, otherwise, inlines the advance itself — bump SEQUENCE_STATE, arm loc_4009 to 130, and, only when loc_4006 bit 0 is set, enqueue two channel-6 sound words. `stepAltPlaySubstate6` [code] (restored formation) is the mirror image keyed on the sub-state marker loc_4195 instead of loc_41b5, and it arms loc_4009 to 80 on its gated arm and 130 on its default arm. Both share their exit through `advanceDwellOrResetToState1` [code], which is where the round decides its fate: while the mode flag loc_4006 bit 0 is clear (attract demo) it simply advances the sub-state and reloads the dwell so the demo keeps looping; when the bit is set (a paid game that has ended) it resets to state 1 — GAME_STATE to 1, mode flag and SEQUENCE_STATE cleared, the sound/interrupt/starfield hardware silenced, and command word 6 queued — which is the path back to attract after a game.

### The command queue

Sound and graphics cues are not acted on inline; they are appended to a command queue that another subsystem drains. `enqueueCommandWord` [seen] is the append primitive: it reads the write-head index loc_40a0, treats it as an offset into page 0x4000 (the head is floored at 0xc0, so the queue's slots physically live from 0x40c0 upward), and only if the target slot's bit 7 marks it free does it write the word's high byte into the slot and the low byte into the next, then advance the head by two and clamp it back up to the 0xc0 floor before committing it. `commitQueueWriteHead` [seen] is the bare write-back used when a caller has computed a new head itself — it stores the head into loc_40a0 and returns through the shared stack epilogue `loc_090b` (a deliberately unnamed two-instruction routine that just restores the caller's saved pointer and returns, with no work-RAM effect). On top of the single-word append sit two burst helpers: `enqueueCommandWordBurst` [code] posts a fixed five-word set (three carrying the caller's channel, twice on the next channel, then two on channel 7), and `queueBoardStartSoundBurst` [code] is the board/level-start cue that prepends one channel-5 prologue word before that same five-word burst — it is used for the paired-player variant when both the mode flag loc_4006 bit 0 and the two-player flag loc_400e bit 0 are set.

### Per-frame gameplay timers and gates (play sub-state 5)

Once a formation is live, the play states spend their time in a per-frame update sub-state that drives a cluster of gated timers, all keyed on the object-active enable OBJ_ACTIVE_FLAG (0x4200) bit 0. `clearGateOnPendingRequest` [code] is an acknowledge step: when the request flag loc_420b bit 0 is pending it clears both that flag and the behavior gate loc_4208 the oscillator subsystem tests. `armBehaviorGateOnInputOrTimer` [code] raises that same gate loc_4208, but only while the enable bit is set and the gate is not already armed; the mode flag loc_4006 bit 0 chooses the trigger — with it clear it is a *timer* trigger that fires whenever the low five bits of the frame counter loc_425f are zero (about once every 32 frames), and with it set it is an *input* trigger that tests bit 4 of the selected input shadow (IN0_SHADOW or IN1_SHADOW, picked by loc_4018 and masked by its guard loc_4013/loc_4014), additionally raising the companion flag loc_41cc. `rampCounterToCeiling` [code] is a slow difficulty ramp: gated on the enable bit and an inhibit flag loc_422b, it runs a two-tier prescaler (outer loc_4218 reload 60, inner loc_4219 reload 20) and, on each full double-wrap, steps the 0..7 counter loc_421a up one notch, clamped at 7. The delayed-event pair schedules a one-shot: `scheduleDelayedEvent` [code], guarded by the enable bit, a second enable loc_41ef, and the inhibit loc_422b, runs its own two-tier timer (loc_4245/loc_4246) and on elapse arms the delayed-event triple — DELAYED_EVENT_TIMER (0x422f), loc_424a, and DELAYED_EVENT_ARMED (0x422e) — either to fixed values (mode bit clear) or to a payload derived from work-RAM word sums (mode bit set); then `fireDelayedEventRequest` [code] counts DELAYED_EVENT_TIMER down each frame while armed and, on the zero tick, disarms and (only if both enables are still set) raises DELAYED_EVENT_REQUEST (0x4229). Finally `expireActivityGatedTimer` [code] ends an activity-gated phase: while its arm flag loc_422b bit 0 is set *and* at least one activity gate is open (loc_4224 nonzero, loc_4221 nonzero, or loc_4226 bit 0 set) it ticks the counter loc_422c and clears the arm flag once that counter reaches zero.

### A shared clamp helper

`markValueOutOfRange` [code] stands apart from the state machine: it is the saturation arm of a small value clamp used by the tile-variant computation, snapping register B to the fixed 0x80 (128) sentinel when the folding routine finds its input beyond range. It touches no sequence or timer cell — it is listed here only as a shared arithmetic helper that lives near this code.

## The object / formation field: records, motion planning, sweep, occupancy, spawn/launch

The standing swarm of aliens lives in two parallel pictures of the same thing. One is a
compact 6-row by 10-column **occupancy grid** (`OCCUPANCY_GRID`, 0x4123, rows a fixed 16 bytes
apart) where every live alien is a single set bit, expanded into a one-byte-per-cell **flag
block** (`FLAG_BITS_BASE`, 0x4100) that the launch and collision code can index directly. The
other is the array of full 32-byte object records — the standing swarm at `SPRITE_SOURCE_OBJ_BASE`
(0x42b0) and the general object table at `OBJ_TABLE` (0x42d0) — that carry each alien's state,
position, heading and packed grid cell. This subsystem keeps those two pictures in agreement, sways
the whole formation side to side, decides when and who peels off to dive, and settles divers back
into their cells.

### Seeding the interleaved object-RAM shadow

Formation setup begins by laying a fixed template into an interleaved shadow field.
`seedObjectRamShadowField` [seen] walks 32 source bytes into every *other* cell of a work-RAM
table starting at `loc_4021` (0x4021, 0x4023, … 0x405f) — the source pointer is dense, the
destination is stride-2, so the copy threads one field of a 32-entry table while leaving the
alternate cells alone. `seedObjectShadowFromRom` [seen] is the standard entry to that copy: it
simply points the copier at the ROM template `STRIDED_TABLE_SRC` (0x1d71) and runs it.
`advanceSequenceStateAndReseedObjectShadow` [code] wraps the reseed with a small side effect first:
it advances a pointer's low byte within its page, bumps the byte that pointer now names (both
callers arrive pointing at `loc_4009`, so the increment lands on the next cell up — the sequence
step counter — and wraps 255 back to 0), then falls through into the same ROM reseed. That is how a
sequence-state handler both steps itself forward and refreshes the object shadow in one motion.
`clearFlagBlockAndReseedObjectShadow` [code] is the heavier init used when a fresh formation is
being stood up: it zero-fills the entire 128-byte flag block at `FLAG_BITS_BASE`, clears the status
cells `loc_425f` and `loc_4238`, arms the mid-tier dwell timer at `loc_4009` to 64, and then hands
off to that advance-and-reseed step so the sequence advances and the shadow is refreshed together.

### The strided per-column table and the sweep broadcasts

A second stride-2 table at `loc_4028` (0x4028, 0x402a, … 0x4038) holds a nine-entry per-column
value that the renderer reads to sway columns. `broadcastToStridedTable` [seen] is the shared
writer: it stamps one byte across all nine cells at stride 2. `clearStridedTable` [seen] is just
that writer invoked with zero, a per-state reset of the column table.
`broadcastNegatedSweepToStridedTable` [seen] takes the low byte of the swept formation word,
negates it (two's complement), and broadcasts *that* — turning the formation's signed horizontal
offset into the per-column shift the hardware applies. `broadcastNegatedFormationSweepToStridedTable`
[code] is the convenience form that first fetches the current swept word's low byte from `loc_420e`
and then performs that negate-and-broadcast, so callers who just want "publish the current sway"
have a single call. The counterintuitive fact worth stating plainly: the stored sweep value is
broadcast *negated*, so a rightward swing of the formation word writes a leftward per-column shift.

### Reducing the grid to summaries and sweep bounds

Before the formation can sway sensibly it needs to know where its live edges are.
`summarizeFormationOccupancy` [seen] does the whole reduction. It OR-folds each of the six grid
rows into `ROW_OCCUPANCY` (0x41e8, sitting behind two always-zero guard cells) and each of the ten
columns into `COLUMN_OCCUPANCY` (0x41f0, behind three guard cells) — each summary cell is nonzero
exactly when that row or column still holds an alien. From the column summaries it then finds the
live horizontal extent: it scans inward from the rightmost column, stepping a bound outward by a
fixed column pitch for every *empty* column it passes until it meets an occupied one, and
independently scans inward from the leftmost column doing the mirror. The two results pack into
`FORMATION_X_BOUNDS` (0x4210) as a single word — low byte the from-right bound, high byte the
from-left bound — which is exactly the turnaround pair the oscillator reads. Finally it folds four
region-clear flags: the top four row summaries into `loc_4221` and all six into `loc_4220`, and two
object-table columns (seven slots of one field from `OBJ_TABLE`, then eight slots from `loc_42b1`)
into `loc_4226` and `loc_4225`. Each of those four is written as the any-occupied OR *toggled in
bit 0*, so bit 0 set means "this region is clear" — the polarity the gates downstream test against.

### Oscillating the formation

`advanceFormationSweepOscillator` [seen] is the per-frame sway. Normally it nudges the swept 16-bit
word at `loc_420e` one unit toward the `FORMATION_X_BOUNDS` pair, throttled to one step in four
frames by the low bits of `loc_425f`, and steered by the direction flag `OBJ_SWEEP_DIRECTION`
(0x420d). When the word reaches the upper bound it calls `setSweepDescending` [seen] (which writes 1
into `OBJ_SWEEP_DIRECTION`, flipping the walk to count down); at the lower bound it calls
`setSweepAscending` [seen] (which clears the flag back to 0). After each real step it publishes the
new offset through `broadcastNegatedSweepToStridedTable`. There is also a leading proximity gate: if
the behavior gate `loc_4208` is armed, the player shot at `loc_4209` sits in a narrow vertical
window, its X-delta from `loc_420a` lines up with the swept column, and that column reads occupied,
the routine short-circuits — it skips the step entirely and just re-broadcasts the current sway via
`broadcastNegatedFormationSweepToStridedTable`, holding the formation still while a shot is bearing
down on an occupied column.

### From grid cell to sprite position

Each object record carries a packed grid cell at record+7: the high nibble bits (0x70) are the
formation row, the low nibble the column. `positionObjectFromGridCell` [code] unpacks that into the
record's sprite X (record+3) and Y (record+4) using the convention the sprite renderer reads. The
display is rotated a quarter-turn from the formation grid, so the *row* drives the X field —
X = 124 minus three-quarters of the row value — while the *column* drives the Y field —
Y = the moving formation anchor at `loc_420e` plus the column scaled up by sixteen, plus a
seven-pixel sprite-hotspot offset. Because Y is anchored to `loc_420e`, every alien slides
horizontally on screen as the swept word oscillates, which is what makes the whole block move as one.

### Staging the standing formation as sprites

`stageObjectsToSpriteShadow` [seen] is the per-frame driver that turns the eight standing formation
records into eight sprite-shadow entries. It reads consecutive object records from
`SPRITE_SOURCE_OBJ_BASE` (0x42b0, 32-byte stride) into consecutive four-byte records at
`SPRITE_SHADOW_BASE` (0x4060), rendering them in two contiguous bands — a band of three then a band
of five — each band placed at a shared vertical offset. The orientation bit in `loc_4018` picks the
first band's offset (9 when set, 7 when clear); the tail band settles at 8 either way, so the flip
bit shifts only the leading band.

### Packing and unpacking the flag bitmask

The compact and expanded forms of the alien map convert both ways.
`unpackBitmaskToFlagBytes` [seen] reads a 16-byte packed bitmask and expands it, LSB first, into 128
one-byte flags at `FLAG_BITS_BASE` — 1 for each set bit, 0 for each clear one — and returns the
source pointer advanced past the 16 mask bytes, which the caller uses to pick up the template data
stored immediately after the mask. `packFlagBytesToBitmask` [code] is its exact inverse: it reads
bit 0 of the 128 flag bytes and packs them LSB-first into a 16-byte bitmap at the destination,
returning the destination advanced by 16 so a companion block copy can chain onto the end.

### Descriptor slots and object-slot activation

Spawning draws from a bank of 32-byte descriptor slots at `DESCRIPTOR_SLOT_TABLE` (0x4330).
`activateDescriptorSlot` [seen] initialises one slot chosen by the number held at a pointer: index
= number − 1, base = table + index*32, then it stamps the fixed init fields (active flag 1, a 0x0d
and a 0x0c into two fields, the index into field 7) and clears the rest, deliberately leaving fields
3 and 6 untouched. `spawnIntoFreeDescriptorSlot` [code] is the shared free-slot finder: it scans the
four descriptor slots from the last downward, and on the first slot whose two guard bytes are both
zero it hands off to `activateObjectSlotAndEnqueueSpawn` [code]. That routine consumes the trigger
flag it was found under (writing 0 at the trigger pointer), marks the slot active with a cleared
phase, records the caller's spawn code in field 6 and the trigger pointer's low byte as the source
index in field 7, and enqueues a type-1 spawn command keyed by that source index — returning the
trigger pointer unchanged so the finder can read its low byte back.

### The secondary-object spawn walk

A separate walk spawns a run of secondary objects. `spawnSecondaryObjectAndAdvanceWalk` [code] is
one step of that loop: it spawns into the current slot via `spawnSecondaryObjectIntoSlot` [code],
advances the slot pointer by 32 to the next record, and counts the budget down; while budget remains
it just returns, and when the budget hits zero it forces the enclosing loop counter to 1 so the walk
ends cleanly after this pass. `spawnSecondaryObjectIntoSlot` refuses to overwrite a live slot — it
bails if either of the slot's two live flags is already set — otherwise it consumes the trigger
flag, marks the slot alive, clears its state byte, inherits field 6 from the source record, stashes
the trigger index in field 7, and enqueues a type-1 activation command.

### Pacing launches out of the formation

Attackers leave the swarm on a two-stage timer. `paceEnemyLaunchTrigger` [code] is a gated
prescaler: it only runs while the play flag `OBJ_ACTIVE_FLAG` (0x4200) is set and both inhibit gates
`loc_4220` and `loc_422b` are clear. It ticks a master counter at `loc_424a`; until that expires it
holds the refill flag `SUBCOUNTER_REFILL_FLAG` (0x4228) low and stops. On expiry it reloads the
master from the head of `SUBCOUNTER_RELOAD_TABLE` (0x15e3) and sweeps a difficulty-scaled span of
sub-counters (the span widens with the pace counter `loc_421a` and, past stage 2, with the stage
`loc_421b`), decrementing each and refilling any that reach zero from the matching reload-table
entry; if anything refilled it raises `SUBCOUNTER_REFILL_FLAG`. That raised flag is the one-shot
`launchAttackerFromFormation` [code] consumes. That routine, while the region-clear gate `loc_4220`
is clear, derives a 1-to-4 slot budget from the pace counters (`loc_421a` + `loc_421b`, folded
right and capped), claims the first both-bytes-zero object slot scanning down from `loc_4391`
(stride 31), and stamps the launch direction from `loc_4215` into the slot — that direction also
chooses which end of `COLUMN_OCCUPANCY` to scan for an occupied column. Having found a column it
walks that column of the flag grid (its row count and geometry chosen by the sweep-mode flag
`loc_41ef`) for a filled cell, clears that cell out of the formation, activates the slot (active
byte, phase cleared, the cell's low byte into field 7), and enqueues the type-1 spawn command. In
short: the prescaler decides *when*, and the launcher pulls a real alien out of a still-occupied
column to become the diver.

### The object-AI state handlers

A freshly launched attacker runs through a small state machine dispatched on record+2.
`initSpawnedObjectFromGridCell` [code] is the first-tick handler: it clears the object's step timer,
raises the spawn flag `loc_41c2`, positions the sprite from the packed grid cell, and enqueues a
type-1 spawn command. It then looks up the object's sprite number and flight-curve seed from
`SPAWN_RECORD_TABLE` (0x1dd1) indexed by row; the top row additionally tallies its two following
neighbour slots into `ACTIVE_NEIGHBOR_COUNT` (0x422a) and takes a distinct attribute base. Either
path seeds the motion counters, advances the sub-state, and sets a signed heading whose sign comes
from the direction bit (+12 or −12, the latter stored as 244 by byte wrap).
`settleObjectIntoFormationCell` [code] handles a diver returning home: it bumps a frame counter,
repositions from the grid cell, and when the frame counter catches up to the positioned value it
deactivates the object, sets that cell's bit in `FLAG_BITS_BASE`, and enqueues a command word — so
the alien re-registers in the formation exactly where it belongs; a small even gap nudges the phase
field by the direction bit, while a large (≥25) or odd gap is left alone.
`reseedFormationObjectState` [code] re-inits a formation object's X to the left edge (8), zeroes its
heading, and ticks its leg counter, then branches on the packed cell's high bits: for an ordinary
cell it rolls a fresh random Y and advances the dispatch state, but only when enabled
(`OBJ_ACTIVE_FLAG` bit 0) and an activity gate is open (`loc_4224` or the region flag `loc_4221`
nonzero); for the special all-high cell it recounts its two active neighbours into
`ACTIVE_NEIGHBOR_COUNT` while any remain, and once none are left deactivates the object and ramps a
phase counter at `loc_421e` toward a ceiling of 2. `noopAnimDispatchSlot` [code] is the terminal
do-nothing slot of the object-animation dispatch table — it exists only so that state index has a
valid target. `bumpCountIfNeighborsInactive` [code] is a small helper for the neighbour bookkeeping:
it peeks the two object slots 32 and 64 bytes above the base and returns the count incremented by
one only if *both* of those look-ahead slots are inactive (active bit clear), otherwise the count
untouched.

### Player shot against the formation

`flagPlayerShotHitOnFormation` [code] resolves a player shot striking a standing alien. While the
shot gate `loc_4208` is armed, it takes the shot's Y from `loc_4209`, rejects anything outside the
formation's vertical span, and bands the remainder into a row by repeatedly subtracting the 7-then-5
row pitch (falling into the inter-row gap is a miss). It takes the shot's X-delta from the formation
anchor (`loc_420a` minus `loc_420e`), rejects deltas outside the horizontal hit window, and forms a
grid index from the column nibble and the row (nibble-swapped). If the addressed cell in
`FLAG_BITS_BASE` holds a live alien it clears it, enqueues a kind-1 command word carrying the grid
index, stamps a hit record (`loc_420b` = 1, `loc_42b1` = 1, `loc_42b2` = 0, and the shot's position
word into `loc_42b3`), and enqueues a second kind-3 command word whose column code is derived from
the grid index — that hit record and command pair is what drives the kill, scoring and sound the
kill triggers.

### Advancing the stage and rebuilding the formation

Two routines advance the whole formation to its next stage. `armFormationAdvanceTrigger` [code] is a
gated one-shot: only when both region-clear gates `loc_4220` and `loc_4225` have bit 0 set (both
regions cleared) and the pending word `loc_4222` is not already armed does it write the pending word
to 1 — enable byte 1, countdown byte zeroed. `advanceStageAndReseedFormation` [code] later consumes
that: on the tick where the enable at `loc_4222` is set and the countdown at `loc_4223` reaches
zero, it disarms the enable, rebuilds the 128-flag formation block from the packed template at
`loc_051b`, reseeds the formation anchor `loc_420e` to 1, and steps the stage selector `loc_421b`
(its low byte advancing but saturating at 7, its high byte counting freely). It enqueues a command
word (`loc_0700`) and then services a pending two-slot request held in `loc_421e`, raising `loc_4177`
for the first slot and, if the count still remains after decrement, `loc_4178` for the second.

### The sequence-state handlers that stitch the field together

Three handlers sit at fixed slots of the top-level sequence machine and marshal the flag block into
and out of persistent storage. `loadDescriptorAndAdvanceSequence` [code] unpacks a descriptor's
packed bitmask from `loc_051b` into the flag block, copies the 8-byte template that follows the mask
into the template buffer at `loc_4218`, clears `loc_425f`, sets `loc_421d` to 1, increments
`SEQUENCE_STATE` (0x400a), stamps the VRAM write counter `VRAM_WRITE_PTR` (0x400b) to 150, and
publishes a deferred-callback pointer (`loc_0640`) into `loc_4245`.
`packFlagsToBitmapAndSwitchPlayerState` [code] is a dwell-gated terminal: it counts the timer at
`loc_4009` down and does nothing until it expires, then clears `SEQUENCE_STATE` and two status cells
(`loc_4222`, `loc_422b`), packs the current flag bytes into `PACKED_FLAG_BITMAP` (0x4180), copies
the 8-byte template after it, marks `CURRENT_PLAYER` (0x400d) as 1, and moves `GAME_STATE` (0x4005)
to 4. `saveFlagsToSnapshotAndSwitchPlayerState` [code] is the mirror terminal: on the same dwell
expiry it resets the sequence and player cells, sets `GAME_STATE` to 3 with `CURRENT_PLAYER` 0, and
snapshots the packed flag bits into `SAVED_STATE_SNAPSHOT` (0x41a0) with the 8-byte companion block
appended — preserving one player's formation while the other plays.

Finally, `loc_090b` is a deliberately unnamed pure-stack epilogue shared by the command-enqueue
path: it restores the caller's saved register pair and returns, with no effect on the object or
formation field itself.

## Player ship, projectiles, dive scheduling, object-AI paths, and collisions

This subsystem is the live half of a Galaxian round: the player's ship at the bottom of the well, the single shot it fires up the screen, the swarm of enemy objects that peel out of the formation and dive, and the two collision sweeps that decide who dies. Everything here runs once per frame off the play-state pipeline, and everything reads or writes one of two shared references — the ship's lateral position in `loc_4202` and the master object-enable word `OBJ_ACTIVE_FLAG` (0x4200) — so it helps to fix the coordinate convention first.

Because the monitor is rotated, an object record's two position bytes do not line up with the words "X" and "Y" the way you would expect. `renderObjectSprite` [seen] and `positionObjectFromGridCell` establish the convention the rest of the code obeys: record+3 is the *descent* coordinate — it feeds the hardware sprite's X register but on the rotated screen it is the vertical, toward-the-player axis, and it is the coordinate the player's shot is tested against — while record+4 is the *lateral* coordinate, the cross-screen axis every homing and target-picking handler steers relative to the ship's `loc_4202`. Throughout this section "descent" means record+3 and "lateral" means record+4.

### The player ship

The ship itself is not an object record; it is a single lateral coordinate in `loc_4202` and a code that draws it. `moveControlledObjectAndStageSprite` [code] runs first each frame and does three things depending on state. When `OBJ_ACTIVE_FLAG` (0x4200) bit 0 is set the ship is live: it selects a movement command — the auto-pilot byte `OBJ_MOVE_CMD` (0x423f) when `loc_4006` bit 0 is clear (attract/demo), otherwise the second or first player's input shadow `IN1_SHADOW`/`IN0_SHADOW` (0x4011/0x4010) chosen by `loc_4018` — and nudges `loc_4202` one count down while bit 3 is set and the position is above the floor of 23, or one count up while bit 2 is set and below the ceiling of 233. When the ship is not active but `loc_4201` bit 0 is set (the post-hit state, described below) it stages the current position under an alternate code without clamping; otherwise it parks the position at zero. In every case it converts the position to a screen value by one's-complementing and offsetting by 128, and writes that value together with its code as four consecutive `(value, code)` pairs into `OBJ_STAGE_BLOCK` (0x4054) — the ship is drawn as a four-wide sprite figure, the live code being 6 and the alternate 7.

The important connection is that the same `loc_4202` that the player steers is the reference every attacker homes toward, and the `OBJ_MOVE_CMD` the demo ship obeys is produced by the dive director's own `computeControlledObjectMoveCommand` — in attract mode the machine literally plays itself through the same input path a human would.

### The player shot

The shot is one gated counter. `advancePlayerShot` [code] tests the shot gate `loc_4208` bit 0: while armed it drains the counter `loc_4209` by four each frame and, on the frame the counter lands in the narrow borrow window 14..17 near the top of the screen, raises the retire flag `loc_420b`. While the gate is idle it re-arms the counter to 220 — parked at the bottom next to the ship — and seeds the shot's lateral field `loc_420a` from the ship's `loc_4202` when `OBJ_ACTIVE_FLAG` bit 0 is set, else to zero; so an un-fired shot tracks the ship sideways, and a fired shot freezes its lateral field and travels straight up as the counter drains. `advancePlayerShotAndStageSprite` [code] wraps that service call and then builds the shot's two render cells from the counter/field pair: `loc_409f` from the counter (either `counter - 1` or `complement(counter) + 252` depending on `loc_4018` bit 0) and `loc_409d` from the complement of the lateral field. The counter and field are exactly the descent/lateral pair the shot-collision sweep reads back as the shot's position.

### Object records and the two per-frame dispatchers

The enemy objects live in a table of eight records of 32 bytes starting at `SPRITE_SOURCE_OBJ_BASE` (0x42b0); the seven records from `OBJ_TABLE` (0x42d0) onward are the attackers proper, and the leading 0x42b0 slot is a formation/leader slot the collision sweeps skip. The per-frame slot loop walks all eight and, for each, branches on the record's control bytes: byte 1 bit 0 marks an object in its deactivation (dying) animation and takes priority; byte 0 bit 0 is the plain active flag; a record with neither set is skipped. Byte 2 is the state index. A live object's byte 2 selects one of sixteen AI handlers; a dying object's byte 2 selects one of four death-animation sub-handlers. Most of the routines in this section are entries in those two tables, and record+9, record+0x10/0x11 (move throttle and leg counter), record+0x13/0x19 (walk cursor) and record+0x18..0x1c (curve seed and accumulators) are the scratch fields those handlers cycle through.

### The horizontal target-picking family

At the base of the movement machinery is `commitMoveToTargetX` [seen]: given a chosen lateral target, it stashes the target in record+0x19, computes the signed per-frame step delta (current lateral minus target) into record+9, zeroes the three-byte move accumulator at record+0x1a, and bumps the planner sub-state in record+2 so the following frame begins stepping toward the target.

Two pickers feed it. `commitMoveAcrossPlayerX` [code] aims the actor at the *opposite* side of the ship: it signed-halves the gap between the actor's lateral position and `loc_4202`, biases it by 16, and clamps to the far band — 144..208 when the actor is left of the ship, 48..112 when at or right of it — then commits that target. `commitMoveToStoredOrPlayerTargetX` [code] chooses between two behaviours by the leader slot: when `OBJ_TABLE` (0x42d0) bit 0 is set it steers toward the leader's stored target in `OBJ_TABLE`+0x19, otherwise it falls back to the cross-player pick. Sitting above both, `advanceActorPhaseAndCommitMove` [code] is the state-2 handler: it bumps the actor's phase counter in record+3, then routes by the object's kind field — `(record+7) & 0x70 == 0x60` uses the stored-or-player pick, every other kind uses the plain cross-player pick.

`beginObjectCrossPlayerMove` [code] is the shared launch tail: it runs the cross-player pick and then seeds the flight-curve step count (record+0x18 = 3, giving four curve steps) and a long move throttle (record+0x10 = 100) so the object glides toward its new target before the curve takes over. `armDirectedMoveWhenInWindow` [code], the state-8 handler, cruises via that tail until *both* the arm counter (record+3) and the lateral position (record+4) fall inside the window [96,160); once in-window it jumps the sub-state forward by two, seeds the move timers (record+0x10 = 3, record+0x11 = 12), clears record+5 and record+0x13, and sets the direction bit record+6 from whether the ship's `loc_4202` sits below the object's lateral position. `restartObjectMoveRun` [code], state 12, simply bumps record+3, forces the state back to 8 (re-entering the arm-window state), and launches a fresh cross-player move — the loop that keeps an attacker weaving across the player until it commits to a dive. `homeObjectXTowardPlayer` [code], state 7, is the tight-tracking variant: it treats record+4:record+9 as a 16-bit lateral position and drives it toward `loc_4202` by roughly four times the signed distance each frame (with the hardware's rounding bias of 2 or 3 depending on side), advancing the state only when the dwell timer in record+16 runs out.

### The path-walk family

When an object flies a scripted arc it walks the delta table `PATH_STEP_TABLE` (0x1e00) two bytes at a time. `advanceObjectPathStep` [code], the state-1 handler, reads the per-object cursor in record+0x13/0x19, adds the first delta to the descent coordinate and the second (subtracted or added by the direction bit record+6) to the lateral coordinate; if the lateral position plus a 7-pixel margin crosses the near edge it forces the state to 5 (the fall-away/dive commit); otherwise it advances the cursor, ticks the move throttle (record+0x10, reload 4) and on throttle expiry nudges the cross-step in record+5 and ticks the leg counter (record+0x11), advancing the state when the leg finishes. `advanceObjectPathStepDescending` [code], state 10, is the subtract-direction mirror: it subtracts the two deltas from the descent then lateral coordinates, reloading throttle/leg/heading/cursor with 3/12/12/0 on a finished leg, and — when the direction bit record+6 is set — hands the second (lateral) half off to `advanceObjectPathStepAscending` [code] instead. That ascending arm adds its step-table byte to the lateral field, steps the heading in record+5 upward, and on a finished leg reloads throttle/leg/heading/cursor with 3/12/244/0; it is the increasing-heading counterpart used when an object should sweep the other way. Finally `advanceObjectPathStepAlias` [code], state 11, is a bare trampoline that forwards straight to `advanceObjectPathStep` with no work of its own.

### The dive and the flight curve

`advanceObjectDiveStep` [code], state 4, is where an attacker actually plunges. It steps the descent coordinate by one or two per frame depending on the frame-parity bit `loc_425f`, and while that coordinate sits inside the small window [6,9) it just bumps the state index. Outside the window it runs `advanceObjectFlightCurve` [code] and folds the resulting heading high byte (record+0x19) plus the per-object increment (record+9) into a new lateral coordinate; a carry that crosses the signed boundary means the swoop ran off the edge, so it bumps the state instead of storing. `advanceObjectFlightCurve` is the swoop generator: it runs `((record+0x18 seed) & 3) + 1` integration steps of a cross-coupled fixed-point rotation over two 16-bit accumulators held at record+0x19/0x1b and record+0x1a/0x1c, each step adding twice the *other* accumulator's sign-extended high byte and reverting any step whose high byte lands exactly on 128 (the overflow guard). The rotating accumulators' high bytes are the curved offset the dive adds to the lateral position, which is what gives Galaxian's attackers their characteristic banking arc.

### Phase setup and settling

`initObjectPhaseSteps` [seen], state 13, primes a multi-step phase: it derives a step count `n = (~record+7) & 3`, writes `n+1` into the step-count field record+22 and a derived code byte `((n+1) << 4) + 140` into record+3, arms the phase timer record+16 to 24, advances the sub-state, and clears the ready flag record+15 — re-arming it to 24 only when `n` is zero. `settleObjectXAtRest` [seen], the state-15 terminal handler, steps record+4 up one count per frame until its 8-bit-wrapped distance from the rest value 200 falls within 5, then holds — this is how a returning object eases back into its formation slot and stays there.

### The deactivation (death) animation

Once a collision marks an object dying (byte 1 bit 0 set), the slot loop routes it to the four-entry sub-state table. `tickDeactivatedObjectAnim` [code] is sub-state 1: it counts the fast timer record+16 down, reloading it to 4 and bumping the companion record+18 on each elapse, then counts the slow timer record+17; when the slow timer elapses it either retires the object (state byte record+1 = 0) or — if the position field record+7 has reached 112 — reloads the fast timer to 50, seeds the companion from the global `loc_422d` plus 32, and advances the sub-state. `endObjectAnimOnTimerExpiry` [code], sub-state 2, is the plain finish: it ticks the expiry timer record+16 down and, on the frame it hits zero, clears the state byte record+1 to retire the actor. (The sub-state-0 entry and the sub-state-3 no-op complete that table but are outside this subsystem.)

### Dive scheduling and the director

Several routines pick *which* object dives, *which way*, and — in demo mode — how the ship dodges. `selectAttackerRowScan` [code] chooses the formation row that launches next: seeded by the alt flag `loc_421b` (slot 2/base 157 when nonzero, else slot 1/base 132), it scans up to four two-byte slots of `ROW_OCCUPANCY` (0x41e8), advancing while neither byte of a slot has bit 0 set, and stores the resulting (slot index, base value) pair into `loc_4213` for the row-based launch scans. `chooseNextAttackerDirection` [code] sets the shared launch/curve direction flag `loc_4215`: the sign of the 16-bit formation anchor `loc_420e` picks which edge of `FORMATION_X_BOUNDS` (0x4210) to measure the lateral gap against, and within 28 pixels of that edge the flag is forced away from it (0 near the high bound, 1 near the low), otherwise a fresh random bit decides — this keeps launched attackers curving back toward center rather than off-screen.

`computeControlledObjectMoveCommand` [code] is the attract-mode auto-pilot that drives the ship. Once every 32 frames (gated on `loc_425f`) and only while `loc_4007` bit 0 and `OBJ_ACTIVE_FLAG` bit 0 are both set, it sums every object's positional weight across both object banks — the seven-record `OBJ_TABLE` (0x42d0) at stride 32 and the compact bank based at `loc_4260` — adds a scaled offset of the formation anchor `loc_420e` against the ship's `loc_4202`, applies a random ±1 nudge, and buckets the biased result into `OBJ_MOVE_CMD` (0x423f) as 0, 4, or 8 — the same bits `moveControlledObjectAndStageSprite` reads as "hold", "move up", "move down". The per-object weight comes from `accumulateObjectPositionWeight` [code], a register-only accumulator that contributes nothing unless the object is active, its descent sits in one of two 52-row bands from 128, and its lateral delta from `loc_4202` is in the lower half; when it qualifies it folds the object's flag bit 7, lateral delta bits 5-6, and band into a 0-15 index and adds the signed `OBJ_STEP_TABLE` (0x1a45) entry to the running total. The net effect is a weighting that biases the demo ship toward or away from the densest, nearest part of the swarm.

### Collisions

Two sweeps decide contact, each walking the seven attacker records from `OBJ_TABLE` (0x42d0). The shot sweep, gated on the shot gate `loc_4208`, runs `flagPlayerShotHitOnObject` [code] on each: for an active object it box-tests the object's descent against the shot counter `loc_4209` (6-wide band) and its lateral against the shot field `loc_420a` (12-tall band), and on an overlap raises the shot-retire flag `loc_420b` and tail-calls `awardKillScoreByBandAndDeactivate` to score the kill and begin the object's deactivation animation. The player sweep, gated on `OBJ_ACTIVE_FLAG`, runs `flagObjectHitOnPlayer` [code]: it classifies the object's descent-plus-33 into a near window (below 5) or far window (below 17) — the vertical proximity to the player's row — and, within that window, tests the lateral distance `loc_4202 - (record+4)` against the window's band (near ±7/15, far ±10/21); on an overlap it raises `HIT_EVENT_FLAG` (0x4204) and likewise scores and deactivates the object.

`handlePlayerHitEvent` [code] is the sole consumer of `HIT_EVENT_FLAG`, run later in the same frame. If the flag's bit 0 is clear it does nothing; otherwise it clears the flag, drops `OBJ_ACTIVE_FLAG` to 0 and raises `loc_4201` to 1 (which is exactly the alternate state `moveControlledObjectAndStageSprite` detects to freeze the ship after a hit), arms the two pulse counters `loc_4205`/`loc_4206` to 10 and 4, queues the hit-sound command word, decrements the activity pace counter `loc_421a` (floored at zero), steps the [0,5] cycle counter `loc_421d`, and pulses `SOUND_W_REG3` (0x6803) when `loc_4006` bit 0 is set. This is the whole player-death handshake: the object subsystem goes quiet, the ship enters its frozen render state, and the death sound is armed.

### Round setup

Two sequence handlers stand the whole subsystem up. `resetObjectRamAndAdvanceSequence` [code], the first sequence-state entry, reseeds the interleaved OBJRAM shadow from the ROM template at `loc_1d91`, zeroes the 64-byte sprite-shadow span at `SPRITE_SHADOW_BASE` (0x4060) and a broad object-record region from `loc_4260`, clears `loc_4238` and the message-scroller enable `MESSAGE_SCROLL_ENABLE` (0x40b0), points the VRAM cursor `VRAM_WRITE_PTR` (0x400b) two cells into `VRAM_BASE`, arms the dwell tier `loc_4009` to 16, and advances `SEQUENCE_STATE` (0x400a). `activateObjectsAndBeginPlayPhase` [code] is the state-timer that later flips play on: it ticks `loc_4009` and, on expiry, reloads it to 10, advances `SEQUENCE_STATE`, sets `OBJ_ACTIVE_FLAG` (as a word) to 1 to enable the object/AI/shot/collision machinery, seeds the ship reference `loc_4202` to 128 (center), refills the sixteen-byte enemy-launch sub-counter block at `loc_424a` from `SUBCOUNTER_RELOAD_TABLE` (0x15e3), clears the scratch cells `loc_4058`/`loc_405a`, and queues two display command words. `loc_090b` [code], reached along that command-queue path, is a deliberately unnamed pure-stack epilogue — it restores the caller's saved register pair and returns with no work-RAM effect.

## Sound

Galaxian's audio is discrete-logic hardware rather than a programmable sound chip: a bank of write-only latches that the program pokes fresh every frame. Four LFO-frequency latches occupy SOUND_LFO_FREQ (0x6004-0x6007) and colour the background hum; eight sound-write registers run consecutively from SOUND_W_REG0 (0x6800) through 0x6807, of which the low three (SOUND_W_REG0/1/2) are the hum voices, SOUND_W_REG3 (0x6803) carries a stepped tone, SOUND_W_REG4 (0x6804) a decaying sweep, and SOUND_W_REG5 (0x6805) a gated square tone; the melodic pitch goes out through the pitch port SOUND_PITCH_W (0x7800). Between the code and that hardware sit two work-RAM shadows: SOUND_PITCH (0x41c1) holds the pitch byte to be latched this frame, and the composite cell loc_41c0 holds a small code (0, 1, or 2) that the frame driver turns into the register-6/7 waveform bytes.

The melodic side is composed once per frame. The frame driver first clears loc_41c0 and pre-loads SOUND_PITCH to 0xff, then runs the melodic effect updaters in a fixed order, and finally latches the composed result to the hardware — loc_41c0 to register 0x6806, its one-bit rotation to 0x6807, and SOUND_PITCH to the pitch port 0x7800. A separate per-frame pass, the play-update pipeline, runs the three non-melodic effects (the occupancy hum, the decaying sweep, and the stepped tone). Every routine below is therefore either a *producer* that stages bytes into those shadows or a *driver* that pushes bytes straight at the latches.

**Staging a pitch.** The leaf producer is stageSoundPitch [seen], which parks one byte into SOUND_PITCH and does nothing else; the frame driver latches it out later. stagePitchAndRaiseSoundFlag [code] is the richer cousin: it stores the value biased down by one (A-1, wrapping mod 256, so 0 becomes 255) into SOUND_PITCH and raises the composite flag loc_41c0 to 1, marking the shadow pair as filled with a shaped tone this frame.

**Pitch derived from the sound counter.** A three-link chain converts a slowly advancing counter into a warbling pitch. tickSoundCounterAndStagePitch [seen] is the tail of the counter manager: when the running count handed to it is nonzero it decrements the sound counter loc_41c4 and stores it back, then hands off to stageSoundPitchBySelector [code]. That dispatcher reads the low two bits at the manager's cursor: a zero selector stages a fixed pitch of 96 through stageSoundPitch, while a nonzero selector is passed to stagePitchFromSoundCounter [code]. There the counter loc_41c4 becomes the pitch: an *odd* selector biases the byte up by 96 and rotates the sum right one bit (the add's carry rotating back into the top bit) to give a warble, whereas an even-but-nonzero selector passes loc_41c4 through untouched; either way the result is staged via stageSoundPitch. So the same counter cell drives both a plain rising pitch and a warbled one depending on the low bit of its selector.

**The rising pitch ramp.** driveRisingPitchRamp [code] manages an arm counter at loc_41c9 with a pre-decrement that is only a branch test — the byte is *not* written back while it stays nonzero, so as long as the arm holds any value but 1 the routine advances the ramp; only when the pre-decrement reaches zero does it store loc_41c9 = 0 and reload the {countdown, pitch} pair at loc_41ca to the 16-bit value 0x0020 (countdown 32 in loc_41ca, pitch 0 in loc_41cb). The advance step itself is advanceSoundPitchRamp [seen]: it treats loc_41c9 as the base of a {countdown, pitch} pair, idles when the countdown byte one past it has drained to zero, and otherwise consumes one count, adds a fixed step of 4 to the pitch byte, publishes that pitch to SOUND_PITCH, and clears the composite flag loc_41c0 so the tone composes as a plain ramp.

**The pulse-tone envelope.** advancePulseToneEnvelope [code] ticks a 16-bit envelope word held across loc_41c7 (low) and loc_41c8 (high). When bit 0 of the low byte is set the word is spent, so it resets to the sentinel 0x8000 (loc_41c7 = 0, loc_41c8 = 128) and stops; otherwise it hands the high byte to pulseSoundToneFromCountdown [code]. That handler idles on a zero high byte, and otherwise stores the high byte decremented back into loc_41c8 and stages a two-level pulse through stagePitchAndRaiseSoundFlag — 129 when bit 2 of the decremented value is set, 0 otherwise — so the tone chatters on and off as the envelope counts down.

**The gated square tone.** Two routines cooperate on SOUND_W_REG5. driveGatedSquareTone [code] is the toggler: while the duration counter SOUND_TONE_DURATION (0x41ce) is nonzero it counts one off it and writes the frame flag loc_4007 with bit 0 flipped to SOUND_W_REG5, so the register alternates each frame and produces a square wave; once the duration is spent it writes 0 to silence the register. Above it sits advanceGatedSquareTone [code], which gates the toggler by a phase counter at loc_41cc: it pre-decrements that byte purely to pick a branch (never storing it while nonzero), driving the toggler on every tick except the one where loc_41cc holds exactly 1, at which point it stores loc_41cc = 0 and re-arms SOUND_TONE_DURATION to 8.

**The sound-sequence channels.** Three descriptor bytes drive a table-fed sequencer, but they time-share one tone/duration/cursor triple. advanceAllSoundSequenceChannels [code] steps all three in turn — the descriptors at loc_41d2, loc_41cf, and SOUND_SEQ_ACTIVE (0x41cd) — by running advanceSoundSequenceChannel [code] on each. That worker does nothing for a descriptor byte of 0; for an active channel it sets the composite flag loc_41c0 to 2, publishes the current tone loc_41d5 to SOUND_PITCH, and counts one off the shared duration timer loc_41d6. When that timer expires it reads the next command byte at the shared cursor SOUND_SEQ_PTR (0x41d3): the end marker 0xe0 deactivates the channel (descriptor byte cleared to 0), and any other byte splits into a low-5-bit index into SOUND_TONE_TABLE (0x17a9) for the new tone loc_41d5 and a high-3-bit index into SOUND_DURATION_TABLE (0x17c8) for the new timer loc_41d6, advancing the cursor past the byte.

Each channel is armed on a different trigger, and all three publish into that same tone/duration/cursor triple. armSoundSequenceOnRequest [seen] fires only when the request gate loc_41d1 holds exactly 1: it consumes the gate (clears it), raises the descriptor loc_41d2 and the duration loc_41d6 to 1, and points SOUND_SEQ_PTR at the sequence table loc_1e68. armSoundSequenceBySelector [code] runs only while the sound driver is enabled (bit 0 of loc_4006): it reads the request selector loc_41df, hands any value other than 6 to armSoundSequenceForSelector16, and for selector 6 arms this channel — unless SOUND_SEQ_ACTIVE is already set — by raising loc_41cf and loc_41d6 and pointing SOUND_SEQ_PTR at loc_1ebd. armSoundSequenceForSelector16 [code] handles only selector 0x16 and ignores every other value; on a match it clears loc_41cf, raises SOUND_SEQ_ACTIVE and loc_41d6, and points SOUND_SEQ_PTR at loc_1edf. The three arming paths thus map one-to-one onto the three channel descriptors that advanceAllSoundSequenceChannels ticks.

**The occupancy hum.** driveSoundVoicesFromOccupancy [code] runs in the play pipeline on even frames only (bit 0 of loc_4007 clear). It sums a 6-row by 10-column region of OCCUPANCY_GRID (0x4123, row stride 16) into a tally seeded at 1, then lights one of the three hum registers SOUND_W_REG0-2 per unit of tally — stopping the instant the tally drains and capping at three lit voices — and zeroes every remaining register from the stopping point on. Finally it sets the near-empty flag loc_4224 to 1 when the leftover count is below two (few or no objects on screen), else 0, so the hum thins out as the formation is cleared.

**The decaying sweep, and the sound-request cell.** driveDecayingSoundSweep [code] also lives in the play pipeline and also gates to even frames via loc_4007. Its countdown is the shared sound-request cell loc_41df: while that byte is nonzero it emits the byte rotated right two bits to SOUND_W_REG4 and ticks it down one, so the register value shrinks toward silence. That same cell loc_41df is where armObjectAnimAndRequestSound [code] posts a request. That routine is the sub-state-0 entry of a deactivated object's death/animation dispatch: it seeds the object's animation timer fields (frame divider 4, step count 4, step field 28), advances the object sub-state so it runs once, and writes a sound selector into loc_41df — the high effect 0x17 when the object's position byte is at/above 112, the low effect 0x07 below it. So loc_41df is a single "current sound request" byte read three ways: as the sequence selector by armSoundSequenceBySelector, and as a self-decaying value fed to the sweep register by driveDecayingSoundSweep.

**The stepped tone.** driveGatedSoundStepSequence [code] is the third play-pipeline effect, gated by bit 0 of the enable flag loc_4201 (armed elsewhere by a player-hit event, which also seeds the prescaler loc_4205 = 10 and step counter loc_4206). Each eligible frame it counts one off the prescaler loc_4205 and returns until it reaches zero; on that tenth eligible frame it reloads the prescaler to 10, enqueues a command word (opcode 2 packed with the current step loc_4206) into the command queue, and steps loc_4206 down. When the step counter drains it ends the sequence: clear the enable flag loc_4201 and silence SOUND_W_REG3 (0x6803). The command-word enqueue shares the small stack epilogue loc_090b, a deliberately-unnamed two-instruction exit that restores the saved HL and returns with no work-RAM effect.

**The background-hum LFO level.** driveSoundLfoLevel [code] runs each frame from the vblank handler, right after the melodic driver. With no reset pending (SOUND_LFO_RESET_REQUEST at 0x41d0 is 0) it runs decaySoundLfoLevel [code]; otherwise it consumes the request (clears 0x41d0) and slams the full level 15 across the LFO latches. decaySoundLfoLevel is a guarded fade: only on the tick where loc_425f holds 0xff, and only while the level SOUND_LFO_LEVEL (0x421f) is nonzero, it drops the level by one and re-broadcasts it. Both paths converge on broadcastSoundLfoLevel [seen], which saves the level into SOUND_LFO_LEVEL and then fans it across the four LFO-frequency latches at SOUND_LFO_FREQ (0x6004-0x6007), rotating the byte right one bit between each write so the four latches receive progressively shifted copies.

**Silencing everything.** silenceSoundAndDisableIrqStars [code] is the hardware quiesce used when play stops: it writes 1 to each of the four SOUND_LFO_FREQ latches, clears all eight sound-write registers (0x6800-0x6807), clears the interrupt-enable latch IRQ_ENABLE (0x7001) and the starfield-enable latch STARS_ENABLE (0x7004), and drives the pitch port SOUND_PITCH_W (0x7800) fully high (0xff) — killing audio while also halting the vblank interrupt and the scrolling starfield in one pass.

## Coins, credits, the HUD, score display, and the message scroller

This subsystem covers everything the cabinet shows a waiting or paying customer: it takes coins and turns them into credits, lights the start buttons, walks the attract sequence that wipes and repaints the screen, scrolls the on-screen messages, and paints the two player scores, the high score, and the reserve-ship row.

### From a coin to a credit

The per-frame front end is `serviceCoinInputs` [seen]. It first checks the config-mode byte `loc_4000` (0x4000): in mode 3 it hands straight off to `presetCreditCount` [code], which is the free-play / test preset -- it zeroes the coin-phase flag `loc_4001` (0x4001) and jams the credit count `loc_4002` (0x4002) to 9, so the machine always appears to hold nine credits. In every other mode it reconstructs a coin edge by OR-ing the two raw input shadows `IN0_SHADOW` (0x4010) and `loc_4013`, complementing that, and masking the result through the two guard/enable cells `loc_4015` and `loc_4016`. If bit 7 of the surviving byte is set it calls `addCreditForCoin` [code] directly; otherwise the low two bits are treated as two independent coin slots, and each set bit bumps the coin-pulse queue `loc_4004` (0x4004) -- so one service pass can register up to two pulses.

Those queued pulses are drained a few frames apart by the coin dispatcher (loc_1931), which paces itself off a small reload timer at 0x4003 and, while that timer runs, keeps `pulseCoinCounter` [seen] driving the mechanical coin-counter output `COIN_COUNTER_0_LATCH` (0x6003). `pulseCoinCounter` rotates its byte right three bits (so bit 3 of the source lands in the counter's only wired bit, bit 0) and ticks its width timer down. When a pulse's turn comes the dispatcher branches on the coinage mode: the two-coins-per-credit path is `awardCreditEverySecondCoin` [code], which uses `loc_4001` as a one-bit phase flag -- on the first coin of a pair it calls `setCoinPhaseFlag` [code] to raise the flag, and on the second it clears the flag and calls `incrementCreditCount` [code] to actually award the credit.

`incrementCreditCount` and `addCreditForCoin` are the two places `loc_4002` grows, and both respect the same ceiling of 99: `addCreditForCoin` simply refuses to go past 99, while `incrementCreditCount` returns unchanged at exactly 99 and, if it ever finds the count already above 99, calls `clampCreditsToMax` [code] to pin it back to 99. On a real bump each of them raises the ready/event flag `loc_41c9` (0x41c9) and posts a command-queue request -- channel 7 -- that later has the credit line on the HUD repainted. (Those posts share a small stack-cleanup tail, the deliberately-unnamed `loc_090b` [code], which merely restores the caller's pointer and returns; it touches no work RAM.)

The coin mechanism itself is gated by credit inventory through `updateCoinLockoutFromCredits` [code]: at nine or more banked credits it releases the lockout coil by calling `clearCoinLockout` [code] (writing 0 to `COIN_LOCKOUT`, 0x6002), and below nine it engages the lockout by writing 1 there -- so the machine physically stops accepting coins once nine credits are stacked up.

### Lighting the start buttons and advancing into a game

`driveStartButtonLamps` [code] translates the credit count into the two start-button lamp latches `START_LAMP_0` (0x6000) and `START_LAMP_1` (0x6001). It is gated by bit 5 of the mode byte `loc_425f`: when that bit is clear the lamps are forced off; otherwise zero credits leaves the lamps as they are, one credit lights lamp 0, and two or more lights both -- the classic "1-player / 2-player start" lighting.

The credit that finally starts a game is noticed by `advanceGameStateOnCredit` [code]: whenever `loc_4002` is nonzero it steps the top-level `GAME_STATE` (0x4005) forward and resets the attract cluster around it -- clearing `loc_4007`, the sequence step `SEQUENCE_STATE` (0x400a), `loc_41c2`, the sound-sweep countdown `loc_41df`, and the message-scroller enable `MESSAGE_SCROLL_ENABLE` (0x40b0). A zero credit count makes it a no-op, so the attract loop keeps cycling until money is in.

Several handlers in the attract/start sequence, keyed on `SEQUENCE_STATE`, live here. `holdStartLampsThenAdvanceSequence` [code] ticks its own countdown `loc_4019` and, for as long as it runs, keeps `driveStartButtonLamps` in sync with the credits; on the zero-crossing it advances `SEQUENCE_STATE` and clears the 128-byte flag block at `FLAG_BITS_BASE` (0x4100). `blankVramRowsThenDriveStartLamps` [code] fills two 28-cell blank-tile rows (tile 16) through the VRAM write cursor `VRAM_WRITE_PTR` (0x400b), skipping a four-cell gap between rows, and ticks the row tier `loc_4009`; on the last row it advances the state, clears the screen-flip latches `FLIP_SCREEN_X`/`FLIP_SCREEN_Y` (0x7006/0x7007) and the direction flag `loc_4018`, posts two command-queue requests, and drives the lamps once more. `emitMessageColumnsThenAdvanceSequence` [seen] runs a two-tier dwell over `loc_4008`/`loc_4009`: it resets the strided table each pass, and each time the low tier expires it reloads it to 80 and posts a channel-6 message request whose parameter tracks the mid-tier count; when the mid tier expires it advances `SEQUENCE_STATE`, reloads both tiers (32 / 4), wipes the sprite-source block at `SPRITE_SOURCE_OBJ_BASE` (0x42b0), and zeroes the redraw count `DRAWN_COLUMN_COUNT` (0x4241). `postCreditAndMessageDrawsAndAdvance` [code] is a simpler state that just posts a credit-line request (channel 7) and a message request (channel 6), steps the state, and re-arms the dwell cascade (0x4008 = 96, 0x4009 = 16).

The round itself begins in `startGameRoundAndClearScores` [code]: it stores the player-count/spawn word into `CURRENT_PLAYER` (0x400d), blits the 32-byte ROM row template at `loc_051b` into the packed flag bitmap `PACKED_FLAG_BITMAP` (0x4180), optionally arms the sub-state advance gate when bit 0 of `loc_401f` is set, then enters play by setting `GAME_STATE`=3, `SEQUENCE_STATE`=0, `loc_4006`=1 and `loc_41d1`=1. It finishes by posting a start-message request (channel 6) and two channel-4 requests that clear the on-screen score slots -- the "clear scores" part of the name.

### The message scroller and text columns

Static and scrolling text share a painter, `renderMessageColumn` [seen], indexed by a small selector. The selector's low bits index the pointer table `MESSAGE_PTR_TABLE` (0x235c) to fetch a destination word and a text pointer, and the top two bits pick a mode. Bit 7 means "erase": it overwrites each cell up the column (stepping one screen row, -32, per character) with the blank tile until the text's 63 terminator. Bit 6 means "arm the scroller": it records the running pointers `MESSAGE_DEST_PTR` (0x40b5) and `MESSAGE_TEXT_PTR` (0x40b3), derives a per-column counter cell in the `loc_4020` table and stores its pointer in `MESSAGE_CURSOR_PTR` (0x40b1), clears the whole 32-cell column to tile 16, seeds that counter with the destination row packed into its top bits, and raises `MESSAGE_SCROLL_ENABLE` (0x40b0). With neither top bit set it simply paints the entire string at once, each source byte mapped to a font tile by subtracting 48.

Once armed, `advanceMessageScroller` [seen] reveals the message one glyph at a time. Each frame, while `MESSAGE_SCROLL_ENABLE` bit 0 is set, it reads the counter cell: that cell does double duty -- its low three bits pace the reveal (a glyph is emitted only when they are zero, i.e. once every eight frames) while the whole byte counts down toward the end of the scroll. On an emit frame it copies the next character (mapped by subtracting 48) into the destination cell, advances the text pointer, steps the destination one row up, and then ticks the counter; on delay frames it just ticks. The tick itself is `endMessageScrollOnExpiry` [seen] (and its DE-entry twin `endMessageScrollOnExpiryFromDe` [seen], which only swaps the pointer in before delegating): it decrements the counter and, on the exact zero-crossing, clears `MESSAGE_SCROLL_ENABLE` so the scroller stops. A run of enemies can also feed this pipe: the object-AI step `advanceObjectAndQueueMessageColumn` [seen] counts a per-object dwell timer down and, on expiry, posts a channel-6 request carrying that object's payload selector (biased by 75) and advances the object's own state -- turning an in-flight object into a message column.

The static text descriptors are painted by a little three-routine stack. `drawTextColumn` [code] is the innermost loop: given a count, a source pointer, a destination, and a stride, it writes `count` characters (each mapped to a tile by subtracting 48) walking the source forward one byte and the destination by the stride -- a negative stride walks up a column, and a count of zero means a full 256 passes. `drawTextColumnFromDescriptor` [code] unpacks a five-byte descriptor (source word, destination word, count byte) at a record pointer and calls `drawTextColumn` with the up-a-column stride of -32. `drawTextColumnByIndex` [code] simply indexes the ROM descriptor table `TEXT_DESCRIPTOR_TABLE` (0x1cf6) by a selector (five bytes per record) and paints that descriptor -- the form used to place the fixed attract-screen text.

### Scores, the high score, and the reserve-ship row

Numbers reach the screen as packed BCD. `byteToPackedBcd` [code] converts a binary byte to its value-mod-100 as two decimal digits (tens in the high nibble), feeding the HUD readouts. `drawBcdDigit` [code] paints one BCD nibble as a font tile -- digits '0'..'9' are the contiguous tiles 0x90..0x99, so it draws digit+0x90 -- with leading-zero suppression: while a blank budget is nonzero a leading zero is drawn as the blank tile (0x80+0x90 wraps mod 256 to tile 0x10) and the budget is consumed, and the first significant digit ends suppression. `drawBcdNumberColumn` [code] drives that six times over: it reads three packed-BCD bytes walking the source pointer downward, paints high nibble then low for each, steps the VRAM cursor one row up (-32) per digit, and starts with a four-digit blank budget -- so a three-byte score prints as six digits up a column with its leading zeros blanked.

Where those digits land is chosen by a few selectors. `selectCurrentPlayerScore` [code] returns the active player's three-byte BCD field -- `PLAYER1_SCORE_BCD` (0x40a2) when `CURRENT_PLAYER` is 0, else `PLAYER2_SCORE_BCD` (0x40a5) -- for the scoring code to accumulate into. `drawScoreToSelectedPlayerField` [code] picks the VRAM cursor from a field selector -- the primary field `DIGIT_FIELD_PRIMARY` (0x5381) for zero, the alternate field `DIGIT_FIELD_ALT` (0x5121) otherwise -- and paints a number column there. `drawScoreFieldByIndex` [code] is the redraw dispatcher: index 0 repaints player 1's score, index 1 repaints player 2's score (but only when the two-player-live flag `loc_400e` is set, which also selects the alternate field), index 2 repaints the high score, and an index of 3 or more descends, redrawing every field from index-1 down to 0. The high-score paint itself, `drawHighScoreDigits` [code], fixes the cursor at the high-score VRAM field `loc_5241` and draws six digits from the caller's source; it is reached both from the high-score update tail (after a new best is copied into `HIGH_SCORE_BCD`, 0x40a8) and from `drawScoreFieldByIndex`'s index-2 arm.

Kills feed the score through `awardKillScoreByBandAndDeactivate` [code]. It first deactivates the struck object (writing 0,1,0 into the record's first three bytes), then scores it by band: starting from a request parameter of 4, it compares the object's packed position/type field (record byte 7) against the threshold 0x50 in three passes, each miss bumping the parameter and dropping the field by 16, and the matched band posts a channel-3 score-add request immediately. If all three bands are exhausted it raises the inhibit/request word `loc_422b` (to 0xf001), folds in a neighbour bonus when the active-neighbour count `ACTIVE_NEIGHBOR_COUNT` (0x422a) is exactly two (recording the bonus at `loc_422d`), and posts the folded request.

A five-slot marker row (plausibly the reserve-ship/lives indicator) is `drawMarkerRow` [code]. It paints `markers` marker tiles (tile 102) growing upward from the five-slot row at `MARKER_ROW_VRAM` (0x539e), then blanks the remaining slots until its signed slot counter goes negative. When the object-active flag `OBJ_ACTIVE_FLAG` (0x4200) is set the displayed count is dropped by one, and if that empties it the whole row is blanked instead.

### The player-status columns

Each player has a small three-cell status column: `selectPlayerStatusVram` [code] returns its base -- `PLAYER1_STATUS_VRAM` (0x5340) for player one, else `PLAYER2_STATUS_VRAM` (0x50e0). `paintPlayerStatusColumn` [code] paints the column from a start cell stepping by a stride: the top cell gets the player code plus one, then two fixed tiles (0x25, 0x20). As a side effect, unless the caller's bit-4 "hide" flag is set and only while the mode gate `loc_4006` is zero, it clears the status flag `loc_40ab`.

`repaintPlayerStatusColumn` [code] wraps that for the current player: with bit 4 clear it paints the active player's column directly; with bit 4 set it blanks the active column's three cells (tile 16, stepping -32) and, only when the paired-player flag `loc_400e` is set, paints the other player's column too. That blanking-versus-painting on bit 4 is what makes the active player's indicator blink. Two guards sit in front of it: `repaintPlayerStatusColumnIfSaved` [code] repaints only when the saved status byte `loc_40ab` is nonzero, and `repaintPlayerStatusColumnFromModeGate` [seen] latches the mode -- when `loc_4006` is nonzero it saves that value into `loc_40ab` and repaints, and when `loc_4006` is zero it falls back to repainting only if `loc_40ab` was already set.

### The attract-mode screen fill

The attract screen is set up and periodically wiped by an animated tile fill. `drawInputTextColumnsAndSeedScreenFill` [seen] runs at attract/reset: it decodes three two-bit DIP fields -- bits 6-7 of `IN1` (0x6800), bits 0-1 of `IN2_PORT` (0x7000), and bit 2 of `IN2_PORT` -- into text-descriptor indices and paints each column (DIP-setting text columns), and then, unless bit 6 of `IN0` (0x6000) is asserted, seeds the fill state: it clears the mode gate `loc_4006`, sets the alternate-dispatch flag `loc_401a`=2, seeds the dwell pair `loc_4008`/`loc_4009` (0x10 / 0x30), rewinds `VRAM_WRITE_PTR` to `VRAM_BASE` (0x5000), clears the four-byte lamp/coin latch block, and silences the sound hardware.

`resetScreenFillState` [seen] is the same rewind on its own -- guarded by the same `IN0` bit-6 input gate, it resets `VRAM_WRITE_PTR` to `VRAM_BASE`, re-arms the fill length in `loc_4008` to a full page (32), clears `loc_401a`, and zeroes `GAME_STATE`. The fill itself is a two-part tile strip: `drawScreenFillStripFirstHalf` [code] stamps `count` two-tile pairs (tiles 48/50) forward from the VRAM cursor (two cells per pass, a count of zero wrapping to 256 pairs) and falls straight into `drawScreenFillStripSecondHalf` [code], which stamps sixteen more pairs (tiles 52/54), writes the advanced cursor back to `VRAM_WRITE_PTR`, and ticks the strip dwell `loc_4008`; on its expiry it calls `restartScreenFillOnDwellExpiry` [code]. That routine ticks the high dwell tier (the byte just past the pointer, i.e. `loc_4009`) and, when it is already zero or reaches zero on this tick, re-seeds the whole fill via `resetScreenFillState` -- so the attract wipe loops on its own dwell timing.

### A shared counter-reload helper

`reloadExpiredCounterAndTally` [seen] is a small primitive used by the sub-counter bank that paces delayed events. When one of a bank of countdown cells decrements to zero, this routine copies that cell's reload byte from the ROM table `SUBCOUNTER_RELOAD_TABLE` (0x15e3) back into it and bumps a running refill tally, which the caller uses to set the one-shot refill flag `SUBCOUNTER_REFILL_FLAG` (0x4228) whenever any counter was re-armed on the pass.

## Tile / VRAM drawing primitives and coordinate mapping

The tilemap lives at `VRAM_BASE` (0x5000): a grid whose cells are addressed so that adding 32 to a cell address moves one tile-row down and stepping the low address byte walks across the grid. Every drawing routine in this subsystem is ultimately expressed in those terms, and almost all of them are built on top of one two-byte stamp primitive.

### The elementary stamp and the double-height glyph

`stampTilePair` [code] is the atom. Handed a tile code, a destination cell, and a stride, it writes the tile at the destination and `tile+1` at the very next cell, then hands back an advanced state: the destination stepped forward by one (past the pair) plus the caller's stride, and the tile code stepped forward by two. Because the store is a byte write, a seed of 0xff lays down 0xff followed by 0x00. Everything that draws consecutive glyph pairs chains through this routine, feeding each call's advanced tile and pointer into the next.

`drawDoubleHeightTile` [code] is the other bottom-level writer. It paints a tall glyph as two stacked cells: the seed tile at the destination and `tile+2` one tilemap row (32 cells) directly below. It touches memory only and leaves the caller's other registers alone — the "second glyph in a top/bottom pair" is always the code plus two.

### Two-by-two blocks, downward and upward

`drawTileBlock2x2` [code] composes `stampTilePair` twice with a stride of 31. The stride is chosen so the pair's built-in +1 plus 31 lands exactly 32 cells on — one row down. So the first call lays the top pair (`tile`, `tile+1`) and the second lays the bottom pair (`tile+2`, `tile+3`) beneath it, forming a 2x2 block of four consecutive tile codes. It leaves DE untouched and returns the final advanced tile/pointer.

`drawTileBlock2x2Up` [code] is the mirror image that grows upward. Its stride is 65503, which is -33 as an unsigned 16-bit step: after the pair's +1 that nets one row *up*. Between the two pairs it steps the tile code back by four so the upper pair is coded lower than the pair below it, keeping the block's four codes in the same top-to-bottom order even though the pointer is moving the other way.

`drawBottomTilePairRestoreDe` [code] is the shared tail of the block-writer family. It stamps one more tile pair through `stampTilePair` using whatever tile, destination, and stride the caller has already staged, and then restores a DE value the caller had saved before the block began, handing it back. It is the "finish the second pair and give the caller its DE back" epilogue.

### Fixed-seed entry points

A small cluster of entry points exist only to preload a fixed glyph code and delegate. `drawFixedTilePairHorizontal` [code] seeds tile 44 (0x2c) into `stampTilePair` and returns the advanced tile/pointer so a caller loop can chain horizontal pairs of the 0x2c glyph family. `drawFixedTilePairVertical` [code] seeds that same code 44 into `drawDoubleHeightTile`, painting the tall two-cell version. `drawFixedTileBlock2x2` [code] seeds 44 into `drawTileBlock2x2`, laying the four-tile block 0x2c through 0x2f. `drawFixedTileBlock2x2Up` [code] seeds the decorative code 46 into `drawTileBlock2x2Up`, drawing that block growing upward — the form used to fill unused marker-row slots.

### Reaching a block through DE, a table, or a selector

`drawTileBlock2x2AtDe` [code] adapts the block writer for callers that carry the destination in DE rather than HL: it exchanges the two so the pointer that arrived in DE becomes the draw destination and the old HL is handed back in DE, then draws the 2x2 block from the seed tile. `drawIndexedTileBlock` [code] builds on that adapter — it reads a block's seed code out of `TILE_BLOCK_TABLE` (a ROM table at 0x215b) using an index, then stamps that block at the pending DE destination. `drawSelectedTileBlockOrFallback` [code] chooses between the two behaviours by the sign of its selector byte: a non-negative selector is treated as a table index and drawn through `drawIndexedTileBlock`; a negative selector instead stamps a fixed fallback block seeded with tile 0xa4 at the pending destination.

### Mapping a packed coordinate to a cell

`mapPackedCoordToVram` [code] turns one packed coordinate byte into a tilemap cell address by shuffling its nibble fields. The low nibble, rotated right by two, supplies both the address's high byte (its low two bits, giving a page 0..3 above `VRAM_BASE`) and the top two bits of the low byte. The high nibble becomes a three-bit field; that field is folded by taking a running sum of itself, its halved value, and the bit rotated out of it, complementing the result, and keeping the low nibble, which is then added to the low-byte seed. The final address is `VRAM_BASE` plus (high byte << 8) plus low byte. Three values survive for callers to branch on: the cell address itself, coordinate bits 6..5 in A, and — as a carry — coordinate bit 4, which is the low bit of the coordinate's high nibble.

`drawFixedTileFigureAtPackedCoord` [code] is the one routine that ties the coordinate mapper to the drawing primitives. It maps a packed coordinate to its cell and then, keying on that same bit 4 of the coordinate, either stamps a fixed 2x2 block (`drawFixedTileBlock2x2`) when the bit is set or a fixed vertical pair (`drawFixedTilePairVertical`) when it is clear — a display-list slot handler that plants one 0x2c-family figure at a computed location.

### Four-by-four blanks and indicator forms

`blankTileBlock4x4` [code] clears a fixed 4x4 region rooted at `loc_51da` (0x51da), writing four rows of four cells and stepping 32 cells between row starts. Note the blank code it uses is 0x40, distinct from the 0x10 (space) code the row and column blankers use elsewhere. `blank4x4AndDraw2x2Icon` [code] clears that 4x4 block and then overlays a 2x2 icon seeded with tile 96 at `loc_51fc` (0x51fc) — the "icon present" indicator form.

`draw4x4TileForm` [code] is the indicator draw handler that selects among these. Form 0 delegates to `blank4x4AndDraw2x2Icon`; form 1 simply blanks the 4x4 block; any higher form folds `form - 2` into the middle bits of a tile code — the shifted value complemented and masked, laid over a fixed high base of 0xc0 — and then tiles the full 4x4 region as four 2x2 blocks placed at the four corner cells `loc_51da` (0x51da), `loc_51dc` (0x51dc), `loc_521a` (0x521a), and `loc_521c` (0x521c). The seed advances four codes from one block to the next, so the four blocks carry consecutive block-code ranges.

### Column drawing and its periodic refresh

`drawTileColumnTriple` [code] copies three source bytes up a single VRAM column. Each source byte is written at the destination, whose low address byte then drops by 32 (one row up) while the high byte — the page — stays fixed, so the walk wraps entirely within one page. After the three writes the low byte advances by 98, which nets a two-cell move to the right (three rows up is -96, plus 98), lining up the next column. It returns the advanced source and destination so successive columns can be drawn from a continuous source stream without the caller recomputing anything.

`blankTileColumns` [code] does the same walk but stamping the blank code 0x10 rather than copying, over a run of columns beginning at `loc_5193` (0x5193). It writes three cells per column stepping one row up each time — here the row step is a full 16-bit subtraction, so it *borrows into the high byte* across rows rather than wrapping the low byte only — and then advances the low byte by 98 to the next column. The column count comes in as a loop counter, and because the countdown is a byte decrement, a count of zero wraps to 256 columns.

`redrawTileColumnsPeriodically` [code] is the driver that decides when either of the two column primitives fires. It reads `DRAWN_COLUMN_COUNT` (0x4241); fewer than two counted columns and it does nothing, otherwise it works one fewer than that. It then gates on the frame counter `loc_425f`: on the phase where its low six bits are zero it wipes the run with `blankTileColumns`; on the phase where they equal 32 it repaints. When repainting, the first column is drawn from a source row selected by the frame counter's top two bits — indexing three-byte rows within `TILE_COLUMN_TABLE` (0x039a) — into the VRAM start at `loc_5193`. Any remaining columns are drawn from the continuation source `TILE_COLUMN_TABLE_CONT` (0x03a6), each subsequent column threading its source and destination forward from the previous draw's returned pointers.

### Progressive screen fills tied to the sequence state machine

A group of routines advance a top-level sequence, keyed by `SEQUENCE_STATE` (0x400a), by clearing or filling VRAM a little each frame through the running cursor `VRAM_WRITE_PTR` (0x400b) and a pair of dwell counters `loc_4008` (0x4008) and `loc_4009` (0x4009).

`primeVramFillAndAdvanceStep` [seen] is the setup step. It clears the 128-byte flag block at `FLAG_BITS_BASE` (0x4100) and two status bytes at `loc_425f` (0x425f) and `loc_4224` (0x4224), points the write cursor two cells into the grid at `VRAM_BASE + 2`, arms the page/dwell counter `loc_4009` to 32, and bumps the sequence step.

`fillVramRowThenResetObjectState` [seen] runs one of the filling steps each frame: it paints a 28-cell strip of tile 16 at the cursor and steps the cursor a full 32-cell row on, then ticks the dwell tier `loc_4009`. While that is still counting it simply waits. On expiry it advances the sequence step, re-arms the two-tier dwell cascade (`loc_4008` to 64, `loc_4009` to 4), clears the 48-byte active-object block at `OBJ_ACTIVE_FLAG` (0x4200), clears the two screen-flip latches `FLIP_SCREEN_X` (0x7006) and `FLIP_SCREEN_Y` (0x7007) along with the direction flag `loc_4018` (0x4018), raises the status flag `loc_4238` (0x4238), and reseeds the object-shadow field from the ROM template `OBJ_SHADOW_RESEED_TEMPLATE` (0x1db1).

`blankVramRowThenResetSpriteState` [code] is the analogous state whose expiry resets the sprite side. Each tick it clears a strided table, blanks a 28-cell row of tile 16 at the cursor, and steps the cursor 32 cells on, ticking `loc_4009`. On expiry it advances the sequence, clears the object-source block at `SPRITE_SOURCE_OBJ_BASE` (0x42b0) — a fill whose count of zero means a full 256-byte wipe — and the 64-byte sprite shadow at `SPRITE_SHADOW_BASE` (0x4060), re-arms the same two-tier dwell, reseeds the object shadow, and queues command word 6.

`blankScreenRowsThenAdvanceSequence` [code] is the plainest of the family: it blanks 32 cells of tile 16 at the cursor, stores the advanced cursor back, and ticks the phase counter `loc_4009`. While phases remain it waits; on the last one it advances the sequence state and reseeds the object shadow. This is the progressive-clear step shared by both play-state sub-tables.

### Computing an animated tile variant

Two register-only routines pick a tile variant without touching memory. `computeTileVariantFromTimer` [code] folds a value toward a two-bit index: if the value is at or above 112 it saturates to the out-of-range marker 0x80 (the saturation itself snapping the value to 0x80), otherwise it swaps the nibbles of the status byte `loc_425f` (0x425f), adds the value and the carry input, and keeps the low two bits. `computeTileVariantFromValueAndTimer` [code] is the front end that supplies that carry from the frame counter: values at or above 112 again saturate to 0x80, otherwise it takes the value's low nibble and sets the carry input when the frame counter's own low nibble is *smaller* than that nibble, then folds through the timer routine. The carry it passes is 0 or 0xff, and because the fold simply adds it, a set carry contributes -1 to the two-bit result rather than +1 — the animation nudges the variant down by one when the counter's low nibble trails the value's.

### Integrating and rendering the moving-object projectiles

Three routines handle the seven moving-object records based at `loc_4260` (0x4260), and although they feed the sprite shadow rather than the tilemap they are the projectile rendering path. `advanceAndRenderProjectiles` [code] walks the seven records, each of which holds two five-byte sub-slots; the low bit of the phase byte `loc_425f` (0x425f) chooses which sub-slot leads this frame while the other's on-screen sub-position is bumped by two. For the leading, active sub-slot it advances the sub-position and deactivates the slot on overflow, integrates the 16-bit position by twice the sign-extended velocity, and deactivates the slot when the position leaves the vertical window; deactivation zeros the slot's active, sub-position, and high bytes. It then writes each object's Y and tile code into the sprite shadow starting at `loc_4081` (0x4081), mirroring the Y (and flipping the sign of a code nudge) according to the direction flag `loc_4018` (0x4018), with a +/-1 code nudge applied to the first three records.

`flagProjectileHitsOnPlayer` [code] is the collision sweep. When projectiles are enabled — the low bit of `OBJ_ACTIVE_FLAG` (0x4200) is set — it runs all 14 entries at base `loc_4260` with a stride of 5 through the per-entry test. Notably the same records `advanceAndRenderProjectiles` treats as seven ten-byte records are treated here as fourteen five-byte entries, so each rendered sub-slot is one collision candidate. The Y-band width passed to each test is that same stride value, 5, because the loop leaves the stride in the register the test reads — so the band is always 5, not whatever the caller held.

`flagProjectileHitOnPlayer` [code] is the box test for one entry. Inactive entries (low bit of the first byte clear) never hit. It reads the player-X reference `loc_4202` (0x4202) and forms the X delta to the entry, and shifts the entry's Y by 31. If that shifted Y falls in the far band it requires the X delta (with a two-unit bias) to sit within the band width; in the near band it first rejects entries whose Y is more than nine units off and then requires the X delta (biased by the band width) to be within 11. On an overlap it deactivates the struck entry by zeroing its first byte and raises `HIT_EVENT_FLAG` (0x4204) to 1, which the downstream player-hit handler consumes.

Finally, `loc_090b` is a deliberately unnamed pure-stack epilogue: it pops the caller's saved HL and returns, serving as the common exit of an enqueue path with no work-RAM effect of its own.

## Open questions

- The per-frame orchestration — the main loop and the top-level state dispatchers (the rst-28 handler and the
  jp(hl) dispatcher that select the sequence, formation, combat, and sound handlers each frame) — is translated
  but not yet idiomatically decompiled, so the way the handlers above are scheduled is inferred from the leaves
  they call, not yet read directly. Those dispatchers are the next spine to lift, and are what most of the
  remaining translated routines are reached through.
- Many handlers stay `[code]` because their state was not reached by the attract + coin/one-player captures (a
  deep formation/dive state, a later board), or because their only side effect lands in VRAM or a hardware latch
  the work-RAM tap cannot see; a deeper poke-cycle / video-visible capture is owed to lift them.
- Many work-RAM cells are still named `loc_<addr>`: their role is understood from the routines that touch them
  (described above) but a descriptive identifier is deferred to the cleanup phase rather than promoted piecemeal.
- A further tier of routines remains translated (not yet decompiled); the map grows to cover them as the spiral
  climbs. The most recently decompiled leaves are correct-by-equivalence but still carry `loc_<addr>` names and
  `[code]` certs pending their own understanding pass (blind naming + MAME grounding), which folds them into the
  sections above; until then this map covers the named routines and those leaves are not yet narrated.
