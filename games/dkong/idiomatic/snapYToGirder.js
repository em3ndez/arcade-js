// SPDX-License-Identifier: GPL-3.0-only
/**
 * snapYToGirder — nudge a coordinate one pixel along the 25m girder slope. ROM 0x2333.
 *
 * The 25m girders are not flat: each runs a shallow diagonal, so a body walking or
 * rolling across one has to shift its Y by one pixel every time its X crosses a
 * girder "cell" (a 16-px column) to stay glued to the slope. This routine is that
 * shift. It takes the cross-axis position `x` (the mover's X), the along-axis
 * coordinate `y` being corrected (the mover's Y), and a `step` selector, and
 * returns the corrected `y`.
 *
 *   - It only moves y at the instant x lands ON a cell boundary: x's low nibble is
 *     0 when step is 1, and 0x0F otherwise. Anywhere mid-cell, y is returned as-is.
 *   - Direction (up vs down the slope) is read from y itself: bit 5 of y picks +1
 *     vs -1 in the general band, with two hard-coded band-seam rails — y == 0xF0
 *     and y == 0x4C — that instead flip on x (the seam between girder bands).
 *
 * Shared by every 25m (BOARD == 1) mover: Mario's Y-snap (loc_1cd2) and the object
 * coordinate steppers (entry_33c3, shared_1ff6) — barrels follow the same slope.
 * A PURE LEAF: reads only its three inputs, writes no memory, calls nothing.
 *
 * Inputs are Z80 register bytes (0..255): x = H, y = L, step = B; result = L.
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
  // `dec b / jp z` — the oracle decrements the cross-axis step count and forks on
  // whether it just hit zero. Only step == 1 (dec -> 0) takes the "z" arm.
  const stepIsOne = ((step - 1) & 0xff) === 0;

  const lowNibble = x & 0x0f;
  let d; // the byte the slope step adds/subtracts below: +1 (0x01) or -1 (0xff)
  if (stepIsOne) {
    if (lowNibble >= 0x01) return y; // not on a cell boundary -> y unchanged
    d = 0x01;
  } else {
    if (lowNibble < 0x0f) return y; // not on a cell boundary -> y unchanged
    d = 0xff; // -1 as a byte
  }

  // Choose the slope direction and apply it. The ± is 8-bit, exactly as `add a,b`
  // / `sub b`, so d = 0xff subtracts as -1 and vice versa.
  if (y === 0xf0) {
    // Bottom band-seam rail: steps only in x's high half (bit 7 set), else holds.
    return (x & 0x80) ? (y - d) & 0xff : y;
  }
  if (y === 0x4c) {
    // Upper band-seam rail: steps only once x has crossed the 0x98 seam, else holds.
    return x < 0x98 ? y : (y + d) & 0xff;
  }
  // General band: bit 5 of y selects the slope direction (clear = +d, set = -d).
  return (y & 0x20) === 0 ? (y + d) & 0xff : (y - d) & 0xff;
}
