// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextObject — step the per-object scan on to the next object's records.  ROM 0x2E78.
 *
 * The shared tail of the per-object update loop (entry_2e04). However an object is
 * processed — active, inactive, or in its rise/deactivate state — every path
 * converges here to move both scan cursors forward by one record: the main
 * object-record cursor by its 16-byte stride, and the paired sprite/animation-record
 * cursor by its 4-byte stride. The loop then tests its remaining-object count and,
 * while any remain, re-enters at the next object with these advanced cursors.
 *
 * This routine writes NO memory: it only advances the two scan cursors, preserves the
 * remaining-object count the loop is about to test, and leaves 4 behind as the current
 * step amount. It is a genuine boundary with the still-translated scan loop, which
 * holds the cursors and the count and consumes them on its next pass — so the values
 * are handed back the same way the loop supplies them, not through memory.
 *
 * The 4 left as the step amount is loop-scratch (the loop reloads its own step before
 * the next advance), reproduced here to match the oracle exactly rather than to be
 * consumed downstream.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e78.test.js.
 * GATE:     exhaustive over BOTH 16-bit cursor arms (each cursor swept over all 65536
 *           values, including the 16-bit wrap) with the other held at its real scan
 *           base, plus a cross-product grid over the exact in-game cursor sequence,
 *           a random combined-pair sample, an input-independence sweep, and real
 *           captured dispatches. Attract only ever takes the loop-skip arm, so the
 *           loop (and this tail) is reached by steering the game's own board/enable
 *           gates into the full 10-object pass, exactly as the loop does in play.
 * LIVE-OUT: registers, NOT memory (this routine writes none): the two advanced scan
 *           cursors, the preserved remaining-object count, and the leftover step
 *           value. The step's residual arithmetic flags are dead — the loop
 *           overwrites them before its next test.
 * NAMES:    none — touches no work RAM. The 16- and 4-byte strides are the object-
 *           and sprite-record sizes of the scan, structural constants of the loop.
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

  // Leave 4 behind as the current step amount, mirroring the oracle. Loop-scratch:
  // the loop reloads its own step before the next advance, so nothing reads this.
  regs.de = 4;
}
