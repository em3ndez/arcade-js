// SPDX-License-Identifier: GPL-3.0-only
/**
 * endKongWalkAndAdvanceInterlude — once the moving sprite group reaches its rail region, either reinitialize it
 * or bounce/slide it by its current step sign.  ROM 0x16e1.
 *
 * The second-stage dispatcher of the dispatchKongWalkFrame / endKongWalkAndAdvanceInterlude pair that walks a horizontally-
 * moving group of 10 sprites back and forth (its motion tail is the shared stepKongWalk group-
 * slide). Every frame dispatchKongWalkFrame runs first: it reads record #2's X (0x6910) and the object's
 * published signed per-frame step (0x63A3), and once that X has climbed to the rail region
 * (reached 90) it hands control here. Given that X (recordX) and the published step
 * (stepByte), endKongWalkAndAdvanceInterlude chooses one of three outcomes:
 *
 *   1. recordX still short of 93 (i.e. in the narrow 90..92 band just inside the rail):
 *      reinitialize the group's object block — recopy its sprite template and clear its
 *      per-object scratch — and advance the 0x6388 step counter (loc_16ee). This is the
 *      "the group arrived at the rail, reset it and step the sequence" case.
 *
 *   2. recordX at/past 93 with a POSITIVE step (still heading into this rail): schedule a
 *      direction reversal for the next tick and slide this frame (loc_16d0) — the group
 *      bounces off the rail.
 *
 *   3. recordX at/past 93 with a NEGATIVE step (already moving away): just run this frame's
 *      slide with no reversal (stepKongWalk).
 *
 * The sign-to-outcome mapping is the mirror of dispatchKongWalkFrame's near-rail mapping, and together
 * they are the bounce: a reversal is scheduled only while the group is still travelling INTO
 * the rail it has just reached. endKongWalkAndAdvanceInterlude reads no work RAM of its own and writes none — it
 * only tests its two inputs and tail-calls the chosen handler, which does all the memory work.
 *
 * NAME: promoted from loc_16e1 in this pass, with the scene inherited from the sequence step
 * that opens it — begin50mKongRecaptureInterlude (ROM 0x16A3) stamps the ten-record figure from
 * the ROM 0x385C template into SPRITE_OBJ_BLOCK and bumps the 0x6388 selector into this family,
 * so the group this routine reinitializes or bounces is that one figure, and the counter its
 * loc_16ee callee advances is the same BOARD_ADVANCE_STEP (0x6388) selector.
 * WHAT THIS NAME DOES NOT CLAIM: that the figure is Kong on measured bytes — "Kong" is the
 * pass-14 snapshot reading both interlude openers flag as a reading, not a byte measurement.
 * This routine's own rail thresholds remain unnamed engine scratch, stated in prose. loc_16d0
 * and loc_2602 are still loc_-named.
 *
 * Inputs: recordX = record #2's X (0x6910); stepByte = the published step (0x63A3). Needs the
 * machine only to hand it to the chosen handler.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16e1.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16e1 (0×/2500 frames, asserted — attract
 *           never reaches GAME_SUBSTATE 0x16 at all, because it never completes a board, and this
 *           family hangs off that sub-state's 50m step table at ROM 0x1637), so all three arms
 *           are reproduced by poking recordX / stepByte (and the object's motion state) on a
 *           booted machine and comparing RAM − STACK_SCRATCH + pc + SP against the oracle. A
 *           full recordX sweep pins the exact 93 reinit threshold and the sign split; a FRAME
 *           sweep drives the real motion through the bounce arms. Teeth: a swapped-sign twin
 *           (reverses on the wrong step sign) and a dropped-reinit twin (slides instead of
 *           reinitializing in the 90..92 band), both caught by the RAM diff.
 * LIVE-OUT: memory-only. endKongWalkAndAdvanceInterlude tail-returns through whichever handler it
 *           picks; the whole family sits TWO levels below the in-game sub-state table — 0x0702
 *           idx 0x16 -> 0x1615 (dispatchBoardClearedInterlude), which vectors BOARD_ADVANCE_STEP
 *           through the 50m step table at ROM 0x1637, whose idx 1 (the word at 0x1639) is 0x16BB;
 *           0x16e1 is reached only from 0x16BB's `jp nc`. It returns through the NMI dispatcher,
 *           which reads no register or flag it leaves — the register file is dead ABI. RAM
 *           (+ SP/pc) backstops that.
 * NAMES:    none imported — recordX / stepByte are honest inputs (record #2's X and the
 *           object's published step, named in prose to match stepKongWalk). The 93 rail threshold
 *           is unnamed engine scratch, kept in prose; the 0x6388 counter its loc_16ee callee
 *           advances is BOARD_ADVANCE_STEP (named in ram.js).
 */

import { loc_16d0 } from "./loc_16d0.js"; // ROM 0x16D0 — schedule a reversal, then slide
import { stepKongWalk } from "./stepKongWalk.js"; // ROM 0x16D5 — the shared group-slide motion tick
// ROM 0x16EE — reinit object block + advance the 0x6388 step counter. The FROZEN ORACLE on
// purpose: an idiomatic twin (reloadObjectBlockAndAdvanceStep.js) exists and 0x16EE is in
// ROUTINES, but the oracle ends in a plain `ret` (it makes no m.call of its own) while the twin
// returns in JS, so the swap drops one guest-stack word. MEASURED — it fails this routine's own
// equivalence gate on SP (oracle=0x6C00 vs candidate 2 lower).
import { loc_16ee } from "../translated/loc_16ee.js";

export function endKongWalkAndAdvanceInterlude(m, recordX, stepByte) {
  // Short of the reinit mark: the group has arrived at the rail — recopy its object block and
  // advance the sequence step counter instead of moving it this frame.
  if (recordX < 93) {
    loc_16ee(m);
    return;
  }

  // The published step's sign bit (top bit): set means the group is moving in the negative
  // (decreasing-X) direction, clear means positive.
  const stepIsNegative = (stepByte & 0x80) !== 0;

  // A positive step is still heading into this rail, so schedule a reversal before sliding
  // (bounce); a negative step is already moving away, so just slide.
  if (!stepIsNegative) {
    loc_16d0(m);
  } else {
    stepKongWalk(m);
  }
}
