// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { LANDING_ANIM_SEQ_40B4 } from "./names.js";
/**
 * advanceInFlightEnemyAndLand — the "state 12" (0x0c) handler for a spawned object that is
 * currently in flight. Every moving thing on the playfield is an 0x18-byte record in the actor
 * arena, and each record runs its own little state machine off its state byte (rec+0x02). The
 * per-record dispatcher for the enemy-actor pool routes a record whose state is 0x0b/0x0c here:
 * an object that has finished spawning is travelling across the field toward the spot where it
 * will settle, and this routine is the per-frame step that carries it there and, at the right
 * moment, drops it into its landing state.
 *
 * ROLE IN THE MACHINE: it first advances the object's on-screen animation, then moves the object
 * one step, choosing between two entirely different flight models by bit 0 of the record's mode
 * byte (rec+0x01):
 *
 *   - WAYPOINT MODE (bit set): the object follows a canned dx/dy path. A little script somewhere
 *     in memory, pointed to by rec+0x12:0x13, holds packed (dx, dy) pairs; each frame consumes one
 *     pair, walking the pointer forward. A 0xee lead byte in the script is a "loop here" marker:
 *     it is skipped when read, and after the frame's pair is consumed the pointer is rewound so the
 *     same pair repeats forever — this is how a hovering / circling path is expressed. dx is
 *     SUBTRACTED from the 16-bit X (rec+0x06:rec+0x05, high:low) and dy is ADDED to the 16-bit Y
 *     (rec+0x04:rec+0x03, high:low). The object lands once its Y high byte reaches the landing row.
 *
 *   - FREE MODE (bit clear): the object flies under its own velocity. The 16-bit X advances by the
 *     record's stored velocity (rec+0x12), then the vertical motion is one of two behaviours picked
 *     by bit 0 of rec+0x08: HOMING (ease the descent step down toward the target, then stop) or
 *     DRIFT (nudge the Y downward, but only on three frames out of every four, for a gentler fall).
 *     Either way the object lands once it has crossed far enough across the field and its X
 *     sub-position has come in under the landing gate.
 *
 * Landing means: queue the settle animation and flip the record into its landing state so a
 * different handler takes over next frame.
 *
 * ROM ADDRESS: 0x3e9c-0x3f5b.  GROUNDING: [seen].
 *
 * LIVE-OUT: memory only — the entire result is written back into the object's own record (its
 * X/Y position, its script/velocity fields, and, on landing, its animation, timer and state
 * bytes). Nothing is handed back to the caller in a register; the per-frame sweep that reached
 * this record simply moves on to the next one.
 */
const MODE_WAYPOINT = 0x01; // rec+0x01 bit 0: 1 => follow the canned dx/dy waypoint script; 0 => free flight under velocity
const LOOP_MARKER = 0xee; // a 0xee lead byte in the waypoint script means "rewind to here next frame" (an infinite path loop)
const LAND_ROW = 0x1e; // waypoint object lands once its Y high byte (rec+0x04) reaches this tile row
const HOMING = 0x01; // rec+0x08 bit 0: 1 => home the descent toward the target; 0 => drift downward on a cadence
const DRIFT_MASK = 0x03; // free-mode drift acts on 3 of every 4 frames — it idles when (counter & 3) == 0
const COLUMN_MASK = 0x1f; // an actor's X high byte carries the tile column in its low 5 bits
const TRIGGER_COLUMN = 0x1a; // the free-mode land gate only opens once (rec+0x06)&0x1f has reached this column
const X_LAND_LIMIT = 0xa0; // ...and only while the X sub-position (rec+0x05) is still below this
const HOMING_MIN_STEP = 0x02; // homing stops once the vertical step would fall under this (target as good as reached)

/**
 * Land the object: queue the settle animation and re-arm the record into its landing state.
 * setActorAnimation seats the LANDING_ANIM_SEQ_40B4 descriptor so the object plays its settle
 * animation, then the header/state bytes are rewritten so that from next frame the record is a
 * fresh landed object rather than an in-flight one.
 */
function land(m, rec) {
  const { mem8 } = m;
  setActorAnimation(m, rec, LANDING_ANIM_SEQ_40B4); // seat the settle/landing animation sequence
  mem8[rec + 0x11] = 0x0a; // re-arm the record's frame-delay timer so the landing state has time to run
  mem8[rec + 0x02] = 0x02; // state byte -> 2: the landed state a later handler will service
  mem8[rec + 0x00] = 0x00; // header byte 0 cleared...
  mem8[rec + 0x01] = 0x01; // ...and byte 1 set to 1, so the two-byte presence header stays "live" but no longer flags waypoint mode
}

/**
 * Free-mode land gate. A free-flying object only settles once it has both travelled far enough
 * across the field (its tile column has reached the trigger column) and come in close on its X
 * sub-position (below the land limit). If either condition is not yet met the object keeps flying;
 * when both hold it lands. This gate is shared by the homing and drift paths below.
 */
function freeLandGate(m, rec) {
  const { mem8 } = m;
  if ((mem8[rec + 0x06] & COLUMN_MASK) < TRIGGER_COLUMN) return; // not far enough across the field yet -> keep flying
  if (mem8[rec + 0x05] >= X_LAND_LIMIT) return; // X sub-position still too far out -> keep flying
  land(m, rec); // both conditions met -> settle here
}

