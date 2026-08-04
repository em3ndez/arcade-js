// SPDX-License-Identifier: GPL-3.0-only
/**
 * snapYToGirder — nudge a coordinate one pixel along the 25m girder slope.
 *
 * The 25m girders are not flat: each runs a shallow diagonal, so a body walking or rolling across
 * one has to shift its Y by one pixel every time its X crosses into a new girder "cell" (a 16-pixel
 * column) to stay glued to the slope. This routine is that shift. It takes the cross-axis position
 * `x` (the mover's X), the along-axis coordinate `y` being corrected (the mover's Y), and a `step`
 * selector, and returns the corrected `y`.
 *
 *   - It moves y ONLY at the instant x lands on a cell boundary: the pixel offset within the
 *     16-pixel cell must be 0 when step is 1, and 15 otherwise. Anywhere mid-cell, y comes back
 *     unchanged.
 *   - Direction — up or down the slope — is read from y itself: in the general band a single
 *     direction bit of y picks +1 against -1, with two hard-coded band-seam rails, y == 240 and
 *     y == 76, that instead flip on x. Those are the seams between girder bands.
 *
 * A PURE LEAF: reads only its three inputs, writes no memory, calls nothing. All three inputs are
 * unsigned bytes and the result is a corrected Y byte.
 *
 * NOT CLAIMED: which physical girder run each band-seam rail joins. Both rails are hard-coded y
 * values with hard-coded x thresholds, and nothing in this file says which girders they sit between.
 *
 * LIVE-OUT: the corrected Y byte — the value the caller stores back into a coordinate.
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

/**
 * The SEAM ENTRY — the export the override resolver wires. The seam calls an override with the
 * machine as its one argument; the pure function above keeps its `(x, y, step)` shape for its
 * direct callers and for its exhaustive test.
 *
 * ★ THIS ENTRY IS WHY THE `entry` FIELD EXISTS. Without it the registry wired `snapYToGirder`
 * itself at this address, the seam called it with the machine as `x` and nothing as `y`/`step`,
 * `x % 16` was NaN, both boundary tests failed, and it returned `undefined` having written
 * nothing. That degrades to a SILENT NO-OP which happens to match the frequent early-out of the
 * routine it stands in for, so it looked correct: measured over a 1500-frame run, the routine it
 * replaces moved the coordinate on 71 of 1301 dispatches and the wired version on 0 of 1146.
 *
 * THE REGISTER CONTRACT. In: the cross-axis position and the coordinate being corrected arrive as
 * the two halves of one register pair, with the step selector alongside. Out: the corrected
 * coordinate, in the low half of that pair. Every early-out and both hold arms return that half
 * UNCHANGED — which the pure function expresses by returning `y` — so assigning the result
 * unconditionally is faithful on every path. Memory: nothing, a pure leaf.
 *
 * DEAD ABI, DROPPED DELIBERATELY. The hardware also leaves an accumulator, the step byte and the
 * flags. Rebuilding them exactly would mean restating the whole branch structure in this wrapper —
 * five exit shapes, each leaving a different accumulator and a different flag-setting instruction
 * — and no consumer was found for any of them: every call site overwrites the accumulator before
 * reading it, and none reads the step byte back.
 */
export function snapYToGirderFromRegisters(m) {
  const { regs } = m;
  regs.l = snapYToGirder(regs.h, regs.l, regs.b);
}
