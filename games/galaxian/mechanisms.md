# Galaxian — mechanism map

A code-grounded model of how Galaxian plays, derived from the idiomatic + frozen-oracle routine bodies and
confirmed against the real ROM under MAME. This is a **living** document: it is regenerated whole as the
idiomatic decompile spiral climbs, and currently covers the **leaf helpers** lifted in decompile batches 1–7.
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

Beneath the game logic sit a handful of tiny service routines that the rest of the machine leans on constantly: a pseudo-random generator, a block memory fill, an indexed table lookup, and the per-frame interrupt housekeeping. Each is only a few instructions long, but their behaviour shapes everything above them.

### The pseudo-random generator

Randomness in Galaxian comes from a single byte of work RAM, `RNG_SEED` at 0x401e, driven by `advanceRandomSeed` [seen]. Each call reads the current seed, computes `seed*5 + 1` truncated to eight bits, writes that back over the old value, and hands the same new byte to the caller as this draw's random number. It is a classic linear-congruential generator with multiplier 5, increment 1, and a 256-value period — deterministic, but with no repeated value returned twice as its own output. The important structural fact is that the routine has no separate "output": the value it returns *is* the new seed, so every draw permanently advances the shared state. There is no way to peek without stepping.

Callers slice the returned byte to taste. `reseedFormationObjectState` takes the whole byte as a fresh vertical position when it re-rolls a formation object's Y coordinate. `chooseNextAttackerDirection` keeps only the low bit, using it as a coin flip to pick which way a new attacker launches or curves. `computeControlledObjectMoveCommand` folds it into a small random ±1 nudge on a controlled object's motion. Because all three share the one seed cell, the sequence any of them sees is interleaved with every other consumer's draws — the "randomness" of an attacker's dive and the jitter of a formation object are cut from the same advancing thread.

### Block memory fill

`fillMemoryBlock` [code] is the machine's memset. Given a destination pointer, a fill value, and a count, it writes the value into consecutive bytes, walking the pointer forward, until the count is exhausted. The count is decremented as a byte, so the loop tests for zero *after* the first store — which means a count of 0 does not fill nothing, it wraps around and fills a full 256-byte page. This is not an accident of the encoding; callers rely on it. `resetObjectRamAndAdvanceSequence`, for instance, clears a 256-byte span by passing the "full page" count deliberately, alongside smaller fixed-size clears of the sprite shadow area and an 80-byte tail. When the routine finishes it leaves the pointer resting just past the filled region and the count spent at zero, so a caller can chain a second fill immediately after the first without recomputing the address. The same primitive services both work-RAM zeroing (object records, flag blocks, lamp state) and VRAM tile-map clears where the destination pointer aims at video memory rather than plain RAM.

The machine reaches this routine through the Z80 RST 10 restart, so a fill is a single one-byte instruction at the call site with the operands pre-loaded into the pointer, value, and count registers.

### Indexed table fetch

`fetchIndexedTableByte` [code] is the companion lookup primitive, entered via the RST 20 restart. It takes a table base pointer and an 8-bit index, adds the index to the pointer *with carry propagated into the high byte*, and reads the byte at the resulting address. The carry handling matters: it means a table may straddle a 256-byte page boundary and an index near the top still lands correctly, rather than wrapping back to the start of the page. The routine returns the fetched byte and also leaves the advanced pointer behind, so a caller that wants both the value and its address gets them from one call. The tile-drawing code is the heaviest user: `drawTileGlyphOrBlock` looks a glyph up in a table at 0x2157 by character index, and `drawIndexedTileBlock` indexes `TILE_BLOCK_TABLE` the same way, while the boot handler `fillScreenThenLatchConfigAndAdvanceState` uses it to pull a coinage byte out of a configuration table.

### The vblank interrupt and its epilogue

Once per frame the display's vertical-blank line raises an interrupt. The handler that runs saves its working registers, does its per-frame work, and then must do two pieces of housekeeping before handing control back to the interrupted main loop: restore those registers and re-arm the interrupt for the *next* frame. That closing housekeeping lives in `rearmVblankInterruptAndRestoreRegs` [code].

The re-arming is the load-bearing half. When the interrupt is taken, the handler clears the interrupt-enable latch `IRQ_ENABLE` at 0x7001 to acknowledge the current interrupt; if nothing wrote it back, the hardware would never assert another one and the entire per-frame loop would freeze after a single frame. This epilogue writes 1 into 0x7001 to switch the vblank interrupt back on, guaranteeing the next frame fires. Around that single store it restores the six register pairs (IY, IX, HL, DE, BC, and finally AF) that the interrupt prologue saved on entry, popping them in the reverse of the order they were saved so each pair lands back in its own register — and note the AF restore comes *after* the re-arm write, so the caller's accumulator is not left holding the 1 that was written to the latch. Finally it returns through the address the interrupt suspended, resuming the main loop exactly where it left off. This is the single convergence point of the frame interrupt: whichever way the per-frame work was dispatched, it exits through this routine, which is why the re-arm only needs to exist in one place.

### A shared stack epilogue

Finally, `loc_090b` [code] is a deliberately unnamed two-instruction tail: it restores HL from the stack and returns, touching no RAM. It is the common exit of the command-queue enqueue path — `commitQueueWriteHead`, after writing the advanced queue write-head index back, ends by falling into this epilogue to undo the HL that the enqueue entry had stashed. It carries no logic of its own; it exists only so several code paths can share one clean-up-and-return.

## The attract / sequence state machine, dwell timers, credit transition, boot config, and playfield init

Everything in this subsystem hangs off two nested state indices that a once-per-frame handler walks. A top-level *game-state* byte, GAME_STATE (0x4005), selects which of five major phases the machine is in; within a phase, a *sequence-state* byte, SEQUENCE_STATE (0x400a), selects a sub-step. The per-frame handler reads GAME_STATE and jumps through a five-entry table to the phase handler for the current value: state 0 is the power-up screen-clear/config phase, state 1 the attract sequence, state 2 the coin/ready phase that watches the start buttons, state 3 the main play sequence, and state 4 an alternate play sequence that resumes from a saved snapshot. The play-phase handlers in turn read SEQUENCE_STATE and jump through their own eight-entry tables to a sub-step handler. Almost every routine below is one cell of one of those tables, or a shared primitive several of them lean on.

### Power-up: filling the screen and latching the cabinet config

At power-up GAME_STATE is 0, so each frame runs fillScreenThenLatchConfigAndAdvanceState [seen]. It is a slow, incremental boot: every frame it blanks a 32-byte run of tilemap starting at the cursor VRAM_WRITE_PTR (0x400b) with the blank tile and pushes the cursor forward 32, sweeping across the whole tile grid from VRAM_BASE (0x5000) over many frames while a per-phase timer at loc_4008 counts down. When that timer finally reaches zero the machine commits to running: it resets the state cluster (loc_4007 = 1, the mode/sound flag loc_4006 = 0, GAME_STATE = 1, SEQUENCE_STATE = 0), and it latches the cabinet's DIP/input configuration out of the input shadows into persistent cells — two lives/difficulty bits from IN1_SHADOW's top into loc_4000, one bit from IN2_SHADOW into loc_401f, one bit from IN0_SHADOW into the flip flag loc_400f, and a coinage byte chosen from a four-entry table (loc_0152) by the low two bits of IN2_PORT (0x7000) into loc_40ac. It then unpacks a packed flag bitmask, seeds the object shadow from ROM, writes the first three player-1 status glyphs (PLAYER1_STATUS_VRAM 0x5340, loc_5320, loc_5300), and appends two deferred command words (loc_0604, loc_0503) to the command queue. Setting GAME_STATE to 1 hands control to the attract sequence on the following frame.

### The dwell-timer cascade — the machine's clockwork

The sequence steps advance themselves on a small, reused three-tier countdown. Its bottom primitive is tickCascadeCountdown [seen]: it decrements the byte a caller points it at; while that byte is still nonzero it does nothing more, but on the frame it hits zero it steps to the very next byte in the same page and increments *that*. Point it at the dwell tier loc_4009 and its carry lands in SEQUENCE_STATE (0x400a) — so "the dwell timer ran out" and "advance to the next sub-step" are literally the same carry. tickSequenceDwellTimer [code] is the thin wrapper that points the primitive at loc_4009 each frame, giving a plain "sit here until the dwell expires, then step" state. tickPrescaledSequenceTimer [seen] prepends one more tier: it first decrements a prescaler at loc_4008, and only when *that* wraps does it reload the prescaler to 60 and tick the loc_4009 dwell — a slower dwell for the longer attract holds. So loc_4008 (prescaler) feeds loc_4009 (dwell) feeds SEQUENCE_STATE (state), a genuine cascade rather than three independent timers.

Several routines seed or re-arm that cascade. reloadSequenceDwellTimer [code] simply stamps loc_4009 back to 80 frames. advanceSubstateAndReloadDwell [code] does the explicit two-step an expiring handler wants without waiting for the carry: bump the sub-state counter it is handed (its callers hand it SEQUENCE_STATE) and re-arm loc_4009 through reloadSequenceDwellTimer. setSequenceStateByModeAndReloadDwell [code] is the branching variant — it jumps the sub-state counter to a fixed 4 when the mode flag loc_4006 bit0 is set, or to 14 when it is clear, then re-arms the dwell; this is how a handler skips the sequence forward to one of two scripted continuations depending on mode. enterSequenceStep1 [code] is the loop-back: it forces SEQUENCE_STATE back to 1 and re-seeds both timer tiers to 3 (loc_4008 = 3, loc_4009 = 3), a short dwell that restarts the attract cycle from its beginning. armStepCountdownAndTickSequenceTimer [seen] is a sub-step that arms a one-shot countdown flag loc_4019 = 1 and then runs the prescaled tick; the flag it arms is spent elsewhere to drive its own advance.

### The attract sequence (game-state 1)

With GAME_STATE at 1, each frame walks the attract sub-steps by SEQUENCE_STATE. Sub-step 0 is initSequenceEnableStarfield [seen]: it queues two setup command words (a channel-7 and a channel-6 word), turns the starfield on via STARS_ENABLE (0x7004), sets loc_4007, clears the per-sequence work cells (CURRENT_PLAYER 0x400d, the paired-player flag loc_400e, the mode flag loc_4006, the countdown flag loc_4019), seeds the dwell cascade to a long hold (loc_4008 = 96, loc_4009 = 16), and advances SEQUENCE_STATE. From there the attract script is a chain of scripted steps — drawing title text, running the demo, and so on — separated by the generic dwell states above (tickSequenceDwellTimer, tickPrescaledSequenceTimer, armStepCountdownAndTickSequenceTimer), each holding its slot for a scripted number of frames and then letting the cascade carry the index onward. When the chain reaches enterSequenceStep1 the whole thing snaps back to step 1 and repeats, so the attract loop cycles indefinitely until a coin and a start button move the machine on.

### The credit transition and round launch (game-state 2 → 3/4)

Game-state 2 is where the machine waits with credits showing and polls the start buttons; every frame it ends by running beginGameOnStartButton [code]. That routine reads the debounced start input IN1_SHADOW (0x4011): bit 0 (one-player start) tails straight into startOnePlayerGame [code]; otherwise bit 1 (two-player start) must be set or nothing happens, and it must find at least two credits in the credit count loc_4002, which it spends two of. It then blits the 32-byte ROM row template loc_051b into the saved-state snapshot SAVED_STATE_SNAPSHOT (0x41a0) — pre-loading the second player's board — and, when the config bit loc_401f bit0 is set, arms the state-advance gate through armStateAdvanceGate [code], before entering the shared round start with a two-player spawn word of 0x0100. startOnePlayerGame is the one-player mirror: with no credits it just forces GAME_STATE back to 1, otherwise it spends a single credit, zeroes the snapshot at 0x41a0, and enters the shared round start with a spawn word of 0.