export function advanceInFlightEnemyAndLand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Always advance the object's on-screen animation first, independent of how it is moving this
  // frame — the tile/attribute stream keeps ticking whether the object is flying, homing or landing.
  advanceObjectAnimationFrame(m, rec); // tick the object's animation stream

  if (mem8[rec + 0x01] & MODE_WAYPOINT) {
    // -- waypoint mode: follow the dx/dy script --
    // The record stores a little-endian pointer at rec+0x12:0x13 into a script of packed (dx, dy)
    // pairs. Reassemble it into a single 16-bit address to read this frame's step.
    let ptr = mem8[rec + 0x12] | (mem8[rec + 0x13] << 8);
    // Peek the lead byte. A 0xee marks a loop point: skip past it to reach the real dx so the path
    // can be rewound later this frame and replayed indefinitely.
    const marker = mem8[ptr];
    if (marker === LOOP_MARKER) ptr = u16(ptr + 1);

    // --- horizontal step: SUBTRACT dx from the 16-bit X (rec+0x06:rec+0x05, high:low) ---
    const dx = mem8[ptr];
    const xLo = mem8[rec + 0x05];
    mem8[rec + 0x05] = xLo - dx;
    if (xLo < dx) mem8[rec + 0x06] = mem8[rec + 0x06] - 1; // borrow into X high

    // --- vertical step: ADD dy to the 16-bit Y (rec+0x04:rec+0x03, high:low) ---
    ptr = u16(ptr + 1); // advance the script pointer to the dy byte of this pair
    const dy = mem8[ptr];
    const ySum = mem8[rec + 0x03] + dy;
    mem8[rec + 0x03] = ySum;
    if (ySum > 0xff) mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // carry into Y high

    // --- advance past this pair, then apply the loop rewind and store the pointer back ---
    ptr = u16(ptr + 1); // step past the dy byte to the next pair
    if (marker === LOOP_MARKER) ptr = u16(ptr - 3); // rewind to the loop marker
    mem8[rec + 0x12] = ptr; // write the (possibly rewound) pointer back into the record, low byte...
    mem8[rec + 0x13] = ptr >> 8; // ...and high byte, ready for next frame

    // Landing check: the waypoint path lands the object once it has descended to the landing row,
    // i.e. once the Y high byte reaches LAND_ROW. Until then the object is still in flight.
    if (mem8[rec + 0x04] < LAND_ROW) return; // still in flight
    land(m, rec);
    return;
  }

  // -- free mode: velocity + homing/drift --
  // In free mode rec+0x12:0x13 are not a script pointer but a velocity: low byte is the horizontal
  // speed, high byte is the (evolving) vertical step used by the homing/drift paths below.
  const velLo = mem8[rec + 0x12];
  const velHi = mem8[rec + 0x13];

  // --- horizontal step: ADD the horizontal velocity to the 16-bit X (rec+0x06:rec+0x05) ---
  const xLo = mem8[rec + 0x05] + velLo;
  mem8[rec + 0x05] = xLo;
  if (xLo > 0xff) mem8[rec + 0x06] = mem8[rec + 0x06] + 1; // carry into X high

  if ((mem8[rec + 0x08] & HOMING) === 0) {
    // drift: nudge the vertical position on 3 of every 4 frames
    // rec+0x16 is a free-running cadence counter for this object. Bumping it and testing the low
    // two bits skips exactly one frame in four, so the object falls in gentle stutters rather than
    // smoothly every frame.
    mem8[rec + 0x16] = mem8[rec + 0x16] + 1;
    if ((mem8[rec + 0x16] & DRIFT_MASK) === 0) return; // idle this frame

    // On an active frame, grow the vertical step by one and store it back as the new vertical
    // velocity, then ADD that step to the 16-bit Y — so a drifting object accelerates downward.
    const step = (velHi + 1) & 0xff;
    mem8[rec + 0x13] = step; // remember the increased vertical step for next time
    const ySum = step + mem8[rec + 0x03];
    mem8[rec + 0x03] = ySum;
    if (ySum > 0xff) mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // carry into Y high
    freeLandGate(m, rec); // check whether the object has reached its landing spot
    return;
  }

  // homing: ease the vertical step toward the target
  // The high byte of the velocity is the current vertical step. Homing shrinks it each frame; once
  // it would fall below HOMING_MIN_STEP the object is close enough to its target that homing stops.
  if (velHi < HOMING_MIN_STEP) {
    // target reached: stop homing and zero the step
    mem8[rec + 0x08] = mem8[rec + 0x08] & ~HOMING; // clear the homing bit so future frames drift instead
    mem8[rec + 0x13] = 0x00; // zero the vertical step — no more vertical motion from homing
    return;
  }
  // Still homing: shrink the vertical step by HOMING_MIN_STEP and SUBTRACT it from the 16-bit Y,
  // so the object eases upward toward the target with a shrinking step (a decelerating approach).
  const step = velHi - HOMING_MIN_STEP;
  const y = mem8[rec + 0x03];
  mem8[rec + 0x03] = y - step;
  if (y < step) mem8[rec + 0x04] = mem8[rec + 0x04] - 1; // borrow into Y high
  mem8[rec + 0x13] = step; // store the shrunk vertical step back as the new velocity high byte
  freeLandGate(m, rec); // check whether the object has reached its landing spot
}
