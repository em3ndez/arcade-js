// SPDX-License-Identifier: GPL-3.0-only

/**
 * Galaxian idiomatic-layer registry + the work-RAM/hardware names its decompiled routines read.
 *
 * resolveAllIdiomatic() reads ROUTINES: each 0xADDR maps to ./idiomatic/<name>.js exporting <name>,
 * wired OVER the translated oracle; a routine with no entry falls back to its frozen oracle.
 * This is §4 decompile batch 1 (leaves): routines keep loc_<addr> names — the understand pass renames.
 * Tag: [code] understood from the routines that touch the cell; grounding ([seen]) is a later pass.
 * Cells whose role two derivers read differently stay loc_<addr> placeholders (names-debt.txt).
 */

// Return-stack scratch window (measured §3; excluded from grounding write-attribution).
export const STACK_SCRATCH = { lo: 0x43e0, hi: 0x4400 };

// Hardware ports / discrete-sound latches (board-mapped).
export const IN0 = 0x6000; // [code] IN0 input port (read)
export const COIN_LOCKOUT = 0x6002; // [code] coin-lockout latch (D0 = coin_lock output)
export const COIN_COUNTER_0_LATCH = 0x6003; // [code] coin-counter 0 hardware output
export const SOUND_LFO_FREQ = 0x6004; // [code] discrete-sound LFO frequency latch base
export const SOUND_W_REG4 = 0x6804; // [code] discrete-sound write register 4
export const SOUND_W_REG5 = 0x6805; // [code] discrete-sound write register 5

// Tilemap VRAM.
export const VRAM_BASE = 0x5000; // [code] tilemap VRAM base
export const PLAYER2_STATUS_VRAM = 0x50e0; // [code] player-2 status tilemap cell
export const PLAYER1_STATUS_VRAM = 0x5340; // [code] player-1 status tilemap cell

// Work RAM.
export const RNG_SEED = 0x401e; // [code] 8-bit LCG PRNG seed
export const GAME_STATE = 0x4005; // [code] game state index (cleared by the fill re-seed)
export const SEQUENCE_STATE = 0x400a; // [code] top-level sequence state-machine step index
export const VRAM_WRITE_PTR = 0x400b; // [code] 16-bit VRAM fill write cursor
export const CURRENT_PLAYER = 0x400d; // [code] active player index (0/1)
export const PLAYER1_SCORE_BCD = 0x40a2; // [code] player-1 packed-BCD score (3 bytes)
export const PLAYER2_SCORE_BCD = 0x40a5; // [code] player-2 packed-BCD score (3 bytes)
export const MESSAGE_SCROLL_ENABLE = 0x40b0; // [code] message-scroller enable/countdown flag
export const SOUND_SEQ_ACTIVE = 0x41cd; // [code] sound-sequence active flag
export const SOUND_TONE_DURATION = 0x41ce; // [code] sound tone duration
export const SOUND_PITCH = 0x41c1; // [code] staged sound pitch value (fed to 0x7800)
export const SOUND_SEQ_PTR = 0x41d3; // [code] sound-sequence 16-bit pointer
export const OBJ_SWEEP_DIRECTION = 0x420d; // [code] object sweep direction flag (0=ascending, 1=descending)
export const SOUND_LFO_LEVEL = 0x421f; // [code] sound LFO level shadow

// loc_<addr> placeholders — role not yet consensus-confident; allowlisted in names-debt.txt, named at grounding.
export const loc_1e68 = 0x1e68;
export const loc_1edf = 0x1edf;
export const loc_4001 = 0x4001;
export const loc_4002 = 0x4002;
export const loc_4007 = 0x4007;
export const loc_4008 = 0x4008;
export const loc_4009 = 0x4009;
export const loc_401a = 0x401a;
export const loc_4021 = 0x4021;
export const loc_4028 = 0x4028;
export const loc_4195 = 0x4195;
export const loc_41b5 = 0x41b5;
export const loc_41c0 = 0x41c0;
export const loc_41cf = 0x41cf;
export const loc_41d1 = 0x41d1;
export const loc_41d2 = 0x41d2;
export const loc_41d6 = 0x41d6;
export const loc_41df = 0x41df;
export const loc_4208 = 0x4208;
export const loc_420b = 0x420b;

