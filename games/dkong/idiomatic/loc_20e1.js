// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20e1 — send an object off at exactly one pixel per frame to the right, then hand its record
 * on to the shared launch tail.  ROM 0x20E1.
 *
 * The two bytes written are the record's 16-bit horizontal velocity, big-endian, in 1/256-pixel
 * units — whole pixels at +0x10, the fraction at +0x11 — so 1,0 is +1.0 px/frame. That reading is
 * fixed from OUTSIDE this routine, and either half of it could have come out the other way:
 * stepBallisticMotion (ROM 0x239C, already idiomatic) reads the same pair as the amount added to
 * the record's OBJ_X:+0x04 coordinate on every airborne frame, and it is called on this very record
 * by ROM 0x2053, the handler this arm hangs off; and on Mario's record those two offsets ARE
 * ram.js's live-grounded MARIO_AIR_VX_HI/MARIO_AIR_VX_LO (0x6210/0x6211), whose whole-pixel byte
 * carries the sign — 0x00 rightward, 0xFF leftward.
 *
 * The object then does it: over a 4000-frame attract run all 11 dispatches arrive at an
 * OBJ_ARRAY_67 record holding OBJ_X 16 and a leftward velocity of -0x00A0, and after every one of
 * them that record's OBJ_X climbs by exactly 1 per frame (16, 17, 18, … for the next 10 frames,
 * 11 times out of 11). The gate asserts that downstream, in a plain attract run.
 *
 * The only caller is ROM 0x20B5, still frozen. It tail-jumps here when the record's whole-pixel
 * velocity byte is nonzero and otherwise writes the mirror value (0xFF,0x00 = -1.0 px/frame)
 * itself; both arms then continue into the same tail at ROM 0x20C3.
 *
 * WHAT THIS DOES NOT CLAIM: why an object is sent right rather than left. Attract produces only the
 * one entry shape above, so the arm is only ever observed turning a leftward drift into a rightward
 * whole-pixel one — that is not enough to say the pair of arms is a direction flip in general, and
 * nothing here establishes what event puts a record into this state.
 *
 * Memory-equivalent to the frozen oracle — equivalence-20e1.test.js.
 * GATE:     captured + crafted + live. 0x20E1 IS naturally reached — 11 dispatches in a 4000-frame
 *           attract run, on 7 distinct OBJ_ARRAY_67 records — and ALL of them are replayed, with no
 *           sampling. Attract delivers exactly ONE entry shape (whole-pixel velocity 0xFF, fraction
 *           0xA0), which the gate asserts as a hole rather than leaving implied; the other shapes
 *           ROM 0x20B5 can arrive with, and a nudged record base, are 7 crafted entries built by
 *           poking a real captured state identically on both sides. The comparison is stronger than
 *           the usual contract because the frozen tail runs identically on both sides: RAM −
 *           STACK_SCRATCH, the whole ordered write sequence (STACK_SCRATCH included, so the excluded
 *           window is shown not to hide a difference), the entire exit register file, and the return.
 *           A whole-attract LIVE run (this routine wired at 0x20E1 for 4000 frames) is the live-out
 *           measurement below. Teeth: five broken twins, plus a value-neutral dropped store that
 *           only the write-sequence half catches, plus the uncharged-cycles case.
 * LIVE-OUT: memory, plus the propagated return value — and, unusually, nothing is DROPPED: this
 *           routine's own body writes no register and no flag (both stores take immediates), and
 *           every register visible at the exit is left by the frozen tail at ROM 0x20C3, which both
 *           sides run identically. So there is no dead-register claim to justify; the exit register
 *           file is byte-identical to the oracle's, and the gate asserts that outright rather than
 *           excluding it. DERIVED: 0x20E1 has exactly ONE caller in the whole lift, ROM 0x20B5 at
 *           ROM 0x20B9, which reaches it by a tail jump and propagates its return unread; that tail
 *           chain (0x20B5 <- 0x20A2 <- 0x2083 <- 0x2053 <- 0x1F93) never reads a register back
 *           either, and the tail at ROM 0x20C3 runs the object loop to its end and returns through
 *           ROM 0x1F92's `ret`. MEASURED: wired live for a 4000-frame attract run against the
 *           all-oracle baseline, the per-frame trace is byte-identical outside STACK_SCRATCH.
 * NAMES:    none imported. The record's +0x10/+0x11 have no ram.js name of their own — the named
 *           cells are Mario's copies of them — so they stay in-record offsets, as they do in
 *           stepBallisticMotion. One m.call remains: ROM 0x20C3, which has no idiomatic file yet
 *           and is being decompiled alongside this routine.
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
 *   pointer. It must equal that pointer while the tail at ROM 0x20C3 is frozen: that tail re-reads
 *   the pointer from the machine to reach the rest of the same record.
 */
export function loc_20e1(m, record = m.regs.ix /* oracle-boundary default: caller 0x20B5 still frozen */) {
  const { mem8 } = m;
  const at = (offset) => (record + offset) & 0xffff;

  mem8[at(VELOCITY_X_WHOLE)] = RIGHTWARD_ONE_PIXEL_WHOLE;
  mem8[at(VELOCITY_X_FRACTION)] = RIGHTWARD_ONE_PIXEL_FRACTION;

  // On into the shared tail, which rebuilds the vertical half of the launch from the same record.
  return m.call(0x20c3);
}
