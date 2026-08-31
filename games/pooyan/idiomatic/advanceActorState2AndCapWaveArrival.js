// SPDX-License-Identifier: GPL-3.0-only
import { loc_2c58 } from "./loc_2c58.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  STATE2_TILE_PAINT_VRAM,
  FIELD_ATTRIB_SRC_A,
  DISPLAY_CMD_0615,
  WAVE_ARRIVAL_COUNTER,
} from "./names.js";
/**
 * advanceActorState2AndCapWaveArrival — state-2 handler for an actor record in the 0x8a80 actor
 * array. ROM 0x2a01-0x2a31. Grounding: [seen].
 *
 * WHAT IT IS
 *   Every actor in the game is one fixed-size record inside the 0x8a80 actor array, and each frame
 *   the actor sweep re-dispatches a record on its own state byte (rec+0x02). The state values index
 *   the actor secondary-state jump table (0x28f1); this routine is entry 2 of that table — the
 *   handler a record runs while it sits in state 2. `rec` is the record being serviced (the machine
 *   points IX at it). The handler does four one-shot record edits, then runs an anti-tamper self
 *   check on a ROM table, and only on a clean check performs its two side effects and returns.
 *
 * ROLE IN THE MACHINE
 *   A single-frame "arrive and advance" step. It stamps the record into its state-2 appearance
 *   (reseated frame-hold dwell, flip bit set, a three-tile splash painted into the tilemap), moves
 *   the record on to the next state so it is serviced differently next frame, and — as the frame's
 *   book-keeping — announces the arrival to the display pipeline and clamps the per-stage wave
 *   arrival counter to its ceiling. The routine also doubles as a shared integrity gate: it folds a
 *   fixed ROM table and, if the fold does not total the expected value, treats the image as tampered
 *   and hands control to the hunter climb guard instead of finishing.
 *
 * LIVE-OUT (memory it leaves behind on the clean path)
 *   - rec+0x11 (frame-hold dwell)   = 8
 *   - rec+0x10 (flag byte)          bit7 (horizontal-flip) set
 *   - three tilemap cells at STATE2_TILE_PAINT_VRAM (0x875a..0x875c) = tile 0xbc
 *   - rec+0x02 (state byte)         incremented by one
 *   - one display command word 0x0615 queued into the display-command ring
 *   - WAVE_ARRIVAL_COUNTER (0x8903) clamped down to 8 once it would reach 9
 *   The tamper branch is a tail-jump, not a scan-loop abort, so the epilogue (the display command
 *   and the counter cap) runs ONLY on the clean fall-through. On the tamper branch the routine leaves
 *   whatever the hunter guard leaves and forwards that guard's caller-skip boolean unchanged; on the
 *   clean path it returns nothing.
 */

const HOLD_FIELD = 0x11; //   frame-hold / flag / state record offsets
const FLAG_FIELD = 0x10;
const STATE_FIELD = 0x02;
const FRAME_HOLD_RESEED = 0x08;
const FLIP_BIT = 0x80;
const TILE_RUN = 3;
const TILE_STATE2 = 0xbc;
const CKSUM_LEN = 0x20;
const CKSUM_TARGET = 1; //    valid 8-bit sum total
const ARRIVAL_CAP_TRIGGER = 0x09;
const ARRIVAL_CAP_VALUE = 0x08;

export function advanceActorState2AndCapWaveArrival(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Reseat the frame-hold dwell (rec+0x11) to 8. This is the countdown that keeps the record in its
  // current animation pose for a fixed number of frames before the next advance; state 2 restarts it
  // at 8 so the just-stamped appearance is held for eight frames. ROM 0x2a01 `ld (ix+0x11),0x08`.
  mem8[rec + HOLD_FIELD] = FRAME_HOLD_RESEED;

  // Set bit7 of the record's flag byte (rec+0x10) — the horizontal-flip bit consumed by the sprite
  // renderer, so the actor is drawn mirrored while in this state. ROM 0x2a05 `set 7,(ix+0x10)`.
  mem8[rec + FLAG_FIELD] |= FLIP_BIT;

  // Paint the state-2 splash: three consecutive tilemap cells starting at STATE2_TILE_PAINT_VRAM
  // (video RAM 0x875a..0x875c) all get tile code 0xbc. This is the fixed on-screen mark that appears
  // the frame the record enters state 2. ROM 0x2a09-0x2a12 (ld hl,0x875a; ld a,0xbc; three ld (hl),a).
  for (let i = 0; i < TILE_RUN; i++) mem8[STATE2_TILE_PAINT_VRAM + i] = TILE_STATE2;

  // Advance the record's state byte (rec+0x02) by one, so next frame the actor sweep dispatches this
  // record through the following jump-table entry instead of back here. ROM 0x2a13 `inc (ix+0x02)`.
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the state byte

  // Anti-tamper self check: fold the 0x20-byte ROM colour/attribute source table FIELD_ATTRIB_SRC_A
  // (0x0839) with a plain 8-bit running add. A genuine ROM sums to exactly 1; the machine adds the
  // block then decrements, expecting zero. ROM 0x2a17-0x2a20 (xor a; ld hl,0x0839; ld b,0x20; add
  // a,(hl) loop).
  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = (sum + mem8[FIELD_ATTRIB_SRC_A + i]) & 0xff;

  // If the fold does not total 1 the image has been altered: tail-jump into the hunter state-0 climb
  // guard (loc_2c58) and forward its result unchanged. That guard both drives the hunter climb and
  // returns a caller-skip boolean the dispatcher uses to abort its epilogue, so on this branch the
  // arrival book-keeping below is skipped entirely. ROM 0x2a21 `jp nz,0x2c58`.
  if (sum !== CKSUM_TARGET) return loc_2c58(m, rec); // tamper -> tail-jump the hunter guard

  // Clean check reached — do the arrival book-keeping.
  // Queue display command word 0x0615 into the display-command ring; the frame's display consumer
  // drains the ring and acts on it (the arrival's on-screen effect). ROM 0x2a24-0x2a28 (ld de,0x0615;
  // rst 0x38).
  enqueueDisplayCommand(m, DISPLAY_CMD_0615); // enqueue the arrival display command

  // Cap the per-stage wave-arrival counter WAVE_ARRIVAL_COUNTER (0x8903) at 8: it is bumped once per
  // enemy arrival elsewhere, and this handler holds its ceiling — the frame it would reach 9 it is
  // snapped back to 8. ROM 0x2a2b-0x2a31 (ld hl,0x8903; cp 0x09; ret c; ld (hl),0x08).
  if (mem8[WAVE_ARRIVAL_COUNTER] >= ARRIVAL_CAP_TRIGGER) mem8[WAVE_ARRIVAL_COUNTER] = ARRIVAL_CAP_VALUE;
}