// batch 2 -- descriptive cells ([code], grounding pending)
export const SOUND_TONE_TABLE = 0x17a9; // [code] batch 2
export const SOUND_DURATION_TABLE = 0x17c8; // [code] batch 2
export const OBJ_STEP_TABLE = 0x1a45; // [code] batch 2
export const STRIDED_TABLE_SRC = 0x1d71; // [code] batch 2
export const PATH_STEP_TABLE = 0x1e00; // [code] batch 2
export const MESSAGE_PTR_TABLE = 0x235c; // [code] batch 2
export const IN0_SHADOW = 0x4010; // [code] batch 2
export const IN1_SHADOW = 0x4011; // [code] batch 2
export const OBJ_STAGE_BLOCK = 0x4054; // [code] batch 2
export const MESSAGE_CURSOR_PTR = 0x40b1; // [code] batch 2
export const MESSAGE_TEXT_PTR = 0x40b3; // [code] batch 2
export const MESSAGE_DEST_PTR = 0x40b5; // [code] batch 2
export const FLAG_BITS_BASE = 0x4100; // [code] batch 2
export const OCCUPANCY_GRID = 0x4123; // [code] batch 2
export const ROW_OCCUPANCY = 0x41e8; // [code] batch 2
export const COLUMN_OCCUPANCY = 0x41f0; // [code] batch 2
export const OBJ_ACTIVE_FLAG = 0x4200; // [code] batch 2
export const HIT_EVENT_FLAG = 0x4204; // [code] batch 2
export const FORMATION_X_BOUNDS = 0x4210; // [code] batch 2
export const DELAYED_EVENT_REQUEST = 0x4229; // [code] batch 2
export const DELAYED_EVENT_ARMED = 0x422e; // [code] batch 2
export const DELAYED_EVENT_TIMER = 0x422f; // [code] batch 2
export const OBJ_MOVE_CMD = 0x423f; // [code] batch 2
export const OBJ_TABLE = 0x42d0; // [code] batch 2
export const DESCRIPTOR_SLOT_TABLE = 0x4330; // [code] batch 2
export const START_LAMP_0 = 0x6000; // [code] batch 2
export const START_LAMP_1 = 0x6001; // [code] batch 2
export const SOUND_W_REG0 = 0x6800; // [code] batch 2
export const SOUND_W_REG1 = 0x6801; // [code] batch 2
export const SOUND_W_REG2 = 0x6802; // [code] batch 2
export const IRQ_ENABLE = 0x7001; // [code] batch 2
export const STARS_ENABLE = 0x7004; // [code] batch 2
export const SOUND_PITCH_W = 0x7800; // [code] batch 2
// batch 2 -- loc_ placeholders (role not yet consensus-confident)
export const loc_4006 = 0x4006;
export const loc_4013 = 0x4013;
export const loc_4014 = 0x4014;
export const loc_4018 = 0x4018;
export const loc_4020 = 0x4020;
export const loc_4081 = 0x4081;
export const loc_40a0 = 0x40a0;
export const loc_40ab = 0x40ab;
export const loc_4177 = 0x4177;
export const loc_41c2 = 0x41c2;
export const loc_41cc = 0x41cc;
export const loc_41d5 = 0x41d5;
export const loc_41ef = 0x41ef;
export const loc_4201 = 0x4201;
export const loc_4202 = 0x4202;
export const loc_4209 = 0x4209;
export const loc_420a = 0x420a;
export const loc_420e = 0x420e;
export const loc_4213 = 0x4213;
export const loc_4218 = 0x4218;
export const loc_4219 = 0x4219;
export const loc_421a = 0x421a;
export const loc_421b = 0x421b;
export const loc_4220 = 0x4220;
export const loc_4221 = 0x4221;
export const loc_4222 = 0x4222;
export const loc_4224 = 0x4224;
export const loc_4225 = 0x4225;
export const loc_4226 = 0x4226;
export const loc_422b = 0x422b;
export const loc_422c = 0x422c;
export const loc_422d = 0x422d;
export const loc_4245 = 0x4245;
export const loc_4246 = 0x4246;
export const loc_424a = 0x424a;
export const loc_425f = 0x425f;
export const loc_4260 = 0x4260;
export const loc_42b1 = 0x42b1;
export const loc_5193 = 0x5193;
export const loc_51da = 0x51da;

