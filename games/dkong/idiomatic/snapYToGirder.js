// SPDX-License-Identifier: GPL-3.0-only
/**
 * snapYToGirder — nudge a coordinate one pixel along the 25m girder slope. ROM 0x2333.
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
 * Shared by every 25m (BOARD == 1) mover: Mario's Y-snap (advanceMarioWalkX) and the object
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
 *           dead ABI; the whole-machine gate backstops that). The wired address takes
 *           H/L/B and returns the coordinate in L; see the seam entry below.
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

/**
 * The SEAM ENTRY for ROM 0x2333 — `ROUTINES[0x2333].entry`, the export the override
 * resolvers wire. The seam dispatches an override as `fn(m)`, one argument; the pure
 * function above keeps its `(x, y, step)` shape for its direct idiomatic callers
 * (loc_33c3, advanceMarioWalkX) and for its exhaustive gate.
 *
 * ★ THIS ENTRY IS WHY THE `entry` FIELD EXISTS. Without it the registry wired
 * `snapYToGirder` itself at 0x2333, the seam called it as `snapYToGirder(m)`, `x` was the
 * Machine and `y`/`step` were undefined — `x % 16` is NaN, both boundary tests failed, and
 * it returned `undefined` having written nothing. That degrades to a silent no-op which
 * HAPPENS to match the oracle's frequent early-out, so it looked correct: measured over a
 * 1500-frame run the oracle moved L on 71 of 1301 dispatches and the wired version on 0 of
 * 1146. It was the full flip's wall at frame 710.
 *
 * ABI, read off the frozen oracle (translated/loc_2333.js, ROM 0x2333-0x236D):
 *
 *     2333  3e 0f / a4     ld a,0x0f / and h    ; H is the cross-axis coordinate
 *     2336  05             dec b                ; B is the step selector
 *     ...   (the cell-boundary tests, then the +-1 slope move)
 *     235a  6f / c9        ld l,a / ret         ; the corrected coordinate lands in L
 *
 *   IN:   H = x (the mover's cross-axis position), L = y (the coordinate corrected),
 *         B = step. This is exactly the tuple loc_33c3 loads before its `call 0x2333`
 *         (`ld h,(ix+0x0e) / ld l,(ix+0x0f) / ld b,(ix+0x0d)`), which is the ABI's
 *         independent confirmation: H/L/B in, L out, and the caller stores L back.
 *   OUT:  L = the corrected coordinate. Both early-outs (`ret c` at 0x233C, `ret nc` at
 *         0x2344) and both hold arms (0x2365, 0x2369) return with L UNCHANGED, which the
 *         pure function expresses by returning `y` — so assigning the result to L
 *         unconditionally is faithful on every path.
 *   MEM:  nothing — a pure leaf.
 *
 * DEAD ABI, dropped deliberately: the oracle also leaves A, B and F. Rebuilding them
 * exactly would mean restating the routine's whole branch structure in the wrapper (the
 * five exit shapes each leave a different A and a different flag-setting instruction), so
 * they are dropped on call-site evidence instead. All three oracle call sites overwrite A
 * before reading it, and none reads B:
 *   loc_1cd2 (0x1CE5)  `ld a,l` at 0x1CE8, immediately.
 *   loc_1ff6 (0x2007)  `inc l` x3 then `ld a,l` at 0x200E.
 *   loc_33c3 (0x33D2)  stores L and rets, so A/F pass through to ITS caller — both of
 *                      which then write A before reading it: the 0x32AB call site resumes
 *                      at loc_3202's 0x3257 arm, which opens `ld a,(ix+0x13)`; the
 *                      fall-through entry from loc_33ad resumes at 0x323E, whose first act
 *                      is `call 0x298c`, and 0x298C sets A on every exit (its caller reads
 *                      the verdict with `cp 0x01`, which also rebuilds the flags).
 * The whole-machine gates stand behind that, and NOT vacuously: `swap_check --routines
 * 347,1783,2333,2ff0,3009` leaves every one of those callers TRANSLATED, so they consume
 * this entry's real register exit state, and it is transparent for 12000 frames.
 */
export function snapYToGirderFromRegisters(m) {
  const { regs } = m;
  regs.l = snapYToGirder(regs.h, regs.l, regs.b);
}
