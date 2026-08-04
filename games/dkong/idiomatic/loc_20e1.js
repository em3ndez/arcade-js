// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20e1 — send an object off to the right at exactly one pixel per frame, then hand its record
 * on to the shared launch tail.
 *
 * The two bytes it writes are the record's 16-bit horizontal velocity in 1/256-pixel units, whole
 * pixels first and the fraction after, so writing 1 and 0 is +1.0 pixels per frame. The whole-pixel
 * byte also carries the sign, and a positive one is rightward.
 *
 * WHAT THIS DOES NOT CLAIM: why an object is sent right rather than left. The sibling arm writes
 * the mirror value, but nothing in this file says what event puts a record into either state, and
 * the pair has not been shown to be a general direction flip.
 *
 * LIVE-OUT: the record's horizontal velocity in memory, plus the return value the shared tail
 * produces, which this routine passes straight back.
 */

// The record's 16-bit horizontal velocity: whole pixels first, then the 1/256-pixel fraction.
const VELOCITY_X_WHOLE = 0x10;
const VELOCITY_X_FRACTION = 0x11;

// What this arm sets it to: one whole pixel per frame, no fraction, positive (rightward).
const RIGHTWARD_ONE_PIXEL_WHOLE = 1;
const RIGHTWARD_ONE_PIXEL_FRACTION = 0;

/**
 * @param {object} m  the machine.
 * @param {number} record  the object record to launch, which arrives in the machine's record
 *   pointer. It must equal that pointer: the shared tail re-reads the pointer from the machine to
 *   reach the rest of the same record.
 */
export function loc_20e1(m, record = m.regs.ix) {
  const { mem8 } = m;
  const at = (offset) => (record + offset) & 0xffff;

  mem8[at(VELOCITY_X_WHOLE)] = RIGHTWARD_ONE_PIXEL_WHOLE;
  mem8[at(VELOCITY_X_FRACTION)] = RIGHTWARD_ONE_PIXEL_FRACTION;

  // On into the shared tail, which rebuilds the vertical half of the launch from the same record.
  return m.call(0x20c3);
}
