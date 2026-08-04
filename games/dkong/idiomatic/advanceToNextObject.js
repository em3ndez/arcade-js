// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextObject — step the per-object scan on to the next object's records.
 *
 * The shared tail of the per-object update loop. However an object is processed — active,
 * inactive, or in its rise/deactivate state — every path converges here to move both scan
 * cursors forward by one record: the main object-record cursor by its 16-byte stride, and
 * the paired sprite/animation-record cursor by its 4-byte stride. The loop then tests its
 * remaining-object count and, while any remain, re-enters at the next object with these
 * advanced cursors.
 *
 * This routine writes NO memory: it only advances the two scan cursors, preserves the
 * remaining-object count the loop is about to test, and leaves 4 behind as the current step
 * amount. The loop holds the cursors and the count and consumes them on its next pass, so
 * these values are handed back in registers, the same way the loop supplies them.
 *
 * The 4 left as the step amount is loop scratch — the loop reloads its own step before the
 * next advance, so nothing downstream reads it.
 *
 * LIVE-OUT: registers, NOT memory: the two advanced scan cursors, the preserved
 * remaining-object count, and the leftover step value. The step's residual arithmetic flags
 * are dead; the loop overwrites them before its next test. The 16- and 4-byte strides are
 * the object- and sprite-record sizes of the scan, structural constants of the loop.
 */

/**
 * @param {object} m  the machine (uses m.regs only — no memory access).
 * @returns {void}
 */
export function advanceToNextObject(m) {
  const { regs } = m;

  // Advance both scan cursors by one record: the object record (16 bytes) and its
  // paired sprite/animation record (4 bytes). Each cursor wraps at 16 bits.
  regs.ix = regs.ix + 16;
  regs.iy = regs.iy + 4;

  // Leave 4 behind as the current step amount. Loop scratch: the loop reloads its own
  // step before the next advance, so nothing reads this.
  regs.de = 4;
}
