// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3e99 — count how many board hazards crowd the probe point, and grade that count into a
 * four-level overlap code.
 *
 * The 25m arm of the board-overlap search. It clears the shared OVERLAP_COUNT, runs the
 * counting primitive over both hazard arrays in turn — ten records in OBJ_ARRAY_67, then five
 * in OBJ_ARRAY_64, both at a 32-byte record stride, accumulating into that one counter — and
 * reads the total back as a code: 0 overlaps → 0, exactly 1 → 1, exactly 2 → 3, 3 or more → 7.
 *
 * WHY 0/1/3/7 AND NOT 0/1/2/3 — the ladder is a UNARY MASK, not a number. Follow the value to
 * its last consumer and the odd steps stop looking arbitrary: a non-zero code is stored into the
 * effect selector, whose LOW BITS are then walked one at a time to pick which effect setter
 * runs. So 0 / 1 / 3 / 7 is zero / one / two / three bits set — the count expressed as a
 * thermometer the consumer can shift through, capped at three. A zero code makes the caller skip
 * the whole effect path.
 *
 * WHAT IS BEING PROBED. Both inputs arrive from the caller chain and pass through untouched, and
 * both are about Mario: the probe record is Mario's own record, so the horizontal coordinate the
 * counting primitive reads out of it is Mario's X, and the vertical coordinate is Mario's Y plus
 * twelve — twelve pixels LOWER on screen, i.e. below him rather than on him. The probe is a spot
 * near Mario, not Mario's own hitbox.
 *
 * THE BOUNDS WORD ARRIVES ON THE STACK, NOT IN A REGISTER, because the shared trampoline that
 * reaches this arm reuses the same register pair to recover its own table base. Lifting it back
 * off is the first thing this routine does, and the word is genuine data: its low byte is the
 * vertical tolerance and its high byte the horizontal one, tested against each record. The
 * caller picks between two of them on the player's two horizontal input bits — with a direction
 * held the horizontal tolerance widens from 5 to 19 pixels while the vertical one stays at 8, so
 * a walking Mario is asked about a much wider strip than a standing one. Dropping that lift
 * feeds the search a garbage window and silently changes every verdict.
 *
 * Both arrays share ONE counter deliberately — the second scan does not restart it — so the code
 * grades the total across both, not per-array.
 *
 * LIVE-OUT: OVERLAP_COUNT in memory, plus the graded code, which is both returned and left in
 * the accumulator for the caller chain. The chain's first act after this routine returns is to
 * re-test that value and store it into the effect selector, so the code is live and the flags
 * are not.
 */

import { OVERLAP_COUNT, OBJ_ARRAY_67, OBJ_ARRAY_64 } from "./names.js";
import { countObjectOverlaps } from "./countObjectOverlaps.js";

const GROUP1_RECORDS = 10; // records scanned in OBJ_ARRAY_67
const GROUP2_RECORDS = 5; // records scanned in OBJ_ARRAY_64
const RECORD_STRIDE = 32; // byte stride shared by both arrays

export function loc_3e99(m) {
  const { regs, mem } = m;

  // Lift the bounds word the dispatcher stacked across the trampoline: low byte = the vertical
  // tolerance, high byte = the horizontal one.
  const bounds = m.pop16();
  const verticalTolerance = bounds & 0xff;
  const horizontalTolerance = bounds >> 8;

  // Start the shared tally at zero; both scans accumulate into it.
  mem.write8(OVERLAP_COUNT, 0);

  // The probe point and its window are the same for both scans; only the array changes.
  const probe = {
    probeBase: regs.iy, // Mario's record — the counting primitive reads his X out of it
    probeA: regs.c, // the vertical coordinate: MARIO_Y a dozen pixels lower
    stride: RECORD_STRIDE,
    threshA: verticalTolerance,
    threshB: horizontalTolerance,
  };
  countObjectOverlaps(m, { ...probe, objectBase: OBJ_ARRAY_67, count: GROUP1_RECORDS });
  countObjectOverlaps(m, { ...probe, objectBase: OBJ_ARRAY_64, count: GROUP2_RECORDS });

  // Grade the total into the unary mask the effect code walks: 0 / 1 / 2 / 3-or-more overlaps
  // become 0 / 1 / 2 / 3 set low bits. Three is the cap — a fourth overlap adds nothing.
  const overlaps = mem.read8(OVERLAP_COUNT);
  let code;
  if (overlaps === 0) code = 0;
  else if (overlaps === 1) code = 1;
  else if (overlaps < 3) code = 3;
  else code = 7;

  // The caller chain reads the code out of the accumulator.
  regs.a = code;
  return code;
}