The shared round start (startGameRoundAndClearScores) writes that 16-bit spawn word across CURRENT_PLAYER (0x400d) and the paired-player flag loc_400e — so a one-player launch leaves loc_400e clear and a two-player launch sets it — blits the ROM row template loc_051b into the packed flag bitmap PACKED_FLAG_BITMAP (0x4180), and, again on config loc_401f bit0, arms the *sub*-state advance gate through armSubstateAdvanceGate [seen]. It then commits the machine to play: SEQUENCE_STATE = 0, GAME_STATE = 3, the mode/sound flag loc_4006 = 1, loc_41d1 = 1, and three spawn command words queued. The two gates matter later: armStateAdvanceGate stamps the marker 3 into loc_41b5 and armSubstateAdvanceGate stamps 3 into loc_4195, and those two cells are exactly what the sub-state-6 handlers read to decide whether to keep advancing. So a single cabinet config bit (loc_401f bit0) pre-arms the play sequence to march itself forward.

### Playfield init and the play sequence (game-states 3 and 4)

Both play phases share sub-step 0, initPlayfieldState [code]. It turns both start lamps off (START_LAMP_0/1 at 0x6000/0x6001), zero-fills the object/flag work-RAM — 128 bytes from FLAG_BITS_BASE (0x4100), a span from OBJ_ACTIVE_FLAG (0x4200), the template/prescaler block at loc_4218, and a long run from loc_4260 — clears the status cell loc_425f, sets the activity-gate flag loc_4226 = 1, advances SEQUENCE_STATE, arms a 32-frame dwell on loc_4009, and re-points the fill cursor VRAM_WRITE_PTR at VRAM_BASE (0x5000). It is the clean slate every board begins from.

Sub-step 2 is where the two play phases diverge. In game-state 3 it is restoreFormationAndEnterPlaySubstate [seen], a fresh board start: it expands the packed bitmap PACKED_FLAG_BITMAP (0x4180) into the flag grid, copies the trailing 8-byte template into loc_4218, clears the status/direction cells (loc_425f, loc_4220, loc_4018) and the screen-flip latches (FLIP_SCREEN_X/Y at 0x7006/0x7007), advances SEQUENCE_STATE, arms a 150-frame dwell on loc_4009, and publishes a deferred callback pointer (loc_0640) into loc_4245. Then, only when the sound gate loc_4006 bit0 is open, it cues the board-start sound — the paired-player burst via queueBoardStartSoundBurst when the paired-player flag loc_400e bit0 is set, otherwise a plain channel-5 prologue word plus the standard burst. In game-state 4 the same slot is restoreSavedStateAndEnterPlaySubstate [code], the resume variant: it expands the *saved* snapshot SAVED_STATE_SNAPSHOT (0x41a0) instead, copies its trailing template into loc_4218, and — rather than clearing the flip latches — mirrors the saved flip flag loc_400f into loc_4018 and FLIP_SCREEN_X/Y when it is set, then advances, arms the same 150-frame dwell, publishes a different callback pointer (loc_0830) into loc_4245, and enqueues five intro command words when the sound gate is open. This is the pair that makes two-player alternation work: one player's board is packed in the ROM-seeded 0x4180 path, the other is preserved and restored through the 0x41a0 snapshot.

Sub-step 3 of both play phases is advanceSubstateAfterDwellAndQueue [code]: tick loc_4009, and on its zero-cross reload it to 20, advance SEQUENCE_STATE, and enqueue this state's command word (loc_0682) — a short timed pause between the board-intro steps.

The interesting fork is sub-step 6, the end-of-round decision. stepPlaySubstate6 [code] (game-state 3) reads an arm gate loc_421d first. When that gate is set, it advances the sub-state and reloads the dwell only if *both* the state-advance gate loc_41b5 and the paired-player flag loc_400e are set, otherwise it jumps the sequence to state 4-or-14 by mode via setSequenceStateByModeAndReloadDwell. When the arm gate is clear it takes the shared tail advanceDwellOrResetToState1 if either loc_41b5 or loc_400e is clear; only when both are set does it advance inline, arm a 130-frame dwell on loc_4009, and — when the mode flag loc_4006 bit0 is set — queue two channel-6 command words. stepAltPlaySubstate6 [code] (game-state 4) is the mirror keyed on the *sub*-state advance gate loc_4195 instead of loc_41b5, arming 80 frames on the gated-delegate arm and 130 on the default advance, again queuing two channel-6 words when the sound mode is on. Both funnel into advanceDwellOrResetToState1 [code], the shared teardown/continue tail: when the mode flag loc_4006 bit0 is clear it just advances the sub-state and reloads the dwell (advanceSubstateAndReloadDwell), but when it is set it tears the round down — GAME_STATE back to 1 (attract), loc_4006 and SEQUENCE_STATE cleared, the sound hardware and interrupt/starfield silenced, and command word 6 queued — so a completed round drops the machine back into the attract loop this subsystem opened with.

### The command queue

All of the "queue a command word" calls above feed one small ring. enqueueCommandWord [seen] takes a 16-bit word and the write-head index at loc_40a0; the head addresses a slot in the 0x40c0–0x40ff window of the work-RAM page. It only writes when that slot is free (its high bit set): it stores the word's high byte at the slot and low byte at the next, advances the head by two, and clamps the head up to its 0xc0 floor (so it wraps within the window rather than escaping the page). commitQueueWriteHead [seen] is the step that persists that advanced head back to loc_40a0 when the append succeeds. Two convenience callers sit on top: enqueueCommandWordBurst [code] posts a fixed five-word sound burst — three words carrying the caller's channel (two on the next channel up) then two on channel 7, each word formed as (channel << 8) | param — and queueBoardStartSoundBurst [code] prepends a channel-5, param-3 prologue word and then fires that same burst on channel 5, which is the board/level-start cue the paired-player play-start path uses. loc_090b [code] is a deliberately unnamed, pure-stack epilogue shared by the enqueue path: it restores the caller's saved pointer and returns, touching no work RAM.

### The per-frame play pipeline: gates and delayed-event timers

Play sub-step 5 is a long per-frame update pass that runs the gameplay subsystems in order; six of its calls belong here as the machine's gating and delayed-event clockwork. clearGateOnPendingRequest [code] watches a request flag loc_420b: when its bit 0 is pending it acknowledges the request (clears loc_420b) and clears the behavior gate loc_4208 that the formation logic tests. armBehaviorGateOnInputOrTimer [code] is the counterpart that *raises* loc_4208: it does nothing unless the enable flag OBJ_ACTIVE_FLAG (0x4200) bit0 is set and the gate is not already armed, then, on the timer path (loc_4006 bit0 clear), it arms the gate only when the low five bits of the status counter loc_425f are all zero — roughly once every 32 frames — while on the input path (loc_4006 bit0 set) it tests bit 4 of the selected input shadow (IN0_SHADOW or IN1_SHADOW, chosen by loc_4018) after masking off that line's guard byte (loc_4013/loc_4014), and when a line reads active it arms both the gate loc_4208 and its companion flag loc_41cc.

rampCounterToCeiling [code] is a slow difficulty ramp: gated by OBJ_ACTIVE_FLAG bit0 set and the inhibit flag loc_422b bit0 clear, it runs a two-tier prescaler (outer loc_4218 reloading to 60, inner loc_4219 to 20), and each time both wrap it nudges the 0..7 pace counter loc_421a up by one, clamped at its ceiling of 7 — a counter that climbs over play, not a fixed base. scheduleDelayedEvent [code] and fireDelayedEventRequest [code] are an arm/fire pair. scheduleDelayedEvent, guarded by OBJ_ACTIVE_FLAG and loc_41ef both set and loc_422b clear, runs its own two-tier timer (outer loc_4245 reload 60, inner loc_4246); on the plain path (loc_4006 bit0 clear) a full cascade elapse simply arms the fixed triple — DELAYED_EVENT_TIMER (0x422f) = 90, loc_424a = 45, DELAYED_EVENT_ARMED (0x422e) = 1 — while on the mode-set path it derives the delay from the byte-sums of loc_4177 and loc_421a (or a fixed 2 when loc_4221 bit0 is set), fans the derived value into the timer triple by bit-rotations, and marks it armed. fireDelayedEventRequest is the one-shot that spends it: while DELAYED_EVENT_ARMED bit0 is set it counts DELAYED_EVENT_TIMER down each frame, and on the frame it reaches zero it disarms and — only if OBJ_ACTIVE_FLAG and loc_41ef are both still set — raises DELAYED_EVENT_REQUEST (0x4229). Finally expireActivityGatedTimer [code] ends an activity-gated phase: while its arm flag loc_422b bit0 is set *and* at least one activity gate is open (loc_4224 nonzero, or loc_4221 nonzero, or loc_4226 bit0 set) it ticks the counter loc_422c, and clears the arm flag once that counter reaches zero.

One shared utility rounds out the set. markValueOutOfRange [code] is the saturation arm of a value clamp used by the scaling helpers: when a clamp's input falls outside its range this snaps the fold index register to the fixed 0x80 sentinel, so an out-of-range value collapses to a known extreme rather than wrapping.

## The object / formation field: records, motion planning, sweep, occupancy, spawn/launch

### The formation as a bit grid, and its two forms

The standing alien formation lives as a grid of one byte per cell at FLAG_BITS_BASE (0x4100): bit 0 of each byte says "an alien occupies this cell." A cell is addressed by packing its row into the high nibble and its column into the low nibble, so a full formation occupies 128 flag bytes. Because that is bulky to ship and to snapshot, the machine keeps the same information in a compact 16-byte packed bitmask as well, and two mirror routines convert between the forms. unpackBitmaskToFlagBytes [seen] walks 16 mask bytes and explodes each, LSB-first, into eight flag bytes at 0x4100, writing 1 for a set bit and 0 for a clear one; it hands back its source pointer advanced past the 16 bytes so a caller can read whatever data follows the mask. packFlagBytesToBitmask [code] is the exact inverse: it reads bit 0 of the 128 flag bytes and repacks them, LSB-first, into a 16-byte bitmap at a destination pointer, returning that pointer advanced by 16 so the result can be chained straight into a block copy. Every formation build and every saved-state snapshot rides on this pair.

### Seeding the field at screen/formation init

Object records also have a shadow field seeded from ROM. seedObjectRamShadowField [seen] copies 32 bytes from a source into every other cell of the object-RAM shadow based at loc_4021 (0x4021, 0x4023, … 0x405f) — a stride-2 interleave laying one field of the 32-entry shadow. seedObjectShadowFromRom [seen] is the fixed-source entry: it points that copier at the ROM template STRIDED_TABLE_SRC (0x1d71) and runs it. advanceSequenceStateAndReseedObjectShadow [code] wraps the reseed with a state bump — it advances a pointer's low byte within its page and increments the byte that low byte now names (both callers arrive pointing at loc_4009, so the increment lands on SEQUENCE_STATE, 0x400a) — then falls into the same object-shadow reseed.

The top-level sequence state machine drives formation setup through several handlers. clearFlagBlockAndReseedObjectShadow [code] is the reset step: it zero-fills the entire 128-byte flag block at 0x4100, clears the status cells loc_425f and loc_4238, arms a mid-tier dwell of 64 in loc_4009, then advances SEQUENCE_STATE and reseeds the object shadow through the routine above. loadDescriptorAndAdvanceSequence [code] is the build step: it unpacks a packed descriptor bitmask from ROM (loc_051b) into the 0x4100 flag block, copies the eight template bytes that follow the mask into the template buffer loc_4218, clears loc_425f, sets loc_421d to 1, bumps SEQUENCE_STATE, stamps 150 into VRAM_WRITE_PTR (0x400b), and publishes a deferred-callback pointer (loc_0640) into loc_4245.

