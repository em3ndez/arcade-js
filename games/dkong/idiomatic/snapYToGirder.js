// SPDX-License-Identifier: GPL-3.0-only
/**
 * snapYToGirder — nudge a coordinate one pixel along the 25m girder slope.
 *
 * The 25m girders are not flat: each runs a shallow diagonal, so a body walking or
 * rolling across one has to shift its Y by one pixel every time its X crosses into a
 * new girder "cell" (a 16-px column) to stay glued to the slope. This routine is that
 * shift. It takes the cross-axis position `x` (the mover's X), the along-axis
 * coordinate `y` being corrected (the mover's Y), and a `step` selector, and
 * returns the corrected `y`.
 *
 *   - It only moves y at the instant x lands ON a cell boundary: the pixel offset
 *     within the 16-px cell is 0 when step is 1, and 15 otherwise. Anywhere mid-cell,
 *     y is returned unchanged.
 *   - Direction (up vs down the slope) is read from y itself: in the general band a
 *     single direction bit of y picks +1 vs -1, with two hard-coded band-seam rails —
 *     y == 240 and y == 76 — that instead flip on x (the seam between girder bands).
 *
 * Shared by every 25m (BOARD == 1) mover: Mario's Y-snap (loc_1cd2) and the object
 * coordinate steppers (entry_33c3, shared_1ff6) — barrels follow the same slope.
 * A PURE LEAF: reads only its three inputs, writes no memory, calls nothing.
 *
 * All three inputs are unsigned bytes (0..255) and the result is a corrected Y byte.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2333.test.js.
 * GATE:     exhaustive — pure total function; output vs oracle over all 131,072
 *           (x,y,step) combos, plus real captured 25m dispatches. Reached on 25m only.
 * LIVE-OUT: memory-only — the returned Y, the byte the caller stores back into a
 *           coordinate. No live registers/flags (the oracle's residual A/B/F are
 *           dead ABI; the whole-machine gate backstops that).
 * NAMES:    none — pure arithmetic on register inputs; references no RAM address.
 */
export function snapYToGirder(x, y, step) {
  // Only the step == 1 pass advances the slope; any other step leaves y alone
  // (unless x is right at the far edge of a cell, handled just below).
  const stepIsOne = step === 1;

  // Where x sits inside its 16-px girder cell (0..15).
  const cellOffset = x % 16;

  // The one-pixel slope move: +1 nudging one way along the run, -1 the other.
  let d;
  if (stepIsOne) {
    if (cellOffset !== 0) return y; // not on a cell boundary -> y unchanged
    d = 1;
  } else {
    if (cellOffset !== 15) return y; // not on a cell boundary -> y unchanged
    d = -1;
  }

  // Apply the one-pixel slope move. Two band-seam rails flip their direction on x
  // instead of on y's direction bit; the general band reads it straight out of y.
  // Every return keeps the coordinate within a single byte so it matches the
  // corrected Y exactly.
  if (y === 240) {
    // Bottom band-seam rail: steps only when x is in its high half, else holds.
    const xInHighHalf = x >= 128;
    return xInHighHalf ? (y - d) & 0xff : y;
  }
  if (y === 76) {
    // Upper band-seam rail: steps only once x has crossed the 152 seam, else holds.
    return x < 152 ? y : (y + d) & 0xff;
  }
  // General band: one direction bit of y picks which way to nudge along the slope
  // (clear -> add the delta, set -> subtract it).
  const addsAlongSlope = (y & 0x20) === 0;
  return addsAlongSlope ? (y + d) & 0xff : (y - d) & 0xff;
}