// Idiomatic overrides wired OVER the translated oracle (batch 1, leaves-first). Names stay loc_<addr>
// this pass; role is a [code] reading; cert lifts to "seen" at grounding.
export const ROUTINES = {
  0x003c: { name: "advanceRandomSeed", role: "[seen] advance the 8-bit LCG PRNG seed (RNG_SEED, 0x401e) one step (seed*5+1) and return the new byte as this frame's random draw", cert: "seen" },
  0x0322: { name: "enterSequenceStep1", role: "[code] RST-28 sequence-state handler: set SEQUENCE_STATE (0x400a) to 1 and arm the step-1 dwell cascade (0x4008/0x4009 = 3,3)", cert: "code" },
  0x0331: { name: "tickCascadeCountdown", role: "[seen] shared dec-and-carry timer tick: decrement the byte at HL; on expiry step to the next in-page byte and increment it. Both current callers pass HL=0x4009, carrying into SEQUENCE_STATE (0x400a)", cert: "seen" },
  0x050f: { name: "armStateAdvanceGate", role: "[code] store the armed marker (3) into gate byte 0x41b5, which the state handler loc_06d8 tests as nonzero to take its advance/proceed path", cert: "code" },
  0x0515: { name: "armSubstateAdvanceGate", role: "[seen] store the armed marker (3) into gate byte 0x4195, tested by the sub-state handler loc_07e8 to take its advance-and-show path", cert: "seen" },
  0x0598: { name: "seedObjectRamShadowField", role: "[seen] copy 32 bytes from a ROM template into one interleaved (stride-2) field of the OBJRAM shadow (0x4021,0x4023,...,0x405f) at screen/formation init", cert: "seen" },
  0x070e: { name: "reloadSequenceDwellTimer", role: "[code] re-arm the mid-tier sequence dwell timer (0x4009) to 0x50 (80 ticks) after the handler sets the next state", cert: "code" },
  0x08e5: { name: "clearGateOnPendingRequest", role: "[code] When request flag 0x420b bit0 is pending, acknowledge it (clear 0x420b) and clear the behavior gate 0x4208 that loc_0661/loc_090d test.", cert: "code" },
  0x090b: { name: "loc_090b", role: "[code] Shared stack epilogue of the loc_08f2 enqueue path: pop the caller's saved HL and return; no work-RAM effect.", cert: "code" },
  0x0972: { name: "broadcastToStridedTable", role: "[seen] Broadcast the byte in A across the 9-cell stride-2 work-RAM table at 0x4028 (0x4028,0x402a,...,0x4038).", cert: "seen" },
  0x097d: { name: "setSweepDescending", role: "[seen] Set object sweep-direction flag 0x420d (OBJ_SWEEP_DIRECTION) to 1, switching the oscillator to its decreasing/descending phase; called by loc_090d when the swept 0x420e word reaches the upper bound.", cert: "seen" },
  0x0983: { name: "setSweepAscending", role: "[seen] Clear object sweep-direction flag 0x420d (OBJ_SWEEP_DIRECTION) to 0, switching the oscillator to its increasing/ascending phase; called by loc_090d when the swept 0x420e word reaches the lower bound.", cert: "seen" },
  0x0df6: { name: "commitMoveToTargetX", role: "[seen] Commit an object (IX record) to a horizontal move toward a chosen target X: store target X (ix+0x19), the signed per-frame step delta current-minus-target (ix+0x09), zero the move accumulator (ix+0x1a..0x1c), and advance the planner sub-state (ix+0x02).", cert: "seen" },
  0x10d8: { name: "settleObjectXAtRest", role: "[seen] Per-frame settle handler: step the object coordinate ix+0x04 up one count per frame until it lands within 5 of the rest value 0xc8 (200), then hold.", cert: "seen" },
  0x10f0: { name: "armObjectAnimAndRequestSound", role: "[code] Sub-state-0 entry of a deactivated object's animation: seed the animation timers, advance its sub-state, and post a position-keyed sound request", cert: "code" },
  0x113d: { name: "endObjectAnimOnTimerExpiry", role: "[code] Sub-state-2 tick of the deactivated-object animation: count the dwell timer down and clear the object's state flag when it expires", cert: "code" },
  0x1146: { name: "noopAnimDispatchSlot", role: "[code] No-op terminal slot (sub-state 3) of the object-animation dispatch table", cert: "code" },
  0x1292: { name: "bumpCountIfNeighborsInactive", role: "[code] Return the count incremented by one only when both look-ahead object slots are inactive, else unchanged", cert: "code" },
  0x15df: { name: "reloadExpiredCounterAndTally", role: "[seen] Reload one expired counter cell from its ROM table and return the refill tally incremented", cert: "seen" },
  0x16a6: { name: "driveDecayingSoundSweep", role: "[code] On alternate frames, emit the sweep countdown (rotated right two) to the discrete-sound register and tick it down, fading to silence", cert: "code" },
  0x1733: { name: "driveGatedSquareTone", role: "[code] Per-frame tick of a gated square-wave tone: run the duration counter down driving the toggled bit to the sound register, silence when spent", cert: "code" },
  0x1747: { name: "armSoundSequenceOnRequest", role: "[seen] Arm the gated sound sequence on an outstanding request: clear the request gate, raise the active flags, and publish the sequence-data pointer (SOUND_SEQ_PTR).", cert: "seen" },
  0x1815: { name: "stageSoundPitch", role: "[seen] Stage a pitch byte into SOUND_PITCH, the shadow the per-frame sound driver latches to the pitch port.", cert: "seen" },
  0x183a: { name: "armSoundSequenceForSelector16", role: "[code] Dispatch arm for sound-request selector 0x16: clear its sub-flag, raise SOUND_SEQ_ACTIVE and companion, and publish sequence pointer 0x1edf.", cert: "code" },
  0x186c: { name: "stagePitchAndRaiseSoundFlag", role: "[code] Stage pitch (A-1) into SOUND_PITCH and raise the 0x41c0 composite sound flag the driver latches to the sound registers.", cert: "code" },
  0x1886: { name: "advanceSoundPitchRamp", role: "[seen] Advance a rising sound-pitch ramp one step over a {countdown,pitch} pair: tick the countdown, add a fixed step to the pitch, publish it to SOUND_PITCH, and clear the 0x41c0 composite flag; idle when the countdown is drained.", cert: "seen" },
  0x18b2: { name: "broadcastSoundLfoLevel", role: "[seen] Save a sound LFO level to SOUND_LFO_LEVEL, then fan it (rotated right one bit per write) across the four SOUND_LFO_FREQ hardware latches.", cert: "seen" },
  0x18e8: { name: "endMessageScrollOnExpiry", role: "[seen] Tick a countdown at (HL) and, on the zero-crossing, clear MESSAGE_SCROLL_ENABLE (0x40b0) to stop the scroller.", cert: "seen" },
  0x1917: { name: "presetCreditCount", role: "[code] mode-3 branch of coin service loc_18ef: preset the credit count to 9 and clear the coin-phase flag", cert: "code" },
  0x1961: { name: "clampCreditsToMax", role: "[code] overshoot arm of the credit clamp: pin the credit counter back to its 99 ceiling", cert: "code" },
  0x1971: { name: "setCoinPhaseFlag", role: "[code] set arm of the coin-phase toggle: raise the coins-per-credit flag when the first coin of a pair is received", cert: "code" },
  0x1974: { name: "pulseCoinCounter", role: "[seen] drive the coin-counter output pulse and tick down its pulse-width timer", cert: "seen" },
  0x1989: { name: "clearCoinLockout", role: "[code] release the coin mechanism by clearing the coin-lockout latch", cert: "code" },
  0x1ceb: { name: "drawTextColumn", role: "[code] draw a run of characters down a VRAM column, mapping each source byte to a font tile (byte - 0x30)", cert: "code" },
  0x1d58: { name: "resetScreenFillState", role: "[seen] input-gated reset of the screen-fill state: rewind the VRAM write cursor to base, re-arm the full-page fill length, and clear the dispatch flag and game state", cert: "seen" },
  0x210a: { name: "markValueOutOfRange", role: "[code] Clamp's out-of-range arm: forces the fold index B to the fixed 0x80 sentinel when the input is beyond range.", cert: "code" },
  0x214e: { name: "selectPlayerStatusVram", role: "[code] Selects a player's status-column VRAM base (player 1 -> 0x5340, else player 2 -> 0x50e0), returned in HL.", cert: "code" },
  0x2279: { name: "drawBcdDigit", role: "[code] Paints one BCD digit as a font tile (digit+0x90) with leading-zero blanking, then advances the cursor.", cert: "code" },
  0x2290: { name: "selectCurrentPlayerScore", role: "[code] Selects the current player's 3-byte packed-BCD score field (player 1 -> 0x40a2, else player 2 -> 0x40a5), returned in DE.", cert: "code" },
  0x25a0: { name: "stampTilePair", role: "[code] Stamps a pair of consecutive tile codes into two adjacent cells ((HL)=A, (HL+1)=A+1), then steps HL by the stride and the tile code by two.", cert: "code" },
  0x25a9: { name: "drawDoubleHeightTile", role: "[code] Stamps the two halves of a double-height glyph: tile A at (HL) and tile+2 at (HL+0x20), one tilemap row apart; preserves DE.", cert: "code" },
  0x01c6: { name: "primeVramFillAndAdvanceStep", role: "[seen] Attract sequence-step setup: clears the 0x4100 flag-bits block (via rst-0x10) plus status bytes 0x425f/0x4224, seeds VRAM_WRITE_PTR (0x400b)=VRAM_BASE+2, arms the 0x4009 dwell tier to 32, and increments SEQUENCE_STATE (0x400a).", cert: "seen" },
  0x032e: { name: "tickSequenceDwellTimer", role: "[code] Sequence state handler: point HL at the 0x4009 dwell tier and tick the shared cascade countdown (tickCascadeCountdown, 0x0331) each frame, advancing SEQUENCE_STATE (0x400a) on the tier's expiry.", cert: "code" },
  0x0336: { name: "tickPrescaledSequenceTimer", role: "[seen] Prescaled sequence-dwell state: decrement sub-timer 0x4008 each frame; on wrap reload it to 0x3c and tick the 0x4009 dwell tier via tickCascadeCountdown (0x0331), advancing SEQUENCE_STATE on that tier's expiry.", cert: "seen" },
  0x0341: { name: "activateDescriptorSlot", role: "[seen] Activate one 32-byte descriptor slot at DESCRIPTOR_SLOT_TABLE (0x4330) + (number-1)*32: stamp [0]=1 (active), [1]=0, [2]=0x0d, [4]=0, [5]=0x0c, [7]=slot index; leaves [3]/[6] untouched.", cert: "seen" },
  0x0363: { name: "clearStridedTable", role: "[seen] Per-state reset: broadcast 0 across the 9-cell stride-2 work-RAM table at 0x4028 (0x4028,0x402a,...,0x4038) via broadcastToStridedTable (0x0972).", cert: "seen" },
  0x03af: { name: "drawTileColumnTriple", role: "[code] Render primitive: copy 3 source bytes up a VRAM tilemap column (dst low byte -0x20 per row within the fixed page), then advance +0x62 to line up the next column; returns advanced src (HL) and dst (DE/A) for chained column draws.", cert: "code" },
  0x03c0: { name: "blankTileColumns", role: "[code] Render primitive: blank a run of B tilemap columns starting at 0x5193, stamping BLANK_TILE (0x10) into 3 cells per column (HL -0x20 per row, 16-bit, borrows into the high byte), advancing +0x62 per column (djnz, 0->256).", cert: "code" },
  0x03d7: { name: "advanceGameStateOnCredit", role: "[code] RST continuation (pushed by loc_0156 as the post-dispatch return): when credit count 0x4002 != 0, advance GAME_STATE (0x4005) and reset the attract sub-state cluster — clear 0x4007, SEQUENCE_STATE (0x400a), 0x41c2, sound-sweep 0x41df, and MESSAGE_SCROLL_ENABLE (0x40b0); zero credits = no-op", cert: "code" },
  0x0473: { name: "driveStartButtonLamps", role: "[code] RST-28 state idx 3: drive the two start-button lamp latches (0x6000/0x6001) from the credit/start count 0x4002, gated on 0x425f bit5 — bit5 clear clears both lamps; else 0 credits leaves them, 1 credit lights lamp0, >=2 lights both", cert: "code" },
  0x0550: { name: "initPlayfieldState", role: "[code] play-state sub-state-0 init (dispatched by loc_0536 state 3 and loc_077b state 4): clear both start lamps, zero-fill work-RAM spans (0x4100-0x417f, 0x4200-0x422f, 0x4260-0x42a5), set 0x425f=0 and 0x4226=1, advance SEQUENCE_STATE (0x400a), arm dwell 0x4009=0x20, and point the VRAM fill cursor 0x400b at 0x5000", cert: "code" },
  0x0595: { name: "seedObjectShadowFromRom", role: "[seen] seed the interleaved (stride-2) OBJRAM-shadow field 0x4021,0x4023,...,0x405f from ROM template 0x1d71 at screen/formation init — sets HL=0x1d71 and delegates to seedObjectRamShadowField", cert: "seen" },
  0x0646: { name: "unpackBitmaskToFlagBytes", role: "[seen] unpack a 16-byte packed bitmask at (DE) into 128 one-byte-per-bit flags at FLAG_BITS_BASE (0x4100), LSB-first — write 1 for a set bit, 0 for a clear one; returns DE advanced past the 16 mask bytes", cert: "seen" },
  0x070d: { name: "advanceSubstateAndReloadDwell", role: "[code] advance the sub-state counter at (HL) (both callers pass HL=SEQUENCE_STATE 0x400a) then re-arm the mid-tier dwell timer via reloadSequenceDwellTimer (0x070e -> 0x4009=0x50)", cert: "code" },
  0x0764: { name: "packFlagBytesToBitmask", role: "[code] pack bit0 of the 128 flag bytes at FLAG_BITS_BASE (0x4100), LSB-first, into a 16-byte bitmap at (DE); returns DE advanced +16 for a chained block copy (exact inverse of unpackBitmaskToFlagBytes)", cert: "code" },
  0x0837: { name: "moveControlledObjectAndStageSprite", role: "[code] When active, step the input/AI-controlled object one unit along its axis (clamped to [23,233]); when inactive, park position at 0 or stage current position under the alternate code; then stage the negated position + code as four (value,code) pairs into OBJ_STAGE_BLOCK.", cert: "code" },
  0x08bc: { name: "advancePlayerShot", role: "[code] Drive the single player shot: while the gate (0x4208 bit0) is armed, drain the position counter (0x4209) by 4/frame and raise the retire flag (0x420b) as it lands in the near-end window [14,17]; when idle, reset the counter to 220 (parked at the bottom) and seed the field (0x420a) from the player X (0x4202).", cert: "code" },
  0x0908: { name: "commitQueueWriteHead", role: "[seen] Persist the advanced write-head index (0x40a0) back to the command/event queue after an enqueue, then return via the shared stack epilogue loc_090b.", cert: "seen" },
  0x096f: { name: "broadcastNegatedSweepToStridedTable", role: "[seen] Compute the two's-complement of the formation-sweep low byte (L) and broadcast it across the strided work-RAM table 0x4028,0x402a,...,0x4038 via broadcastToStridedTable.", cert: "seen" },
  0x098e: { name: "summarizeFormationOccupancy", role: "[seen] Reduce the occupancy grid (0x4123) into per-row OR summaries (ROW_OCCUPANCY 0x41e8, behind 2 guard cells) and per-column OR summaries (COLUMN_OCCUPANCY 0x41f0, behind 3 guards), derive the horizontal sweep bound pair scanned inward from each end into FORMATION_X_BOUNDS (0x4210), and fold four region-clear flags (0x4220/0x4221/0x4225/0x4226) from the row summaries and two object-table columns.", cert: "seen" },
  0x0a32: { name: "armBehaviorGateOnInputOrTimer", role: "[code] When enabled (OBJ_ACTIVE_FLAG 0x4200 bit0 set) and not already armed (0x4208 bit0 clear): on the timer path (0x4006 bit0 clear) arm the gate 0x4208 only when the low 5 bits of 0x425f are zero (~every 32 frames); on the input path (0x4006 bit0 set) test bit4 of the selected input shadow (0x4010/0x4011 via 0x4018) masked by its guard (0x4013/0x4014) and, if active, arm both the gate 0x4208 and companion flag 0x41cc.", cert: "code" },
  0x0a74: { name: "advanceAndRenderProjectiles", role: "[code] Integrate and render the 7 moving-object records at 0x4260 (each two 5-byte sub-slots; a phase bit 0x425f picks the leading sub-slot): advance sub-position (deactivate on overflow), integrate the 16-bit position by 2x the signed velocity, deactivate when it leaves the vertical window, and write each sprite's Y and code into the sprite shadow at 0x4081 (mirrored by direction flag 0x4018, +/-1 code nudge on the first three).", cert: "code" },
  0x0b8d: { name: "flagProjectileHitOnPlayer", role: "[code] Per-entry collision test: for an active enemy-shot entry (bit0 of byte0), box-test entry X vs the player-X reference (loc_4202) and entry Y across a near/far band; on overlap deactivate the entry (byte0=0) and raise HIT_EVENT_FLAG (0x4204)=1.", cert: "code" },
  0x0c20: { name: "renderObjectSprite", role: "[seen] Build one hardware sprite record (Y,attr,sprite#,X) at IY from the object struct at IX: active (byte0 bit0) copies position (X=objX-8, Y=~objY-yOffset) and folds the signed heading (ix+5) into a display attr added to base attr (ix+0f); secondary-active (byte1 bit0) uses fixed sprite#7 + alt attr (ix+12); both clear parks the sprite off-screen (248,248).", cert: "seen" },
  0x0d71: { name: "advanceObjectPathStep", role: "[code] Object-AI state-1 handler: walk the per-object cursor (ix+19) through PATH_STEP_TABLE (0x1e00), add the delta pair to Y (ix+3) then direction-controlled X (ix+4, dir bit ix+6 bit0); if X (plus 7px margin) crosses the near edge force state (ix+2)=5 (fall-away); else advance cursor, tick throttle (ix+16, reload 4) and on expiry nudge cross-step (ix+5) and tick leg counter (ix+17), advancing state when the leg finishes.", cert: "code" },
  0x0f3c: { name: "homeObjectXTowardPlayer", role: "[code] Object-AI state-7 handler: bump frame counter (ix+3); steer the object's 16-bit X:subpixel pair (ix+4 high, ix+9 low) by ~4x the signed distance to the target-X reference loc_4202 (with the rounding bias) each frame; advance state (ix+2) when the dwell timer (ix+16) reaches 0.", cert: "code" },
  0x1060: { name: "advanceObjectPathStepAscending", role: "[code] Ascending/mirrored path-walk arm: add the PATH_STEP_TABLE byte at HL to Y (ix+4) and advance the walk cursor; tick the move throttle (ix+16), and on expiry step the heading (ix+5) and tick the leg counter (ix+17); on leg finish advance the dispatch state (ix+2) and reload throttle=3, leg=12, heading=244, cursor=0.", cert: "code" },
  0x109b: { name: "initObjectPhaseSteps", role: "[seen] Object-AI state-13 entry: derive step count n=(~seed[ix+7])&3; write n+1 to step-count (ix+22) and code byte ((n+1)<<4)+140 to ix+3; arm phase timer (ix+16)=24; advance sub-state (ix+2); clear ready flag (ix+15) then re-arm it (=24) only when n==0.", cert: "seen" },
  0x1112: { name: "tickDeactivatedObjectAnim", role: "[code] Sub-state-1 tick of the deactivated/dying object animation: count the fast timer (ix+16) down, reloading it (=4) and bumping the companion (ix+18) on elapse; then the slow timer (ix+17); on slow elapse either retire the object (state byte ix+1=0) or — when the position field ix+7>=112 — reload fast=50, seed the companion from global loc_422d+32, and advance the sub-state (ix+2).", cert: "code" },
  0x1147: { name: "positionObjectFromGridCell", role: "[code] Unpack an object's packed grid-cell (record+7) into its position fields, matching the grounded render convention (renderObjectSprite): row bits set the X field record+3=124-3/4*row; column bits set the Y field record+4=formation anchor(0x420e)+col*16+7. Display axes are rotated 90deg from the formation grid.", cert: "code" },
  0x116b: { name: "advanceObjectFlightCurve", role: "[code] Run ((record+0x18 seed)&3)+1 steps of a cross-coupled fixed-point rotation over two 16-bit accumulators in the object record (hi/lo at record+0x19/+0x1b and +0x1a/+0x1c), each step adding twice the other accumulator's sign-extended high byte with a high-byte==128 overflow-revert guard; the accumulator high bytes become the swoop/flight offset the dive AI adds to screen Y.", cert: "code" },
  0x14f3: { name: "rampCounterToCeiling", role: "[code] Gated two-tier prescaler (outer 0x4218 reload 60 -> inner 0x4219 reload 20): while OBJ_ACTIVE_FLAG(0x4200) bit0 set and inhibit 0x422b bit0 clear, step the 0..7 counter 0x421a up by one per double-wrap, clamped at 7 (a slow pace/difficulty ramp; loc_1637 resets 0x421a=0 on a stage advance).", cert: "code" },
  0x1555: { name: "scheduleDelayedEvent", role: "[code] Guarded (OBJ_ACTIVE_FLAG & 0x41ef bit0 set, inhibit 0x422b bit0 clear) two-tier timer that arms the delayed-event triple; mode bit 0x4006 clear -> on outer(0x4245,60)/inner(0x4246,5) cascade elapse arm fixed (DELAYED_EVENT_TIMER 0x422f=90, 0x424a=45, DELAYED_EVENT_ARMED 0x422e=1); mode set -> derive the payload from 0x4221 or the byte-sums of 0x4177/0x421a and fan it via rotations into the triple.", cert: "code" },
  0x15c3: { name: "fireDelayedEventRequest", role: "[code] Delayed one-shot: while DELAYED_EVENT_ARMED (0x422e) bit0 set, count DELAYED_EVENT_TIMER (0x422f) down each frame; on the zero tick disarm (one-shot) and, only if OBJ_ACTIVE_FLAG & 0x41ef bit0 both set, raise DELAYED_EVENT_REQUEST (0x4229).", cert: "code" },
  0x15f4: { name: "selectAttackerRowScan", role: "[code] Seed slot/base from alt flag 0x421b (nonzero -> slot 2/base 157, else slot 1/base 132), scan up to four two-byte slots of ROW_OCCUPANCY (0x41e8) advancing while neither byte of a slot has bit0 set, and store the resulting (slot index, base) pair into 0x4213 for the object-AI row scans (loc_0e2b/loc_0faf).", cert: "code" },
  0x1621: { name: "armFormationAdvanceTrigger", role: "[code] Gated one-shot: when both status gates 0x4220 and 0x4225 have bit0 set and the pending word 0x4222 is not already armed, write mem16[0x4222]=1 (enable byte=1, countdown 0x4223=0). loc_1637 later consumes this delayed one-shot to advance the stage/formation selector 0x421b (clamped 0..7), reseed the formation anchor 0x420e=1 and reset the pace counter 0x421a=0.", cert: "code" },
  0x1688: { name: "expireActivityGatedTimer", role: "[code] Gated countdown: while arm flag 0x422b bit0 is set AND an activity gate is open (0x4224!=0 || 0x4221!=0 || 0x4226 bit0), tick counter 0x422c and clear the arm flag 0x422b once it reaches zero -- ends an activity-gated timed phase.", cert: "code" },
  0x16b8: { name: "driveSoundVoicesFromOccupancy", role: "[code] On even frames (0x4007 bit0 clear) sum the 6x10 OCCUPANCY_GRID (0x4123, stride 16) into a tally seeded at 1, light min(tally,3) of the three sound-write latches SOUND_W_REG0..2 (0x6800-2) and zero the rest, then set the near-empty flag 0x4224 (=1 when tally<2, consumed by expireActivityGatedTimer).", cert: "code" },
  0x176c: { name: "advanceSoundSequenceChannel", role: "[code] Advance one sound-sequence channel (descriptor at HL): if active, stage 0x41c0=2 and publish current tone 0x41d5 -> SOUND_PITCH (0x41c1), tick duration 0x41d6; on expiry read next SOUND_SEQ_PTR byte (0xE0 deactivates the channel), else split it into a low-5-bit SOUND_TONE_TABLE index -> 0x41d5 and high-3-bit SOUND_DURATION_TABLE index -> 0x41d6, advancing the cursor.", cert: "code" },
  0x18e7: { name: "endMessageScrollOnExpiryFromDe", role: "[seen] DE-entry adapter to endMessageScrollOnExpiry (0x18e8): restore the countdown pointer from DE (ex de,hl) then tick it and clear MESSAGE_SCROLL_ENABLE (0x40b0) on the zero-crossing to end the message scroll.", cert: "seen" },
  0x1a12: { name: "accumulateObjectPositionWeight", role: "[code] Per-object contribution to accumulator B (register-compute, no memory write): skip unless object (IX) is active (byte0 bit0), Y in one of two 52-row bands from 128, and X delta from reference 0x4202 in the lower half; else fold flag bit7 + delta bits5-6 + band into a 0-15 index and add signed OBJ_STEP_TABLE[idx] (0x1a45) to B.", cert: "code" },
  0x1cb5: { name: "silenceSoundAndDisableIrqStars", role: "[code] Hardware quiesce: set the four SOUND_LFO_FREQ latches (0x6004-7)=1, clear the eight sound registers (0x6800-7), clear IRQ_ENABLE (0x7001) and STARS_ENABLE (0x7004), and drive SOUND_PITCH_W (0x7800)=0xff -- silences audio and halts the vblank interrupt + starfield.", cert: "code" },
  0x20cd: { name: "paintPlayerStatusColumn", role: "[code] Paint a 3-cell VRAM column from HL stepping by DE (top=code+1, middle tile 0x25, bottom tile 0x20) for the player-status indicator; then, only when flags(B) bit4 is clear and gate 0x4006==0, clear status flag 0x40ab.", cert: "code" },
  0x20e1: { name: "mapPackedCoordToVram", role: "[code] Map a packed coordinate byte to a tilemap-VRAM cell address (VRAM_BASE + (high<<8) + low); live-outs HL=cell addr, A=coord bits 6..5, carry=coord bit 4 (callers branch on it).", cert: "code" },
  0x2187: { name: "blankTileBlock4x4", role: "[code] Blank a 4x4 tile block in VRAM at 0x51da, writing BLANK_TILE(0x40) to four rows of four cells (row start stride 32).", cert: "code" },
  0x22f1: { name: "renderMessageColumn", role: "[seen] Message painter indexed by A: bit7 blanks the text column, bit6 records dest/text/cursor pointers + clears the column + arms MESSAGE_SCROLL_ENABLE, else draws each glyph up the column (stride -32) to the 63 terminator.", cert: "seen" },
  0x2569: { name: "byteToPackedBcd", role: "[code] Convert a binary byte to packed BCD -- value mod 100 as two decimal digits, tens in the high nibble and units in the low nibble -- returned in A.", cert: "code" },
  0x2585: { name: "drawTileBlock2x2", role: "[code] Draw a 2x2 tile block at HL from seed tile A via two stampTilePair calls -- top pair (A,A+1) then bottom pair (A+2,A+3) one tilemap row down; preserves DE.", cert: "code" },
  0x258c: { name: "drawBottomTilePairRestoreDe", role: "[code] Shared tail of the 2x2 tile-block writers: stamp the bottom tile pair via stampTilePair, then restore the caller's pushed DE from the stack and return.", cert: "code" },
  0x259e: { name: "drawFixedTilePairHorizontal", role: "[code] Stamp a horizontal tile pair from the fixed glyph code 0x2c (44) via stampTilePair, returning the advanced tile/pointer for the caller's loop.", cert: "code" },
  0x25a7: { name: "drawFixedTilePairVertical", role: "[code] Stamp a vertical (double-height) tile pair from the fixed glyph code 0x2c (44) via drawDoubleHeightTile -- seed at HL and the stepped code one tilemap row below.", cert: "code" },
};