Two terminal handlers close a setup pass by freezing the current field and handing off to the next game phase. packFlagsToBitmapAndSwitchPlayerState [code] ticks the dwell timer loc_4009 each pass and does nothing until it reaches zero; on that tick it clears SEQUENCE_STATE, loc_4222 and loc_422b, packs the flag grid into PACKED_FLAG_BITMAP (0x4180), copies the eight-byte template from loc_4218 immediately after it, and sets CURRENT_PLAYER (0x400d) to 1 and GAME_STATE (0x4005) to 4. saveFlagsToSnapshotAndSwitchPlayerState [code] is its mirror: the same dwell gate, but on expiry it clears SEQUENCE_STATE, sets CURRENT_PLAYER to 0 and GAME_STATE to 3, snapshots the flag grid into SAVED_STATE_SNAPSHOT (0x41a0), and copies the companion eight-byte block after it. The two differ only in destination and in which player/state they leave behind — one banks the live field for a player handover, the other preserves it as a restart snapshot.

### Side-to-side sway: the sweep oscillator

Every frame the whole formation slides across the screen. The motion is carried by a swept 16-bit word at loc_420e — the moving formation anchor — steered by the direction flag OBJ_SWEEP_DIRECTION (0x420d). advanceFormationSweepOscillator [seen] is the driver. It first checks a proximity gate: if the player's shot is armed (loc_4208), lies within the narrow window around the swept column (loc_4209), and that column reads occupied in COLUMN_OCCUPANCY, it shortcuts straight to rebroadcasting the sweep offset and returns. Otherwise it reads the bound pair from FORMATION_X_BOUNDS (0x4210) and steps the word one unit toward the current bound, but only one frame in four (throttled by the low two bits of loc_425f). While the flag is clear it ascends until the low byte reaches the from-right bound, at which point setSweepDescending [seen] writes 1 into OBJ_SWEEP_DIRECTION to reverse; while set it descends until the word runs negative past the from-left bound, at which point setSweepAscending [seen] clears the flag back to 0. After each accepted step it broadcasts the negated low byte of the swept word across a per-column offset table.

That per-column table sits at loc_4028 — nine cells at stride 2 (0x4028, 0x402a, … 0x4038). broadcastToStridedTable [seen] fills all nine with a given byte; clearStridedTable [seen] is the per-state reset that broadcasts 0 across it; broadcastNegatedSweepToStridedTable [seen] broadcasts the two's-complement of a low byte, so every column carries the negated sweep offset; and broadcastNegatedFormationSweepToStridedTable [code] is the convenience that reads the swept word loc_420e and tail-calls the negating broadcaster. positionObjectFromGridCell [code] is where the sweep becomes visible motion: it unpacks an object's packed grid cell (record+7) into its sprite position fields under the convention the sprite renderer reads — the row bits (cell & 0x70) drive the X field record+3 as 124 minus three-quarters of the row, and the column bits (cell & 0x0f) drive the Y field record+4 as the swept anchor loc_420e plus the column times sixteen plus a seven-pixel hotspot. Because the display axes are rotated ninety degrees from the formation grid, the anchor's sway shifts the whole formation bodily along the screen's Y axis.

### Occupancy summaries and the region-clear gates

summarizeFormationOccupancy [seen] runs each frame alongside the oscillator and reduces the live field into the summaries the rest of the machine consults. From the occupancy grid OCCUPANCY_GRID (0x4123) — the six-row-by-ten-column live region of the flag grid, read at a sixteen-byte row stride — it computes a per-row OR into ROW_OCCUPANCY (0x41e8, behind two guard cells) and a per-column OR into COLUMN_OCCUPANCY (0x41f0, behind three guards). It then derives the sweep bounds: scanning inward from the rightmost occupied column and from the leftmost, it forms a from-right and a from-left bound and stores them as the pair in FORMATION_X_BOUNDS (0x4210) that the oscillator turns around on. Finally it folds four region "clear" flags by XOR-ing the any-occupied bit with 1, so each flag reads 1 exactly when its region is empty: loc_4221 from the top four rows, loc_4220 from all six rows, loc_4226 from seven object-table slots, and loc_4225 from those plus eight more. loc_4220 in particular is the "formation fully cleared" signal the launch, pacing and spawn logic all gate on.

### Staging the formation to sprites

stageObjectsToSpriteShadow [seen] is the per-frame bridge from object records to hardware sprites. It renders eight consecutive object records from SPRITE_SOURCE_OBJ_BASE (0x42b0, 32-byte stride) into eight consecutive sprite-shadow records at SPRITE_SHADOW_BASE (0x4060, 4-byte stride), as a band of three followed by a band of five, at a Y offset selected by bit 0 of loc_4018 (9 or 7 for the first band, with both orientations settling the tail band at 8).

### Player shots against the field

