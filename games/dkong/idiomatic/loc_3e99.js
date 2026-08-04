// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3e99 — count how many board hazards crowd the probe point, and grade that count into a
 * four-level overlap code.  ROM 0x3E99.
 *
 * The board-1 (25m) arm of the overlap-search dispatch table at ROM 0x3E8D, reached only through
 * dispatchBoardOverlapSearch. It clears the shared OVERLAP_COUNT, runs countObjectOverlaps over
 * both hazard arrays in turn — OBJ_ARRAY_67 (10 records) then OBJ_ARRAY_64 (5 records), both at
 * the 32-byte record stride, accumulating into that one counter — and reads the total back as
 * a code: 0 overlaps → 0, exactly 1 → 1, exactly 2 → 3, 3 or more → 7.
 *
 * WHY 0/1/3/7 AND NOT 0/1/2/3 — the ladder is a UNARY MASK, not a number. Follow the value to its
 * last consumer and the odd steps stop looking arbitrary: a non-zero code is stored into
 * EFFECT_SELECT, whose LOW BITS are then walked one at a time to pick which effect setter runs. So
 * 0 / 1 / 3 / 7 is zero / one / two / three bits set — the count expressed as a thermometer the
 * consumer can shift through, capped at three. A zero code makes the caller skip the whole effect
 * path (it also raises EFFECT_STATE and ITEM_COLLECTED only when the code is non-zero).
 *
 * WHAT IS BEING PROBED. Both inputs are set by the same still-frozen caller chain and pass through
 * untouched, and both are about Mario: the probe record pointer is Mario's record base (so the
 * horizontal coordinate countObjectOverlaps reads out of it is MARIO_X), and the vertical
 * coordinate is MARIO_Y plus twelve — twelve pixels LOWER on screen, i.e. below him rather than on
 * him. The probe is a spot near Mario, not Mario's own hitbox.
 *
 * THE BOUNDS WORD ARRIVES ON THE STACK, NOT IN A REGISTER. The dispatcher stacks it before the
 * shared inline-table trampoline runs, because that trampoline reuses the same register pair to
 * recover its own table base; lifting it back off here is the first thing this routine does, and
 * the word is genuine data — its low byte is the vertical (OBJ_Y-axis) tolerance and its high byte
 * the horizontal (OBJ_X-axis) tolerance that countObjectOverlaps tests each record against. The
 * caller picks between two of them on P1_INPUT's two horizontal bits: with a direction held the
 * horizontal tolerance widens from 5 to 19 pixels while the vertical one stays at 8, so a walking
 * Mario is asked about a much wider strip than a standing one. A dropped pop feeds the search a
 * garbage window and silently changes every verdict.
 *
 * Both arrays share ONE counter deliberately — the second scan does not restart it — so the code
 * grades the total across both, not per-array.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3e99.test.js.
 * GATE:     strict (RAM − STACK_SCRATCH + pc + SP + the overlap code in A), over real captured
 *           dispatches AND crafted entries. MEASURED reachability: 8 natural dispatches in 6000
 *           attract frames (first at frame 605), and those reach only the code-0 and code-1 arms
 *           with a single bounds word (0x1308) — so the code-3 and code-7 arms, the other bounds
 *           word (0x0508) the caller can pick, and the second array's contribution to the shared
 *           counter are covered by CRAFTED entries only, identical on both sides. Teeth: five
 *           broken twins — skipped counter clear, dropped second scan, swapped bounds bytes and a
 *           short first scan (all four caught in RAM), plus a mis-graded exactly-2 total that is
 *           invisible in RAM and caught only by the overlap-code live-out.
 * LIVE-OUT: memory (OVERLAP_COUNT) + the code, left in A and also returned. Verified by walking
 *           the ROM caller chain rather than assumed: this routine's `ret` lands at 0x286E, whose
 *           own `ret` lands at 0x1C23, whose FIRST act re-tests A and then stores it into
 *           EFFECT_SELECT. So A is unambiguously live, the flags are dead (immediately
 *           overwritten by that re-test), and B/DE/IX/HL — which the oracle leaves as loop residue
 *           — are never read on the way out.
 * NAMES:    OVERLAP_COUNT (0x6060), OBJ_ARRAY_67 (0x6700), OBJ_ARRAY_64 (0x6400) from names.js;
 *           countObjectOverlaps (ROM 0x3EC3) direct-called. This routine passes only array BASES
 *           and window widths — every record-relative field offset (OBJ_ACTIVE/OBJ_X/OBJ_Y and the
 *           two OBJ_HIT_EXTENT windows) lives inside countObjectOverlaps, so none appears here,
 *           and the offset-vs-cell namespaces never meet in this file. MARIO_X / MARIO_Y /
 *           P1_INPUT / EFFECT_SELECT / EFFECT_STATE / ITEM_COLLECTED are named above because the
 *           caller chain reads or writes them; this routine only sees the register and stack
 *           values they produced, so it imports none of them.
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
    probeBase: regs.iy, // Mario's record — countObjectOverlaps reads MARIO_X out of it
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

  // The live consumer is still the frozen ROM chain, which reads the code out of A.
  regs.a = code;
  return code;
}
