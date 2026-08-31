// SPDX-License-Identifier: GPL-3.0-only
import { BLINK_PHASE } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fillByteRun } from "./fillByteRun.js";
/**
 * advancePairedDescendingObjectStep — advance one paired descending object by a single motion step.
 *
 * WHAT IT IS
 *   The per-record motion step for one descending object. A descending object is carried by two
 *   records that travel together: a primary "ix" record (the actor / motion half) and a paired "iy"
 *   record (its second half). Each frame the enemy driver sweeps eight such pairs and hands each pair
 *   to this routine, which moves that one object down a single step and decides what happens when its
 *   fall crosses key altitudes.
 *
 * ROLE IN THE MACHINE
 *   Part of the descending-object pipeline: paired objects enter high on the screen and fall. Both
 *   halves share the same layout — a 16-bit vertical position stored high-byte:low-byte at
 *   (rec+6):(rec+5) and a per-object fall speed at (rec+9). This routine subtracts the fall speed
 *   from each half's position once, then reads the PRIMARY object's high byte as an altitude band:
 *   a fixed mid-fall band arms a screen-wide "blink phase" signal, and reaching the floor (high
 *   byte 0) retires the whole object.
 *
 *   ROM 0x69c6.  Grounding: [seen].
 *
 * LIVE-OUT: memory only. It leaves the two stepped positions, and — depending on the primary
 * object's altitude — either a bumped blink-phase gate at BLINK_PHASE, or two wiped (retired)
 * records. The sweeping caller advances to the next pair on its own and reads no result back.
 */

const RECORD_SIZE = 0x18; //  bytes in one object record (also the length wiped when it retires)
const HIGH_AT_GATE = 0x06; // position high-byte value — a fixed mid-fall altitude — that arms the blink phase
const WIPE_FILL = 0x00; //    fill value that clears a retired record back to inactive

/**
 * stepPositionDown — lower one record's 16-bit vertical position by its own fall speed.
 *
 * The position is a pair of bytes read together as one 16-bit altitude: low byte at rec+5, high byte
 * at rec+6. The fall speed is a single byte at rec+9. Subtract the speed from the low byte; if that
 * underflows (drops below zero) borrow one from the high byte — exactly how a 16-bit subtraction
 * carries a borrow across the byte boundary — so the two bytes keep reading as one descending number.
 */
function stepPositionDown(mem8, rec) {
  const diff = mem8[rec + 5] - mem8[rec + 9];
  if (diff < 0) mem8[rec + 6] = mem8[rec + 6] - 1; // low byte underflowed: borrow one from the high byte
  mem8[rec + 5] = diff; //                            an 8-bit cell keeps only the low byte, so an underflow wraps up into 0x80..0xff
}

export function advancePairedDescendingObjectStep(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  // Gate on the primary record's own state before touching anything.
  // (ix+0) is the active flag: a zeroed record is an empty slot, so there is no object to move.
  if (mem8[ix + 0] === 0) return; //  record inactive
  // (ix+2) is the sub-state / busy field: while it is non-zero some other phase owns the object this
  // frame (e.g. a special action), and this plain descent step must stand aside.
  if (mem8[ix + 2] !== 0) return; //  sub-state busy

  // Advance the object's picture. The shared animation sequencer ticks the primary record's frame-hold
  // counter and, when it expires, loads the next tile/attribute from that object's animation script.
  advanceObjectAnimationFrame(m, ix);

  // Move both halves down one step. The paired (iy) half and the primary (ix) half each carry their
  // own position and fall speed, so each is lowered independently — which keeps the two locked together
  // on screen as the object falls.
  stepPositionDown(mem8, iy);
  stepPositionDown(mem8, ix);

  // Read the primary object's altitude band from the high byte of its position (ix+6) and branch on it.
  const high = mem8[ix + 6];
  // Mid-fall band 0x06: as an object passes this altitude it arms the screen-wide blink phase. The gate
  // at BLINK_PHASE (0x892b) is a one-shot — it is nudged from 0 up to 1 only while it still reads 0, so
  // several objects crossing the band cannot stack it past one. Having armed it, this step is done.
  if (high === HIGH_AT_GATE) {
    if (mem8[BLINK_PHASE] === 0) mem8[BLINK_PHASE] = mem8[BLINK_PHASE] + 1;
    return;
  }
  // Any other above-floor altitude: the object is still on its way down, so leave it descending.
  if (high !== 0) return; // still descending

  // High byte reached 0: the object has hit the floor of its fall and retires. Clear both of its
  // records — RECORD_SIZE bytes each, filled with WIPE_FILL — which zeroes the active flag at +0 of
  // each and releases both slots for the next spawn.
  fillByteRun(m, ix, WIPE_FILL, RECORD_SIZE);
  fillByteRun(m, iy, WIPE_FILL, RECORD_SIZE);
}