flagPlayerShotHitOnFormation [code] runs in the per-frame pipeline and registers a player shot destroying a formation alien. While the shot gate loc_4208 is armed, it bands the shot's Y position (loc_4209) into a formation row — stepping down seven-then-five pixels per row and rejecting the gaps between rows — and bands the shot's X delta against the anchor (loc_420a minus loc_420e) into a column, rejecting anything outside the hit window. It composes those into a flag-grid index (row in the high nibble, column in the low), and if that cell at 0x4100 holds a live alien it clears it, stamps a hit record (loc_420b, loc_42b1, loc_42b2, and the shot's position word into loc_42b3), and posts two tagged event words for the kill — one keyed by the grid index, one carrying a column code derived from it — into the machine's pending-event queue that later stages drain for scoring and sound.

### Pacing and launching divers out of the formation

Attackers peel off the standing formation on a difficulty-scaled clock. paceEnemyLaunchTrigger [code] is that prescaler. It runs only while the play flag OBJ_ACTIVE_FLAG (0x4200) is set and both inhibits (loc_4220, loc_422b) are clear; it ticks a master counter loc_424a and, until that expires, holds the trigger SUBCOUNTER_REFILL_FLAG (0x4228) low. On expiry it reloads the master from SUBCOUNTER_RELOAD_TABLE (0x15e3) and sweeps a span of attacker sub-counters — the span widening with the pace counter loc_421a and the clamped stage loc_421b — decrementing each, refilling any that reach zero from the matching reload-table entry, and raising SUBCOUNTER_REFILL_FLAG if any refilled.

launchAttackerFromFormation [code] consumes that one-shot. When SUBCOUNTER_REFILL_FLAG is raised it clears it and — provided the region-clear gate loc_4220 is not set — derives a one-to-four slot budget from the pace counter (loc_421a + loc_421b), then claims the first empty object slot (both header bytes zero) scanning downward from loc_4391. It stamps the launch direction loc_4215 into the slot, uses that direction to pick a scan orientation over COLUMN_OCCUPANCY for an occupied column (the geometry of the grid walk further steered by loc_41ef), then walks that column of the flag grid at 0x4100 for a filled cell. On a hit it clears the cell (the alien leaves the formation), writes the slot active with a cleared sub-state, and posts a type-1 spawn event — launching one new diving attacker per firing of the pace clock.

### Object AI: per-object state handlers

Each live object is driven by a per-slot handler chosen on the object's sub-state (record+2) through a sixteen-entry state table; three of those slots belong here. Slot 0, initSpawnedObjectFromGridCell [code], is first-tick setup for a freshly launched attacker: it clears the step timer (record+23), raises the spawn flag loc_41c2, positions the sprite from the packed cell via positionObjectFromGridCell, and posts a type-1 spawn word. It looks up the object's sprite number and flight-curve seed from SPAWN_RECORD_TABLE (0x1dd1) indexed by the cell's row bits; on the top row it also tallies the two following slots' active flags into ACTIVE_NEIGHBOR_COUNT (0x422a). Then it seeds the motion counters, advances the sub-state, and sets a signed heading (±12) from the direction bit.

Slot 6, settleObjectIntoFormationCell [code], returns a diver into the formation: it repositions from the grid cell, bumps the object's frame counter, and when the counter catches the positioned value it deactivates the object, sets its cell's flag at 0x4100 back to 1 (the alien rejoins the field), and posts a command word for it; a small even gap nudges the phase by the direction bit, while a large or odd gap is left alone. Slot 5, reseedFormationObjectState [code], re-inits a formation object each pass: it resets X to the left edge, zeroes the heading, ticks the record's counter at +23, and — when enabled (OBJ_ACTIVE_FLAG) and an activity gate is open (loc_4224 or loc_4221) — rolls a fresh random Y, arms a hold timer, and advances the state. On the special grid-cell value (record+7 high bits all set) it recounts the two look-ahead neighbours into ACTIVE_NEIGHBOR_COUNT and, once none remain, deactivates the object and ramps the phase counter loc_421e toward its ceiling of 2.

Two small helpers serve this machinery. positionObjectFromGridCell, described earlier, is shared by all three slot handlers. bumpCountIfNeighborsInactive [code] folds a conditional +1 into a running count: it peeks the two look-ahead object slots (record+32 and record+64) and bumps the count only when both are inactive, and it is called from the neighbour-accounting path when the active-neighbour tally reads exactly 2, to credit a fully-cleared neighbourhood. And noopAnimDispatchSlot [code] is simply the do-nothing terminal (sub-state 3) of the object-animation dispatch table at 0x10e8, present so that table always has a valid target.

### Descriptor slots and the spawn tree

Secondary objects are drawn from a four-slot descriptor pool at DESCRIPTOR_SLOT_TABLE (0x4330, 32-byte slots). activateDescriptorSlot [seen] initialises one slot chosen by the number at a pointer (index = number − 1): it stamps [0]=1 (active), [1]=0, [2]=13, [4]=0, [5]=12, and [7]=index, leaving [3] and [6] untouched.

The spawn tree fans out from a single per-frame dispatcher. spawnObjectsOnDelayedEvent [code] runs in the update pipeline gated on the region-clear flag loc_4220 being clear, OBJ_ACTIVE_FLAG set, and a pending DELAYED_EVENT_REQUEST (0x4229) — which it consumes as a one-shot — and only while the OBJ_TABLE (0x42d0) head word is even. When armed it routes by the low bit of the launch direction loc_4215: a set bit takes the full trigger-block path spawnObjectsFromTriggerFlags [code]; a clear bit scans the primary trigger block PRIMARY_TRIGGER_BLOCK (0x4176) high-to-low and, on a set flag, hands off to spawnPrimaryAndSecondaryObjects [code], then falls to the secondary window via spawnIntoFreeDescriptorSlot [code].

spawnObjectsFromTriggerFlags scans the four primary flags at 0x4176: the first set flag spawns a primary into OBJ_TABLE and then walks the secondary block SECONDARY_TRIGGER_BLOCK (0x4165) spawning up to two secondaries; if no primary flag is set it scans the secondary block and seeds a free descriptor slot on the first hit. spawnPrimaryAndSecondaryObjects spawns a primary into 0x42d0, then walks three trigger flags backed up fifteen from the primary trigger's low byte, spawning a secondary into each successive slot (from 0x42f0) until a budget of two is spent. spawnIntoFreeDescriptorSlot is the shared free-slot finder: it scans the four descriptor slots at 0x4330 high-to-low for one whose two guard bytes are both zero and, on a hit, seeds it.

The leaves that actually stamp a slot are three. activateObjectSlotAndEnqueueSpawn [code] activates a claimed slot: it consumes the trigger flag it was found under (writes 0 there), marks the slot active with a cleared phase, records the spawn code into byte 6 and the trigger pointer's low byte as the source index into byte 7, and posts a type-1 spawn word keyed by that index, returning the trigger pointer unchanged for the caller. spawnSecondaryObjectIntoSlot [code] activates a secondary slot but bails if either of its two live flags (byte 0 / byte 1, bit 0) is already set; otherwise it consumes the trigger flag, marks the slot alive, clears its state byte, inherits byte 6 from the source record, stashes the trigger index into byte 7, and posts the activation word. spawnSecondaryObjectAndAdvanceWalk [code] is the per-slot step of a secondary spawn walk: it spawns into the current slot, advances the slot pointer by 32, decrements the budget, and — when the budget hits zero — forces the caller's loop counter to 1 so the walk ends after that pass.

### Advancing to the next formation

When a formation has been fully destroyed the machine advances the stage. armFormationAdvanceTrigger [code] is the gated one-shot arm: only when both region-clear gates loc_4220 and loc_4225 have bit 0 set (the field and the object slots are all empty) and the pending word loc_4222 is not already armed does it write 1 into loc_4222 (enable byte 1, zeroed countdown). advanceStageAndReseedFormation [code] later consumes it: on the tick when the enable bit is set and its countdown loc_4223 decrements to zero, it disarms the enable, rebuilds the 128-flag block from the packed template at loc_051b, resets the pace counter loc_421a and loc_425f, reseeds the swept anchor loc_420e to 1, steps the stage selector loc_421b (its low byte saturating at 7, its high byte counting), posts a command word (loc_0700), and services a pending two-slot request from loc_421e into the trigger cells loc_4177 and loc_4178.

Finally, loc_090b is a deliberately unnamed pure-stack epilogue — it restores HL and returns, the common exit of one of the enqueue paths — and carries no formation logic of its own.

## Player ship, projectiles, dive scheduling, object-AI paths, and collisions

Everything in this subsystem hangs off one per-frame update pass. In frame order that pass first services the player ship, then the player's single shot, then walks the eight object slots through their AI, then runs the two collision sweeps, then the attacker-scheduling helpers, and finally recomputes the demo-mode auto-pilot command. The two master switches it all reads are the object-subsystem enable at `OBJ_ACTIVE_FLAG` (0x4200) and the player-X reference at `loc_4202`, which holds the ship's current column and is the point every attacker steers relative to.

### Bringing the playfield up

Two sequence-state handlers stand this world up. `resetObjectRamAndAdvanceSequence` [code] runs first: it reseeds the interleaved object-RAM shadow from the ROM template at `loc_1d91`, zeroes the 64-byte sprite-shadow span at `SPRITE_SHADOW_BASE` (0x4060) and a broad object-record region from `loc_4260` (a full 256-byte page plus an 80-byte tail), clears `loc_4238` and `MESSAGE_SCROLL_ENABLE` (0x40b0), points the tile-fill cursor `VRAM_WRITE_PTR` (0x400b) two cells into `VRAM_BASE` (0x5000), arms the dwell timer `loc_4009` to 16, and bumps `SEQUENCE_STATE` (0x400a). A few states later `activateObjectsAndBeginPlayPhase` [code] counts that same `loc_4009` dwell down each frame and, only on the frame it hits zero, reloads it to 10, advances the sequence, and switches gameplay on: it sets `OBJ_ACTIVE_FLAG` to 1 (a 16-bit store, which also clears the paired `loc_4201`), parks the ship reference `loc_4202` at 128 (screen centre), refills the sixteen-byte enemy-launch sub-counter block at `loc_424a` from `SUBCOUNTER_RELOAD_TABLE` (0x15e3) — the pacing counters that later meter how often attackers peel off — clears the scratch cells `loc_4058`/`loc_405a`, and queues two display commands. From here the per-frame pipeline does real work.

### The player ship and its auto-pilot

`moveControlledObjectAndStageSprite` [code] owns the ship's column. When `OBJ_ACTIVE_FLAG` bit0 is set it chooses a movement source: with `loc_4006` bit0 clear it obeys the auto-pilot byte `OBJ_MOVE_CMD` (0x423f); otherwise it reads a live input port, `IN1_SHADOW` (0x4011) or `IN0_SHADOW` (0x4010) as selected by `loc_4018` bit0. Bit3 of that command steps the ship's column at `loc_4202` down while it stays above the floor 23; bit2 steps it up while below the ceiling 233 — a clamped band of [23,233]. It then stages the ship for the hardware by writing the one's-complemented, +128-biased position as four identical (value, code=6) pairs into `OBJ_STAGE_BLOCK` (0x4054). Two inactive cases matter for the death sequence: if `OBJ_ACTIVE_FLAG` is clear but `loc_4201` bit0 is set the ship is frozen in place and staged under an alternate code 7 (the ship still drawn where it died); if both are clear the position is forced to 0 and staged under code 6.

The auto-pilot byte itself is produced by `computeControlledObjectMoveCommand` [code], which fires only once per 32-frame phase (when `loc_425f` + 9 is a multiple of 32) and only while both `loc_4007` bit0 and `OBJ_ACTIVE_FLAG` bit0 are set. It folds a positional weight across two record tables — the seven object records at `OBJ_TABLE` (0x42d0, 32-byte stride) and the seven tighter-packed projectile records at `loc_4260` (5-byte stride) — adds a scaled offset between the formation anchor `loc_420e` and the ship reference `loc_4202`, halves that, applies a random plus/minus-one nudge, and buckets the result into `OBJ_MOVE_CMD` as 8 (move one way), 4 (the other), or 0 (hold). The per-record weight comes from `accumulateObjectPositionWeight` [code]: it ignores any inactive record, or one whose Y is above 128 only within two 52-row bands, or whose horizontal delta from `loc_4202` has drifted into the top half; for a record that qualifies it folds the flag's high bit, two bits of the X delta, and the band number into a 0–15 index and adds the signed step read from `OBJ_STEP_TABLE` (0x1a45) to the running total. In effect the demo/attract ship leans toward wherever the live threat mass sits.

### The player's shot

`advancePlayerShot` [code] drives the one missile through a small block of cells. While the gate `loc_4208` bit0 is armed it drains the travel counter `loc_4209` by four each frame (the missile climbing the screen) and raises the retire flag `loc_420b` when that counter lands in the narrow borrow window 14–17 near the top. While the gate is clear the shot is idle: the counter is re-parked at 220 (bottom of travel) and the X field `loc_420a` is re-latched from the ship column `loc_4202` whenever `OBJ_ACTIVE_FLAG` bit0 is set (else zeroed) — so at the instant of firing the missile inherits the ship's column. `advancePlayerShotAndStageSprite` [code] runs that service and then converts the {counter, field} pair into the missile's two render cells: `loc_409f` from the travel counter (either counter−1 or its complement +252, chosen by the cocktail/flip bit `loc_4018` bit0) and `loc_409d` from the complemented X field.

### The object record and its state machine

The eight attackers live as fixed-stride records; the per-frame driver walks them from `SPRITE_SOURCE_OBJ_BASE` (0x42b0) in 0x20 steps, and record offset +0x00 bit0 is the primary-active flag while +0x01 bit0 is a secondary/dying flag. If the dying flag is set the record is handed to the death-animation dispatcher (below); otherwise, for an active record, the state index at +0x02 selects one of sixteen handlers. The record's other bytes are heavily overloaded by state — broadly, +0x03 and +0x04 are the two coordinate fields, +0x05 the signed heading, +0x06 a direction bit, +0x07 a kind/seed byte, +0x10 and +0x11 a move throttle and a leg counter, +0x13 a walk cursor, and the bytes at +0x18…+0x1c a shared seed-plus-accumulator region.

**Path walking.** State 1 is `advanceObjectPathStep` [code]: it reads a delta pair from `PATH_STEP_TABLE` (0x1e00) at the record's cursor +0x13, adds the first byte to the Y field +0x03 and the second (added or subtracted per the direction bit +0x06) to the X field +0x04. If the new X (plus a 7px margin) crosses the near edge (below 14) it forces state +0x02 to 5, the fall-away state; otherwise it advances the cursor, ticks the throttle +0x10 (reloading it to 4), nudges the cross-step +0x05, and ticks the leg counter +0x11, advancing to the next state when a leg finishes. `advanceObjectPathStepDescending` [code] is the subtract-direction mirror used at state 10: it subtracts the table's X delta from +0x03 and, unless the direction bit hands the vertical half off, subtracts the Y delta from +0x04, ticking throttle and leg the same way and — on a finished leg — advancing state and reloading throttle=3, leg=12, heading=12, cursor=0. When that direction bit is set it defers the vertical half to `advanceObjectPathStepAscending` [code], the mirror-image arm that instead adds the delta to +0x04, steps the heading +0x05 upward, and on a finished leg reloads heading to 244; it is also reachable as its own state. State 11 is `advanceObjectPathStepAlias` [code], a bare trampoline that forwards to `advanceObjectPathStep` with no work of its own.

**Diving and the swoop curve.** State 4 is `advanceObjectDiveStep` [code]: it steps the position field +0x03 by one or two on the frame-parity bit `loc_425f`, and while that position sits inside the [6,9) window it just bumps the state index. Outside the window it runs `advanceObjectFlightCurve` [code] and folds that curve's heading high byte at +0x19 plus the per-object increment at +0x09 into a new screen Y at +0x04 — bumping the state instead when the sum carries across the signed boundary (the swoop has run off the bottom). The flight curve is the genuinely interesting piece: it runs ((seed&3)+1) integration steps of a cross-coupled fixed-point rotation over two 16-bit accumulators packed into the record (high/low at +0x19/+0x1b and +0x1a/+0x1c), each step adding twice the *other* accumulator's sign-extended high byte, with a guard that reverts any step whose high byte lands on exactly 128. The rotating accumulators' high bytes are precisely the curving offset the dive step reads back — so the same bytes are a linear-move target-and-accumulator during a straight move and a rotation state during a swoop.

**Homing.** State 7 is `homeObjectXTowardPlayer` [code]: it bumps the frame counter +0x03 and steers the record's 16-bit X:subpixel pair (high +0x04, low +0x09) toward the ship reference `loc_4202` by roughly four times the signed distance each frame, carrying the hardware's rounding bias, and advances the state when the dwell timer +0x10 reaches zero.

**Choosing the next horizontal move.** A cluster of planner routines pick where an attacker crosses to. `advanceActorPhaseAndCommitMove` [code] (state 2) ticks the phase counter +0x03 and then, if the kind field +0x07 masked by 0x70 equals 0x60, defers to `commitMoveToStoredOrPlayerTargetX` [code], otherwise to `commitMoveAcrossPlayerX` [code]. `commitMoveToStoredOrPlayerTargetX` steers toward the object-table's own stored target (`OBJ_TABLE`+0x19) when `OBJ_TABLE` bit0 is set, else falls through to the cross-player pick. `commitMoveAcrossPlayerX` is the workhorse: it signed-halves the gap between the actor's X +0x04 and the reference `loc_4202`, biases it by 16, and clamps to a band on the far side of the player — right (144–208) when the actor is left of the ship, left (48–112) otherwise — then commits via `commitMoveToTargetX` [seen], which stashes the chosen target X into +0x19, records the signed move delta (current minus target) into +0x09, zeroes the three-byte move accumulator at +0x1a…+0x1c, and advances the planner sub-state +0x02. `beginObjectCrossPlayerMove` [code] is the shared tail that runs the cross-player pick and then arms the record's curve seed +0x18=3 (yielding four curve steps later) and its throttle +0x10=100. `armDirectedMoveWhenInWindow` [code] (state 8) ticks the arm counter +0x03 and keeps cruising via that tail until both the counter and the position +0x04 sit inside the [96,160) window, at which point it advances the state by two, seeds the move timers +0x10=3/+0x11=12, clears +0x05 and +0x13, and sets the direction bit +0x06 from the reference-X compare. `restartObjectMoveRun` [code] (state 12) bumps its sub-counter, forces the state back to 8 to re-enter that arm window, and kicks off a fresh cross-player move.

**Phase entry and settling.** State 13 is `initObjectPhaseSteps` [seen]: it derives a step count n from the inverted low two bits of the seed +0x07, writes n+1 to the step-count field +0x16 and a derived code byte ((n+1)<<4)+140 to +0x03, arms the phase timer +0x10 to 24, advances the sub-state +0x02, and clears the ready flag +0x15 — re-arming it to 24 only when n is zero. State 15 is `settleObjectXAtRest` [seen], the final rest handler: it nudges the field at +0x04 upward one count per frame until the wrapped distance from the rest value 200 falls within a band of 5, then simply holds.

### Dying-object animation

When a record's secondary flag +0x01 is set, its own two-frame animation runs under its sub-state +0x02. `tickDeactivatedObjectAnim` [code] (sub-state 1) counts the fast timer +0x10 down, reloading it to 4 and bumping the companion counter +0x12 on each elapse, then ticks the slow timer +0x11; when the slow timer elapses it either retires the record (clearing the state byte +0x01) or — if the position field +0x07 has reached 112 — reloads the fast timer to 50, seeds the companion from the global `loc_422d`+32, and advances the sub-state. `endObjectAnimOnTimerExpiry` [code] (sub-state 2) simply counts the timer +0x10 down and clears the record's state byte +0x01 the frame it expires, retiring the actor. That companion counter +0x12 doubles as the alternate sprite attribute the renderer reads, so it animates the explosion as it ticks.

### Turning records into sprites

`renderObjectSprite` [seen] builds one hardware sprite record (Y, attr, sprite#, X) from an object record. For a primary-active record it copies the position (X = objX−8, Y = complement(objY) − a caller Y-offset), takes the sprite number from +0x16, and folds the signed heading +0x05 into a display attribute: the fold rotates the heading by whole 24-count sectors into a small settled range, maps that to a facing attribute added onto the base attribute at +0x0f, and applies a one-pixel nudge on the diagonal cases. A secondary-active record instead uses fixed sprite #7 and the record's alternate attribute at +0x12 (the death animation's companion value). If both flags are clear the sprite is parked off-screen at (248,248).

### Attacker scheduling

Two helpers decide who launches and in which direction. `chooseNextAttackerDirection` [code] sets the shared direction flag `loc_4215`: the sign of the 16-bit formation anchor `loc_420e` picks which edge of `FORMATION_X_BOUNDS` (0x4210) to measure the gap against, and within 28 pixels of that edge the flag is forced away from it (0 near the high bound, 1 near the low), otherwise a fresh random bit decides. `selectAttackerRowScan` [code] chooses which formation row supplies the next attacker: the alt flag `loc_421b` seeds either slot 2/base 157 or slot 1/base 132, then it scans up to four two-byte slots of `ROW_OCCUPANCY` (0x41e8), advancing past any slot whose two bytes both have bit0 clear, and stores the resulting (slot index, base) pair into `loc_4213` for the row-based dive AI to consume.

### Collisions and the hit event

Two sweeps run back to back each frame. `flagPlayerShotHitsOnObjects` [code] runs only while the shot gate `loc_4208` bit0 is armed; it box-tests the shot's {`loc_4209`, `loc_420a`} against each of the seven records from `OBJ_TABLE` (32-byte stride) via `flagPlayerShotHitOnObject` [code], which — for an active record whose position +0x03/+0x04 falls inside a 6-wide by 12-tall window around the shot — raises the shot-retire flag `loc_420b` and tail-calls the scoring/deactivation routine. `flagObjectHitsOnPlayer` [code] runs only while `OBJ_ACTIVE_FLAG` bit0 is set and box-tests those same seven records against the ship via `flagObjectHitOnPlayer` [code], which classifies the record's +0x03 (plus a 33 bias) into a near or far proximity window, tests the ship reference `loc_4202` minus the record's +0x04 against that window's band, and on overlap raises `HIT_EVENT_FLAG` (0x4204) before likewise scoring and deactivating the record. Later in the frame `handlePlayerHitEvent` [code] is the sole consumer of that flag: if it is clear it does nothing, otherwise it clears it, zeroes `OBJ_ACTIVE_FLAG` and sets `loc_4201`=1 (the freeze-the-ship state the mover reads), arms the death pulse counters `loc_4205`=10/`loc_4206`=4, queues the hit sound, decrements the pace counter `loc_421a` with a floor at 0, steps the wrapping [0,5] cycle counter `loc_421d`, and pulses `SOUND_W_REG3` (0x6803) when `loc_4006` bit0 is set.

Finally, `loc_090b` [code] is a deliberately-unnamed shared stack epilogue: it restores the caller's saved HL and returns, touching no work RAM.

## Sound

Galaxian's sound is a bank of small per-frame voices that all write into two staging
cells before a single driver latches those cells out to the discrete-sound and pitch
hardware. Two cells do the composing. The pitch source SOUND_PITCH (0x41c1) holds the
byte that will be handed to the pitch port SOUND_PITCH_W (0x7800), and the composite
flag at 0x41c0 accumulates which voice, if any, claimed the frame; it is latched to
sound-write registers 6 and 7 (the second being the first rotated right one bit). The
sound driver's per-frame tick opens each frame by clearing 0x41c0 and forcing
SOUND_PITCH to 0xff, then runs its seven voice updaters in a fixed order, and finally
copies 0x41c0 to the two flag registers and SOUND_PITCH to the pitch port. Because the
whole chain re-latches every frame, "stage a pitch" always means "write 0x41c1 and let
the driver push it out at the end of the frame", and the last voice to touch 0x41c1
wins the pitch that frame. Several other voices run from separate per-frame passes (the
play-state update pipeline and the vblank handler) and write the discrete-sound
registers directly.

### Staging a pitch

The lowest layer is stageSoundPitch [seen], which simply parks its argument in
SOUND_PITCH and returns; every pitch-producing voice funnels through it. Two thin
wrappers sit on top. stageSoundPitchBySelector [code] reads the low two bits of the
cell it is pointed at: a zero selector stages the fixed pitch 96, while a nonzero
selector is handed to stagePitchFromSoundCounter [code]. That routine recomputes the
pitch from the sound counter at 0x41c4 — on an odd selector it biases the counter by 96
and rotates the biased sum right one bit (the add's carry rotating back into the top
bit, giving a warble that folds around the byte), and on an even selector it passes the
counter through unchanged — then stages the result. stagePitchAndRaiseSoundFlag [code]
is the other entry into the staging pair: it stores its argument minus one into
SOUND_PITCH and raises the composite flag 0x41c0 to 1, marking the pitch as claimed for
this frame.

### The sweep voice

The main pitch voice is a sweep built from a small cluster of work cells at 0x41c2
through 0x41c4. updateSoundSweepVoice [code] is its per-frame head, gated on bit 0 of
0x4006 (skip the frame when clear). It treats 0x41c2 as a mode byte: when 0x41c2 holds
1 it reloads the idle template — 0x41c2 = 0, the sweep-phase cell at 0x41c3 = 2, and the
sound counter 0x41c4 = 160 — and otherwise hands off to advanceSoundSweepAndStagePitch
[code]. Note that 0x41c2 is a mode selector rather than a running counter: the head only
tests 0x41c2 minus one to pick the branch and never stores the decrement back. The idle
value 160 is deliberately parked past the sweep's ceiling of 96: while 0x41c4 sits above
96 the sweep stops advancing its phase cell, so the voice coasts until the counter
decays back under the ceiling.

advanceSoundSweepAndStagePitch steps the pointer forward one cell (from 0x41c2 to the
phase cell 0x41c3) and applies two gates. It returns immediately if bit 0 of 0x4226 is
set. If bit 0 of 0x425f is set it hands the phase cell straight to
stageSoundPitchBySelector. Otherwise, while the sound counter 0x41c4 is below the 96
ceiling it bumps the phase cell up by one, then falls into tickSoundCounterAndStagePitch
[seen]. That tail decrements the sound counter (when it is still nonzero) back into
0x41c4 and then, either way, stages the pitch through stageSoundPitchBySelector keyed on
the phase cell's low two bits. So each frame the sweep bumps its phase, walks the sound
counter down, and derives a warbling or fixed pitch from those two cells.

### The rising pitch ramp

driveRisingPitchRamp [code] runs a separate glide from an arm/mode byte at 0x41c9 and a
{countdown, pitch} pair packed at 0x41ca–0x41cb. Like the sweep head it tests 0x41c9
minus one only to pick a branch (the arm byte itself is not stored while it stays
armed). While armed it delegates to advanceSoundPitchRamp [seen]; when the arm byte
reaches 1 it clears 0x41c9 and reloads the pair at 0x41ca to the word 0x0020 — countdown
32, pitch 0. advanceSoundPitchRamp reads the countdown one byte past its pointer: if it
has drained to zero the tick is idle, otherwise it consumes one count, advances the
paired pitch byte by a fixed step of 4, publishes that pitch to SOUND_PITCH, and clears
the composite flag 0x41c0. The effect is a pitch that climbs by four every active tick
for thirty-two ticks, then resets and climbs again.

### The pulse-tone envelope

advancePulseToneEnvelope [code] runs a decaying pulse from the 16-bit envelope word at
0x41c7. It reads the word and checks bit 0 of the low byte: if set, the envelope is spent
and the word is reset to 0x8000 (low byte 0, high byte 0x80 at 0x41c8). Otherwise it
hands the high byte to pulseSoundToneFromCountdown [code], which is idle when that byte
is zero, and otherwise stores the high byte decremented back into 0x41c8 and then stages
a pitch shape through stagePitchAndRaiseSoundFlag — the argument is 129 when bit 2 of the
decremented high byte is set and 0 otherwise, so the staged pitch alternates between 128
and 0xff as the high byte counts down, producing a chattering pulse whose bit-2 toggling
gives the tone its texture.

### The sequence channels

Three sound-sequence channels play canned note lists out of ROM. Each channel is a
descriptor whose active/command byte lives at 0x41d2, 0x41cf, or SOUND_SEQ_ACTIVE
(0x41cd); the three share one cursor SOUND_SEQ_PTR (0x41d3), one current-tone cell at
0x41d5, and one duration timer at 0x41d6. advanceAllSoundSequenceChannels [code] runs
the channel updater over the three descriptors in that order every frame.

advanceSoundSequenceChannel [code] does the work for one descriptor. A descriptor whose
byte is zero is inactive and does nothing. Otherwise the channel marks the composite
flag 0x41c0 = 2 and publishes the current tone from 0x41d5 into SOUND_PITCH, then ticks
the shared duration timer 0x41d6 down; while the timer is still running there is nothing
more to do. When it expires the channel pulls the next command byte from the cursor: the
end marker 0xe0 deactivates the descriptor (its byte is cleared to zero), while any other
byte is split — its low five bits index the tone table SOUND_TONE_TABLE (0x17a9) to load
the new current tone into 0x41d5, and its high three bits index the duration table
SOUND_DURATION_TABLE (0x17c8) to load the new duration into 0x41d6 — and the cursor
advances past the byte.

Three arming routines light these channels. armSoundSequenceOnRequest [seen] is gated on
a request cell at 0x41d1: it fires only when that byte holds 1, then consumes it (0x41d1
= 0), raises descriptor 0x41d2 and the duration timer 0x41d6 to 1, and aims the cursor at
the note list at 0x1e68. armSoundSequenceBySelector [code] runs only while bit 0 of
0x4006 is set and dispatches on the sound-request/selector byte at 0x41df: a value other
than 6 is passed to armSoundSequenceForSelector16 [code], while 6 arms this channel
unless it is already active — raising descriptor 0x41cf and the duration timer to 1 and
aiming the cursor at the note list at 0x1ebd. armSoundSequenceForSelector16 acts only on
the selector 0x16 and ignores everything else; on a match it clears 0x41cf, raises the
active flag SOUND_SEQ_ACTIVE and the duration timer to 1, and aims the cursor at the note
list at 0x1edf.

### The gated square tone

advanceGatedSquareTone [code] drives a square wave through a phase counter at 0x41cc and
a duration at SOUND_TONE_DURATION (0x41ce). Testing 0x41cc minus one (again only to pick
a branch, without storing back), while the counter is more than one step from expiry it
runs driveGatedSquareTone [code]; on the expiry step it parks 0x41cc at 0 and re-arms the
tone duration to 8. driveGatedSquareTone writes silence (0) to sound-write register 5
(SOUND_W_REG5, 0x6805) once the duration has run out; while the duration is still nonzero
it counts one tick off it and drives the frame flag at 0x4007 with its bit 0 flipped to
that register. Because bit 0 of the frame flag alternates every frame, flipping it
toggles the register's output frame to frame, which is what makes the square wave.

### Voices on the other per-frame passes

Several voices run from the play-state update pipeline rather than the sound driver's
tick, and write the discrete-sound registers straight out. driveDecayingSoundSweep [code]
acts only on even frames (bit 0 of the frame flag 0x4007 clear): while the sound-request
byte at 0x41df is nonzero it emits that byte rotated right two bits to sound-write
register 4 (SOUND_W_REG4, 0x6804) and ticks it down by one, so a request drains toward
silence as a falling sweep. driveSoundVoicesFromOccupancy [code] is the background hum,
also even-frame gated: it sums a six-row by ten-column flag grid at OCCUPANCY_GRID
(0x4123) — row stride 16, the tally seeded at 1 — and lights that many of the three
sound-write latches SOUND_W_REG0/1/2 (0x6800–0x6802) with 1, capped at three and zeroing
any latch past the point the tally drains; the more of the grid is occupied, the more of
the three latches sound. It finally raises the flag at 0x4224 once the tally has nearly
run dry (below two). driveGatedSoundStepSequence [code] is gated on bit 0 of an enable
flag at 0x4201: a prescaler at 0x4205 fires once every ten eligible frames, and on each
fire it enqueues a command word (opcode 2 carrying the current step) through the sound
command queue and steps the counter at 0x4206 down; when that counter reaches zero the
sequence ends by clearing the enable flag and silencing sound-write register 3
(SOUND_W_REG3, 0x6803). The enqueue helper it uses preserves the caller's HL by saving
and later restoring it, and loc_090b [code] is the shared two-instruction tail of that
path — it restores the saved HL and returns.

The low-frequency-oscillator level is managed from the vblank pass. driveSoundLfoLevel
[code] dispatches on the reset-request flag SOUND_LFO_RESET_REQUEST (0x41d0): with no
request pending it runs the normal decay through decaySoundLfoLevel [code]; with a
request it consumes the flag and slams the full level (15) across the latches.
decaySoundLfoLevel is armed only on the tick where 0x425f reads 0xff, and then only
while the level shadow SOUND_LFO_LEVEL (0x421f) is nonzero — it drops the level by one
and broadcasts it. Both paths end in broadcastSoundLfoLevel [seen], which saves the level
into SOUND_LFO_LEVEL and then writes it to the four LFO-frequency latches at
SOUND_LFO_FREQ (0x6004–0x6007), rotating the byte right one bit between each write so the
four latches receive successively rotated copies.

### Posting a sound request, and silencing everything

armObjectAnimAndRequestSound [code] is the entry handler of a deactivated object's
animation phase. Besides seeding that object's animation timers (frame divider and step
fields in the object record) and advancing its sub-state so the entry runs only once, it
posts the phase's sound request into the shared byte at 0x41df — 0x17 when the object's
position field is at or above 112, otherwise 0x07. That byte is exactly what
driveDecayingSoundSweep drains to sound-write register 4 as a decaying sweep, and it is
the same cell armSoundSequenceBySelector reads as a sequence selector (acting only when
it holds 6 or 0x16, and so ignoring these position-keyed 0x07/0x17 posts); 0x41df is the
one sound-request byte shared by those consumers, and several other places in the game
post into it too.

silenceSoundAndDisableIrqStars [code] is the full quiet-down. It sets the four
LFO-frequency latches at SOUND_LFO_FREQ to 1, clears the eight sound-write registers
starting at SOUND_W_REG0, clears the control-latch block that includes the interrupt
enable IRQ_ENABLE (0x7001) and the starfield enable STARS_ENABLE (0x7004), and finally
drives the pitch port SOUND_PITCH_W fully high (0xff) — stopping the sound hardware, the
vblank interrupt, and the starfield together.

## Coins, credits, the HUD, score display, and the message scroller

### Coin acceptance and the credit bank

Coins enter the machine through two front-end routines that both run out of the per-frame service cluster. `serviceCoinInputs` [seen] is the edge detector: unless the coinage/config mode in loc_4000 (0x4000) is 3 -- the free-play preset, where it simply hands off to `presetCreditCount` -- it folds the two raw input shadows (IN0_SHADOW at 0x4010 and loc_4013 at 0x4013) together, complements them, and masks the result with two guard cells (loc_4015 and loc_4016). If the high bit survives that mask it takes it as a service credit and calls `addCreditForCoin` directly; otherwise the low two bits are treated as the two coin slots, each edge advancing the coarse coin counter loc_4004 (0x4004) by one (so both slots active in one pass bumps it twice). `presetCreditCount` [code] is the free-play arm: it clears the coin-phase flag loc_4001 (0x4001) and stuffs the credit bank loc_4002 (0x4002) with 9, which -- as we will see at the lockout -- is exactly the value that keeps the coin door released.

The coarse counter that `serviceCoinInputs` feeds is drained over many frames by `tickCoinMeterAndAwardCredits` [seen], which also drives the physical coin meter. While the pulse-width timer loc_4003 (0x4003) is still counting it calls `pulseCoinCounter` [seen] once per frame; that routine rotates the current timer value right three bits so the source byte's bit 3 lands in bit 0 of the write-only coin-counter output COIN_COUNTER_0_LATCH (0x6003) -- producing the on/off pulse train the mechanical meter needs -- and then decrements loc_4003. When loc_4003 finally reaches zero, one whole coin has been metered: if the coarse counter loc_4004 is empty nothing more happens, otherwise loc_4004 is decremented, loc_4003 is refilled to 15 to arm the next pulse train, and a credit is awarded according to the coinage mode in loc_4000. Mode 3 awards nothing, mode 1 runs the two-coins-per-credit path `awardCreditEverySecondCoin`, mode 2 runs the credit step twice, and every other mode runs it once.

`awardCreditEverySecondCoin` [code] implements "2 coins / 1 credit" as a toggle on loc_4001: with the flag's low bit clear this is the first coin of a pair, so it delegates to `setCoinPhaseFlag` [code] (which just writes 1 into loc_4001); with the flag already set this completes the pair, so it clears loc_4001 and awards the credit through `incrementCreditCount`. The actual credit-bank arithmetic lives in `incrementCreditCount` [code] and its sibling `addCreditForCoin` [code], which behave alike: both refuse to move a bank already at the 99 ceiling, both bump it otherwise, both raise the ready flag loc_41c9 (0x41c9), and both drop a channel-7 command word (parameter 1) into the command queue so the credit line gets repainted. `incrementCreditCount` additionally guards against an overshoot -- a value already past 99 is snapped back by `clampCreditsToMax` [code], which simply pins the pointed-at cell to 99.

The bank count also decides whether the coin door stays open. `updateCoinLockoutFromCredits` [code] reads loc_4002 each frame: nine or more banked credits releases the mechanism through `clearCoinLockout` [code] (which writes 0 to the coin-lockout latch COIN_LOCKOUT at 0x6002), while anything below nine engages the lockout by writing 1 there. This is why the free-play preset of 9 credits leaves the door permanently released.

A general-purpose counter helper sits alongside this cluster: `reloadExpiredCounterAndTally` [seen] copies a reload byte from a source table cell into an expired counter cell and returns an incremented tally. It is not part of the coin path itself -- it is the refill primitive the enemy-launch prescaler uses to re-arm its sub-counters from SUBCOUNTER_RELOAD_TABLE (0x15e3), bumping the this-pass refill tally that eventually lands in SUBCOUNTER_REFILL_FLAG (0x4228).

### Credit-driven state advance, start lamps, and round start

Having a credit is what lets the attract machine hand over to a game. `advanceGameStateOnCredit` [code] does nothing while loc_4002 is zero, but with any credit banked it advances GAME_STATE (0x4005) and wipes the attract sub-state cluster clean -- loc_4007, SEQUENCE_STATE (0x400a), loc_41c2, the sound-sweep countdown loc_41df, and the message-scroller enable MESSAGE_SCROLL_ENABLE (0x40b0) all go to zero.

The two start-button lamps track the bank through `driveStartButtonLamps` [code]. It is gated by bit 5 of the frame-counter/gate byte loc_425f (0x425f): with that bit clear both lamp latches START_LAMP_0 (0x6000) and START_LAMP_1 (0x6001) are forced off; with it set, zero credits leaves the lamps untouched, one credit lights lamp 0, and two or more lights both. Two of the attract-sequence step handlers hold on this behaviour. `holdStartLampsThenAdvanceSequence` [code] ticks its dwell byte loc_4019 (0x4019) each frame and, while it stays nonzero, keeps the lamps in step with the credit count; on the zero-crossing it advances SEQUENCE_STATE and zeroes the 128-byte flag-bits block at FLAG_BITS_BASE (0x4100). `blankVramRowsThenDriveStartLamps` [code] is the step that clears the play field: it fills two 28-cell rows of the blank tile (16) through the VRAM write cursor VRAM_WRITE_PTR (0x400b) -- skipping a 4-cell gap between rows -- then ticks the high dwell tier loc_4009 (0x4009); on the last row it advances the sequence, clears the screen-flip latches FLIP_SCREEN_X (0x7006) and FLIP_SCREEN_Y (0x7007) plus the direction flag loc_4018, queues two command words, and finishes by driving the lamps once more.

`startGameRoundAndClearScores` [code] is the round/spawn entry. It writes the player-count/spawn word into CURRENT_PLAYER (0x400d) -- a 16-bit store that lands the low byte in the current-player index and the high byte in the two-player-live flag loc_400e (0x400e) at once -- blits a 32-byte ROM row template from loc_051b (0x051b) into the packed-flag bitmap PACKED_FLAG_BITMAP (0x4180), and, when config bit 0 in loc_401f is set, arms the substate-advance gate. It then drops the machine into play (SEQUENCE_STATE = 0, GAME_STATE = 3, the mode gate loc_4006 set to 1, loc_41d1 set to 1) and queues three spawn/clear command words: a channel-6 start message and two channel-4 score-slot clears.

Two more sequence handlers pump the attract HUD on a two-tier dwell. `emitMessageColumnsThenAdvanceSequence` [seen] runs the shared strided-table clear, then counts down the low tier loc_4008 (0x4008); each low-tier expiry reloads loc_4008 to 80 and queues a channel-6 message-column command whose low byte tracks the mid count in loc_4009, and each mid-tier expiry advances the sequence, reloads both tiers (32 and 4), clears the sprite-source object block at SPRITE_SOURCE_OBJ_BASE (0x42b0), and zeroes the drawn-column count DRAWN_COLUMN_COUNT (0x4241). `postCreditAndMessageDrawsAndAdvance` [code] is a simpler sibling: it queues a channel-7 credit-line redraw and a channel-6 message-column draw, advances the sequence step, and re-arms the dwell cascade with loc_4008 = 96 and loc_4009 = 16.

### The animated attract screen-fill

During attract the play field is repainted by an animated tile strip that marches down VRAM. `drawInputTextColumnsAndSeedScreenFill` [seen] both seeds this and draws the DIP-switch readout: it decodes three two-bit fields -- IN1 (0x6800) bits 6-7, IN2_PORT (0x7000) bits 0-1, and IN2 bit 2 -- into text-descriptor indices and paints each as a column, then, unless IN0 (0x6000) bit 6 is asserted, seeds the fill state (mode gate loc_4006 = 0, dispatch flag loc_401a = 2, the dwell pair loc_4008/loc_4009 = 16/48, and VRAM_WRITE_PTR rewound to VRAM_BASE at 0x5000), clears the four-byte lamp/coin latch block starting at START_LAMP_0, and silences the sound hardware. Two thin front-ends stack in front of it during the input scan: `requestSound6AndContinueInputScan` [code] seeds the sound-request selector loc_41df to 6 when the folded input ports show bit 2 or 3 and then falls through to `armInputFlagAndDrawInputColumns` [code], which raises the companion input flag loc_41cc when the folded ports share bit 4 and then runs the fill-seed routine itself.

`resetScreenFillState` [seen] is the lighter re-seed used to restart the fill: gated the same way on IN0 bit 6, it rewinds VRAM_WRITE_PTR to VRAM_BASE, arms the strip length loc_4008 to a full page (32), clears the dispatch flag loc_401a, and zeroes GAME_STATE. `restartScreenFillOnDwellExpiry` [seen] is the outer dwell tick: it ticks the high tier one past its pointer (loc_4009) and, when that reaches -- or already sits at -- zero, calls `resetScreenFillState` to begin the fill anew.

The per-frame strip painter is a small chain. `advanceScreenFillStrip` [code] pets the watchdog by reading the sound-pitch latch SOUND_PITCH_W (0x7800), then reads the strip gate loc_4008: a zero gate means there is no strip to draw, so it restarts the outer dwell, otherwise it loads the live cursor from VRAM_WRITE_PTR and enters `drawScreenFillStripFirstHalf` [code]. That stamps the tile pair (48, 50) forward from the cursor -- two cells per pass, a count of zero wrapping to 256 -- and then flows straight into `drawScreenFillStripSecondHalf` [code], which stamps a further sixteen pairs of tiles (52, 54), saves the advanced cursor back to VRAM_WRITE_PTR, and ticks loc_4008 down; on its expiry it too restarts the outer dwell through `restartScreenFillOnDwellExpiry`.

### Static text columns

Fixed text -- labels, the DIP-switch readout, and the like -- is drawn a column at a time. `drawTextColumn` [code] is the inner loop: for each of `count` characters (a count of zero meaning a full 256) it reads a source byte, subtracts the '0' code (48) to map it to a tile, writes it to the destination cell, and steps the destination by the given stride, so a negative stride walks the text up a column. `drawTextColumnFromDescriptor` [code] unpacks a five-byte descriptor -- a source word, a destination word, and a count byte -- and paints that column up the screen with a one-row-up stride of -32. `drawTextColumnByIndex` [code] simply indexes the ROM descriptor table TEXT_DESCRIPTOR_TABLE (0x1cf6) by five bytes per entry and paints the selected descriptor.

### Scores: storage, BCD, and rendering

Scores are held as three-byte packed-BCD fields -- player 1 at PLAYER1_SCORE_BCD (0x40a2), player 2 at PLAYER2_SCORE_BCD (0x40a5), and the high score at HIGH_SCORE_BCD (0x40a8). `selectCurrentPlayerScore` [code] returns the active player's field base, chosen by CURRENT_PLAYER, and `byteToPackedBcd` [code] is the binary-to-BCD helper feeding the score arithmetic: it renders a byte's value modulo 100 as two packed decimal digits, tens in the high nibble and units in the low.

Rendering a number is done digit by digit up a VRAM column. `drawBcdDigit` [code] paints one BCD nibble: digits '0'..'9' are the contiguous tiles 0x90..0x99, so a nibble d maps to tile 0x90 + d, and it advances the cursor by the caller's stride. It suppresses leading zeros through a blank counter -- while the counter is nonzero a leading zero paints the blank tile (0x10, reached because 0x80 + 0x90 wraps mod 256) and consumes one count, and the first significant digit ends suppression. `drawBcdNumberColumn` [code] walks three BCD bytes downward from the source pointer (most-significant byte first), painting high nibble then low for each, stepping the cursor one row up (-32) per digit, with a four-digit leading-zero budget. The field cursors are chosen by two wrappers: `drawScoreToSelectedPlayerField` [code] points the column at DIGIT_FIELD_PRIMARY (0x5381) when the selector is zero and at DIGIT_FIELD_ALT (0x5121) otherwise, while `drawHighScoreDigits` [code] always paints into the fixed high-score field at loc_5241 (0x5241).

`drawScoreFieldByIndex` [code] is the redraw dispatcher over these fields: index 0 repaints player 1's score into the primary field, index 1 repaints player 2's -- but only when the two-player-live flag loc_400e is set, which also serves as the alt-field selector -- and index 2 repaints the high score; an index of 3 or more descends, redrawing every field from index-1 down to 0. `clearAndRedrawScoreField` [seen] wraps that with a zeroing pass first: for the selected field it clears all three BCD bytes plus a per-player companion scratch byte (loc_40ad for player 1, loc_40ae for player 2; the high-score field, having no separate companion, re-zeroes its own first byte), then repaints through `drawScoreFieldByIndex`; index 3 or more again descends over all lower fields.

Scoring on a kill runs through `awardKillScoreByBandAndDeactivate` [code]. It first deactivates the struck object (its first three record bytes become 0, 1, 0), then scans the object's packed position/type field (record byte 7) across three bands against the threshold 0x50: each band the field clears the threshold bumps a request parameter (seeded at 4) and drops the field by 16, and the first band the field falls short enqueues a channel-3 score-add command carrying that parameter. If all three bands are exhausted it raises the inhibit/request word loc_422b (storing 0xf001), folds in a neighbour bonus when the active-neighbour count ACTIVE_NEIGHBOR_COUNT (0x422a) is exactly two, records the bonus at loc_422d, and enqueues the folded channel-3 request. That channel-3 command drives the BCD score-add handler, which adds the increment into the current player's field, calls `drawScoreToSelectedPlayerField` to repaint it, and -- when the running total tops the stored high score -- copies it to HIGH_SCORE_BCD and falls into `drawHighScoreDigits`.

### The marker row and the player-status column

Extra-life/bonus markers live in a five-slot row. `drawMarkerRow` [code] paints `markers` 2x2 marker icons (tile 102) growing upward from MARKER_ROW_VRAM (0x539e), then blanks the remaining slots until its signed slot counter goes negative; when the object-active flag OBJ_ACTIVE_FLAG (0x4200) is set the displayed count is dropped by one, and if that empties the row every slot is blanked instead. `awardBonusMarker` [code] is the one-shot that grants a marker to the current player: it indexes a per-player guard-flag table at loc_40ad by CURRENT_PLAYER and, if that player's slot is already flagged, does nothing; otherwise it flags the slot, raises the sound-envelope trigger loc_41c7, bumps the marker counter loc_421d, and repaints the row with the new count. It is invoked from the score-add handler once a player's total crosses the bonus threshold held at loc_40ac (0x40ac).

The player-status indicator is a three-cell column, one per player. `selectPlayerStatusVram` [code] returns the base for a player -- PLAYER1_STATUS_VRAM (0x5340) for player 1, PLAYER2_STATUS_VRAM (0x50e0) otherwise. `paintPlayerStatusColumn` [code] paints the column from a pointer stepping by a stride: the top cell gets an incremented character code, the middle a fixed tile (0x25) and the bottom another (0x20); afterward, only when bit 4 of the flags byte is clear and the mode gate loc_4006 is zero, it clears the status/repaint gate byte loc_40ab. `repaintPlayerStatusColumn` [code] wraps this for the active player: with the flags bit 4 clear it paints the current player's column directly, and with bit 4 set it blanks that column's three cells (tile 16, stride -32) and -- only when loc_400e marks a live second player -- also paints the other player's column. Two conditional front-ends gate the repaint on saved state: `repaintPlayerStatusColumnIfSaved` [code] repaints only when the saved status byte loc_40ab is nonzero, and `repaintPlayerStatusColumnFromModeGate` [seen] latches the mode -- when loc_4006 is nonzero it saves that value into loc_40ab and repaints unconditionally, and when loc_4006 is zero it repaints only if loc_40ab is already set.

### The message scroller

Longer text is drawn by a scroller that emits one glyph per frame. `renderMessageColumn` [seen] is its setup-and-paint front end, keyed by an index that picks a record (a destination word followed by the text) from the message pointer table MESSAGE_PTR_TABLE (0x235c). The index's top two bits pick the mode: bit 7 blanks the message's cells (writing tile 64 up the column to the 63 terminator), bit 6 arms a scroll -- it records the destination, text, and per-column cursor pointers (MESSAGE_DEST_PTR at 0x40b5, MESSAGE_TEXT_PTR at 0x40b3, and MESSAGE_CURSOR_PTR at 0x40b1 pointing into the cursor base loc_4020), clears the whole column to tile 16, packs the destination row into the cursor cell, and raises MESSAGE_SCROLL_ENABLE (0x40b0) -- and with neither bit set it paints each glyph (source byte minus 48) up the column until the 63 terminator.

Once armed, `advanceMessageScroller` [seen] runs the step each frame while MESSAGE_SCROLL_ENABLE bit 0 is set. It reads the delay counter through MESSAGE_CURSOR_PTR; while the counter's low three bits are still set it merely ticks it via `endMessageScrollOnExpiry`, at the 63 terminator it emits nothing and just runs the countdown, and otherwise it emits one glyph -- advancing MESSAGE_TEXT_PTR by one, writing the char-minus-48 tile into the cell at MESSAGE_DEST_PTR, and stepping that destination one row up (-32) -- before ticking the counter. `endMessageScrollOnExpiry` [seen] is that countdown tail: it decrements the counter at the pointer and, on the exact zero-crossing, clears MESSAGE_SCROLL_ENABLE so the scroller stops. `endMessageScrollOnExpiryFromDe` [seen] is the same tail reached with the counter pointer arriving in the alternate register, used for the terminator and glyph paths.

New scroller messages are also queued by the object AI. `advanceObjectAndQueueMessageColumn` [seen] is one object state's per-frame step: it bumps the object's free-running tick (record byte 4) and counts down its dwell timer (record byte 16); while the timer runs it returns, and on expiry it queues a channel-6 command word carrying the object's payload selector (record byte 7 plus 75) -- which the command queue later routes to `renderMessageColumn` -- and advances the object's own state (record byte 2).

### The command queue tail

Every "queue a command word" mentioned above shares one exit. After a command is written and the queue's write head advanced, the enqueue path returns through the deliberately-unnamed loc_090b [code], a pure-stack epilogue that restores the caller's saved pointer and returns with no work-RAM effect of its own.

## Tile / VRAM drawing primitives and coordinate mapping

Galaxian's playfield text and decorations live in the tilemap at VRAM_BASE (0x5000), and nearly every glyph reaches that memory through a tiny family of stamping primitives, most of them fed by a single coordinate translator. Understanding this subsystem means starting at the atom that writes cells, then following it outward through the block builders, the coordinate-driven figure drawers, the 4x4 indicator forms, the vertical-column repainter, the full-row screen-clear steppers, and finally the projectile integrator that reuses the same object records to feed the sprite shadow.

### The stamp atom and the pair/block builders

The lowest primitive is stampTilePair [code]. Given a tile code, a destination pointer, and a stride, it writes the code into the destination cell and the code-plus-one into the adjacent cell, then advances the pointer past the second cell by the stride (destination + 1 + stride) and bumps the tile code by two. Because the store truncates to a byte, a seed of 0xff writes 0xff then 0x00. It hands back the advanced code and pointer so a caller can chain pairs; that chaining is what turns one horizontal pair into a rectangular block. drawFixedTilePairHorizontal [code] is the thin fixed-seed entry into it, seeding the decorative glyph code 44 (0x2c) and letting the caller's loop thread the returned pointer into the next pair — this is how the HUD/score line lays runs of tiles.

drawDoubleHeightTile [code] is the vertical counterpart: it writes the seed at the pointer and the seed-plus-two one full tilemap row (32 cells) directly below, so the two glyphs stack to form a tall character. drawFixedTilePairVertical [code] seeds that with code 44, painting 0x2c on top and 0x2e beneath.

A 2x2 block is just two of these horizontal pairs stacked. drawTileBlock2x2 [code] calls stampTilePair twice with a stride of 31: after the first pair the pointer has moved +1 (past the pair) then +31, i.e. +32, one tile row down, so the top pair (code, code+1) lands at the destination and the bottom pair (code+2, code+3) lands directly beneath — a contiguous four-code block. It leaves the caller's DE stride register untouched. drawFixedTileBlock2x2 [code] seeds this with code 44, laying tiles 0x2c..0x2f. drawTileBlock2x2Up [code] is the upward mirror: it uses a stride of -33 (65503 as an unsigned step) so each pair moves one row *up* after its built-in +1, and between the two pairs it steps the tile code back by four, so the top pair is the higher-coded one and the "bottom" pair painted one row above is seeded four codes lower. drawFixedTileBlock2x2Up [code] seeds that upward block with the decorative code 46; it is used to blank the unused slots of the marker row.

Two shared helpers glue these together. drawBottomTilePairRestoreDe [code] is the common tail of the block writers: it stamps the second (bottom) pair through the stamp atom, then restores the DE stride the caller saved before the block began and returns — both drawTileBlock2x2 and drawTileBlock2x2Up funnel their second pair and DE-restore through this shared tail. drawTileBlock2x2AtDe [code] is a destination adapter: it swaps the DE and HL pointers so that whatever pointer arrived in DE becomes the block's draw destination (the old HL is handed back in DE), then draws a 2x2 block there from the seed tile. This DE-entry form exists so the coordinate-driven dispatch can survive a table lookup that clobbers HL, as described below.

### Mapping a packed coordinate to a cell, and drawing a figure there

mapPackedCoordToVram [code] is the translator that turns a packed one-byte coordinate into a tilemap cell address by a deliberate nibble shuffle. It takes the coordinate's low nibble, rotates it, and splits it into a two-bit page selector (0..3, forming the high byte of the offset over VRAM_BASE) and a two-bit low seed. It then folds the coordinate's high-nibble three-bit field (bits 6..4) through a complemented running sum into the low nibble and adds the seed, yielding the final cell = 0x5000 + (page<<8) + low. Its three live-outs are what callers act on: HL holds the cell address, A holds the coordinate's bits 6..5, and the carry flag holds the coordinate's bit 4 — and it is bit 4 (via that carry) that every caller branches on to choose between a block and a vertical figure. It also copies the raw coordinate aside so a later variant fold can read it.

drawFixedTileFigureAtPackedCoord [code] is the simplest consumer and one of the display-list draw handlers: it maps the coordinate to its cell, then, on the mapper's carry (coordinate bit 4 set), stamps a fixed 2x2 block there via drawFixedTileBlock2x2, or otherwise stamps a fixed vertical pair via drawFixedTilePairVertical — both from the 0x2c glyph family.

drawAnimatedTileFigureAtPackedCoord [code] is the animated sibling display-list handler. It maps the coordinate to its cell, then biases that same coordinate into a timer-animated tile variant (the mapper leaves the coordinate available, and the variant fold reads it), and dispatches on coordinate bit 4 through drawTileGlyphOrBlock, carrying VRAM_BASE along as the second pointer that the block path's pointer swap needs.

drawTileGlyphOrBlock [code] is that dispatch. With the carry set it swaps its two pointers and draws a 2x2 block selected by the B register at the mapped cell; with the carry clear it fetches a tile code for B from the byte table at loc_2157 (0x2157) and paints it as a double-height glyph at the incoming pointer. The pointer swap on the block path exists purely so the incoming cell pointer is stashed across the code fetch (which clobbers the working pointer) and then restored as the actual draw destination — in both branches the figure lands at the cell the mapper produced.

The block-selection branch continues through drawSelectedTileBlockOrFallback [code], which treats B as a signed selector: a non-negative selector indexes the block table, while a negative one falls back to stamping a fixed block seeded with tile 0xa4 at the pending destination. The non-negative path runs through drawIndexedTileBlock [code], which looks the 2x2 block code up in TILE_BLOCK_TABLE (0x215b) by the index and stamps that block at the pending destination via the DE-entry adapter. So the whole coordinate-to-figure chain is: map the coordinate, decide block-vs-glyph on bit 4, and for a block either look it up by index or fall back to 0xa4.

The variant that animates those figures comes from a two-stage fold. computeTileVariantFromValueAndTimer [code] takes a value in B and, if it is at or above 112, saturates it to the out-of-range marker 128; otherwise it reduces the value to its low nibble and sets a carry when the per-frame counter loc_425f's low nibble is smaller, then falls into computeTileVariantFromTimer [code]. That routine folds B toward a two-bit value: below the 112 limit it computes (nibble-swap of loc_425f + B + carry) & 3, so the animation cycles with the frame counter; at or above the limit it likewise saturates B to 128. The result is a two-bit tile-variant index in B; neither stage disturbs A or the flags.

### The 4x4 indicator forms

draw4x4TileForm [code] is the display-list channel that paints a 4x4-cell indicator over a fixed region whose corners are loc_51da, loc_51dc, loc_521a, and loc_521c. It selects one of three behaviors by its argument: form 0 blanks the region and overlays a small icon, form 1 just blanks it, and any other value folds (form − 2) into the mid bits of a complemented tile code over a fixed high base (0xc0) and stamps four 2x2 blocks across those four corners, the seed advancing by four codes per block.

blankTileBlock4x4 [code] does the blanking: it writes the blank-block tile 0x40 into four rows of four cells starting at loc_51da, stepping one full row-block (32 cells) between row starts. blank4x4AndDraw2x2Icon [code] is form 0 — it blanks that 4x4 region and then overlays a 2x2 block seeded with tile 96 at loc_51fc, returning the advanced tile/pointer.

### Vertical-column repainting

A separate pair of primitives repaints the game's decorative vertical tile-columns, walking *up* the screen. drawTileColumnTriple [code] copies three source bytes up one column: each byte lands at the destination, whose low address byte then steps up one row (−32) while the page's high byte stays fixed, so the walk wraps within its page; after the three cells the low byte advances by 98 to line up the start of the next column. It returns the advanced source pointer and destination (and the next low byte in A) so successive columns can be chained. blankTileColumns [code] is the erase form: for each of B columns it stamps the blank tile 16 into three cells stepping up one row each, then advances 98 to the next column, looping until the column count wraps to zero. A subtle current difference between the two: drawTileColumnTriple's upward row step is a byte-only −32 that stays inside the fixed page, whereas blankTileColumns' upward step is a true 16-bit −32 that can borrow into the high byte.

redrawTileColumnsPeriodically [code] drives both, gated by a running column count in DRAWN_COLUMN_COUNT (0x4241) and the frame phase. Fewer than two counted columns and it does nothing; otherwise it works on count − 1 columns. It reads the frame counter loc_425f and looks at its low six bits: on phase 0 it wipes the columns with blankTileColumns, and only on phase 32 (the halfway point of the 64-frame cycle) does it redraw them — every other phase is a no-op, so the columns are erased and repainted once each per cycle. On the draw phase the first column is sourced from a row of TILE_COLUMN_TABLE (0x039a) picked by the frame counter's top two bits and drawn into the column start at loc_5193; the remaining columns stream from the continuation table TILE_COLUMN_TABLE_CONT (0x03a6), each draw threading its returned source and destination into the next.

### Full-row screen-clear sub-state steppers

Several sequence sub-states progressively fill or clear the tilemap a row at a time, driven by the fill cursor VRAM_WRITE_PTR (0x400b), the sequence step index SEQUENCE_STATE (0x400a), and the two dwell tiers loc_4008 and loc_4009. primeVramFillAndAdvanceStep [seen] is the setup step: it clears the 128-byte flag block at FLAG_BITS_BASE (0x4100) and the two status bytes loc_425f and loc_4224, points the write cursor two cells into the grid (VRAM_BASE + 2), arms the page/dwell counter loc_4009 to 32, and increments the sequence step.

fillVramRowThenResetObjectState [seen] paints a 28-cell strip of tile 16 at the cursor each frame and steps the cursor a full 32-cell row on, then ticks the dwell tier loc_4009; while it is still counting down it simply returns. On expiry it advances the sequence step, re-arms the two-tier dwell cascade (loc_4008 = 64, loc_4009 = 4), clears the 48-byte active-object block at OBJ_ACTIVE_FLAG (0x4200), clears both screen-flip latches FLIP_SCREEN_X (0x7006) and FLIP_SCREEN_Y (0x7007) and the direction byte loc_4018, raises the status flag loc_4238, and reseeds the object-shadow field from the ROM template OBJ_SHADOW_RESEED_TEMPLATE (0x1db1).

blankVramRowThenResetSpriteState [code] is the parallel state that clears rather than fills for the sprite side: it clears a strided table, blanks a 28-cell row of tile 16 at the cursor, steps the cursor one row on, and ticks loc_4009. On dwell expiry it advances the sequence step, clears the whole 256-byte object-source block at SPRITE_SOURCE_OBJ_BASE (0x42b0) and the 64-byte sprite shadow at SPRITE_SHADOW_BASE (0x4060), re-arms the two-tier dwell, reseeds the object shadow from ROM, and queues command word 6. blankScreenRowsThenAdvanceSequence [code] is the leaner play-state clear: it blanks a full 32 cells of tile 16 at the cursor, stores the advanced cursor back, and ticks the phase counter loc_4009; while phases remain it returns, and on the final phase it advances the sequence state and reseeds the object shadow. Note that these row steppers all use tile 16 as their fill/blank code, distinct from the 0x40 blank used inside the 4x4 block.

### Projectile integration and hit testing into the sprite shadow

advanceAndRenderProjectiles [code] both moves and renders the seven moving-object records that begin at loc_4260. Each record is ten bytes seen as two five-byte sub-slots, and the low bit of the frame counter loc_425f selects which sub-slot leads this frame; when it is clear the routine first bumps the leading sub-slot's sub-position by two and shifts its starting record so the *other* sub-slot leads. Within a five-byte sub-slot, byte 0's low bit marks it active, byte 1 is the sub-position (the on-screen Y source), bytes 2 and 3 are the 16-bit integrated position, and byte 4 is the signed per-frame velocity. For an active leading sub-slot it advances the sub-position by two (deactivating on overflow), integrates the 16-bit position by twice the sign-extended velocity, and deactivates the slot when the position leaves the vertical window (high byte plus 0x10 folding below 0x20); deactivating zeros the active, sub-position, and high bytes. It then writes the sprite's Y and code into the sprite shadow at loc_4081 (four-byte entries), mirroring Y and flipping the sign of the code nudge according to the direction flag loc_4018, with a plus-or-minus-one code adjustment applied to the first three of the seven records. After each record it steps past the leading sub-slot, bumps the trailing sub-slot's sub-position by two, and moves to the next record and sprite entry.

The same records are reused as fourteen five-byte collision entries by the hit tester. flagProjectileHitsOnPlayer [code] first checks the projectile-enable bit (low bit of OBJ_ACTIVE_FLAG, 0x4200) and returns immediately when projectiles are off; otherwise it walks all fourteen entries at loc_4260 with a stride of five, calling the per-entry test with a Y-band delta fixed at that stride value of 5. flagProjectileHitOnPlayer [code] runs the per-entry box test: it skips inactive entries (byte 0's low bit clear), reads the player-X reference from loc_4202, forms the X distance to the entry's X (byte +3) and a Y value shifted by 31 from the entry's Y (byte +1), and branches on a near/far band. In the far band it registers a hit when the biased X distance falls within the band delta; in the near band it first requires the shifted Y to sit within nine units, then registers a hit when the X distance falls within eleven. On a hit it deactivates the struck entry (byte 0 = 0) and raises HIT_EVENT_FLAG (0x4204).

Finally, loc_090b is a deliberately unnamed, pure-stack epilogue — it merely restores HL and returns, carrying no logic of its own, and so is shared as a common exit point rather than being a drawing primitive.

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
  climbs.
