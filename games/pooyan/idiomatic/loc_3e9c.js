// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_4006 } from "./loc_4006.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { LANDING_ANIM_SEQ_40B4 } from "./names.js";
/**
 * loc_3e9c — in-flight mover for a spawned object. Ticks the object's animation, then moves
 * it by one of two modes chosen by bit 0 of the record's mode byte (rec+0x01):
 *
 *   - Waypoint mode (bit set): read a dx/dy pair from the script at rec+0x12:0x13 (a 0xee
 *     lead byte is a "loop here" marker that rewinds the pointer), subtract dx from the
 *     16-bit X (rec+0x06:rec+0x05) and add dy to the 16-bit Y (rec+0x04:rec+0x03). It lands
 *     once the Y high byte reaches the landing row.
 *   - Free mode (bit clear): advance the 16-bit X by the record's velocity (rec+0x12), then
 *     either home toward a target (rec+0x08 bit 0 set) or drift on a 4-frame cadence. Either
 *     way it lands once the X-region column and X sub-position cross the landing gate.
 *
 * Landing queues the settle animation and flips the object into the landing state.
 *
 * LIVE-OUT: memory only — the whole result lives in the object record. A per-frame state
 * handler reached from a table dispatch; no register is consumed by the caller.
 */
const MODE_WAYPOINT = 0x01; // rec+0x01 bit 0: waypoint script vs free flight
const LOOP_MARKER = 0xee; // script lead byte meaning "rewind to here next frame"
const LAND_ROW = 0x1e; // waypoint object lands once its Y high byte reaches this
const HOMING = 0x01; // rec+0x08 bit 0: home toward the target vs drift
const DRIFT_MASK = 0x03; // free-mode drift skips one frame in four
const COLUMN_MASK = 0x1f;
const TRIGGER_COLUMN = 0x1a; // (rec+0x06)&0x1f at/after which the free-mode land gate opens
const X_LAND_LIMIT = 0xa0; // free-mode object lands only while X sub-position is below this
const HOMING_MIN_STEP = 0x02; // homing stops when the vertical step falls under this

/** Queue the settle animation and re-arm the record into the landing state. */
function land(m, rec) {
  const { mem8 } = m;
  setActorAnimation(m, rec, LANDING_ANIM_SEQ_40B4);
  mem8[rec + 0x11] = 0x0a; // re-arm the frame timer
  mem8[rec + 0x02] = 0x02; // landing state
  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
}

/** Free-mode land gate: land only once the object has reached the trigger column and its X
 *  sub-position is close enough. */
function freeLandGate(m, rec) {
  const { mem8 } = m;
  if ((mem8[rec + 0x06] & COLUMN_MASK) < TRIGGER_COLUMN) return;
  if (mem8[rec + 0x05] >= X_LAND_LIMIT) return;
  land(m, rec);
}

export function loc_3e9c(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // tick the object's animation stream

  if (mem8[rec + 0x01] & MODE_WAYPOINT) {
    // -- waypoint mode: follow the dx/dy script --
    let ptr = mem8[rec + 0x12] | (mem8[rec + 0x13] << 8);
    const marker = mem8[ptr];
    if (marker === LOOP_MARKER) ptr = u16(ptr + 1);

    const dx = mem8[ptr];
    const xLo = mem8[rec + 0x05];
    mem8[rec + 0x05] = xLo - dx;
    if (xLo < dx) mem8[rec + 0x06] = mem8[rec + 0x06] - 1; // borrow into X high

    ptr = u16(ptr + 1);
    const dy = mem8[ptr];
    const ySum = mem8[rec + 0x03] + dy;
    mem8[rec + 0x03] = ySum;
    if (ySum > 0xff) mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // carry into Y high

    ptr = u16(ptr + 1);
    if (marker === LOOP_MARKER) ptr = u16(ptr - 3); // rewind to the loop marker
    mem8[rec + 0x12] = ptr;
    mem8[rec + 0x13] = ptr >> 8;

    if (mem8[rec + 0x04] < LAND_ROW) return; // still in flight
    land(m, rec);
    return;
  }

  // -- free mode: velocity + homing/drift --
  const velLo = mem8[rec + 0x12];
  const velHi = mem8[rec + 0x13];

  const xLo = mem8[rec + 0x05] + velLo;
  mem8[rec + 0x05] = xLo;
  if (xLo > 0xff) mem8[rec + 0x06] = mem8[rec + 0x06] + 1; // carry into X high

  if ((mem8[rec + 0x08] & HOMING) === 0) {
    // drift: nudge the vertical position on 3 of every 4 frames
    mem8[rec + 0x16] = mem8[rec + 0x16] + 1;
    if ((mem8[rec + 0x16] & DRIFT_MASK) === 0) return; // idle this frame

    const step = (velHi + 1) & 0xff;
    mem8[rec + 0x13] = step;
    const ySum = step + mem8[rec + 0x03];
    mem8[rec + 0x03] = ySum;
    if (ySum > 0xff) mem8[rec + 0x04] = mem8[rec + 0x04] + 1;
    freeLandGate(m, rec);
    return;
  }

  // homing: ease the vertical step toward the target
  if (velHi < HOMING_MIN_STEP) {
    // target reached: stop homing and zero the step
    mem8[rec + 0x08] = mem8[rec + 0x08] & ~HOMING;
    mem8[rec + 0x13] = 0x00;
    return;
  }
  const step = velHi - HOMING_MIN_STEP;
  const y = mem8[rec + 0x03];
  mem8[rec + 0x03] = y - step;
  if (y < step) mem8[rec + 0x04] = mem8[rec + 0x04] - 1; // borrow into Y high
  mem8[rec + 0x13] = step;
  freeLandGate(m, rec);
}
