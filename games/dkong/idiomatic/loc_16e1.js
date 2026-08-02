// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_16e1 — once the moving sprite group reaches its rail region, either reinitialize it
 * or bounce/slide it by its current step sign.  ROM 0x16e1.
 *
 * The second-stage dispatcher of the loc_16bb / loc_16e1 pair that walks a horizontally-
 * moving group of 10 sprites back and forth (its motion tail is the shared loc_16d5 group-
 * slide). Every frame loc_16bb runs first: it reads record #2's X (0x6910) and the object's
 * published signed per-frame step (0x63A3), and once that X has climbed to the rail region
 * (reached 90) it hands control here. Given that X (recordX) and the published step
 * (stepByte), loc_16e1 chooses one of three outcomes:
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
 *      slide with no reversal (loc_16d5).
 *
 * The sign-to-outcome mapping is the mirror of loc_16bb's near-rail mapping, and together
 * they are the bounce: a reversal is scheduled only while the group is still travelling INTO
 * the rail it has just reached. loc_16e1 reads no work RAM of its own and writes none — it
 * only tests its two inputs and tail-calls the chosen handler, which does all the memory work.
 *
 * The scene these sprites belong to is UNCONFIRMED: the motion tails loc_16d0 / loc_16d5 and
 * their meaning-bearing callee loc_2602 all declined an English name over the sprite-record
 * trap, and this routine's rail thresholds remain unnamed engine scratch (the 0x6388 counter
 * its loc_16ee callee advances is now BOARD_ADVANCE_STEP) — so it keeps the neutral loc_16e1
 * name and states the mechanic in prose. A reviewer who promotes loc_2602 can promote this
 * whole family in the same pass.
 *
 * Inputs: recordX = record #2's X (0x6910); stepByte = the published step (0x63A3). Needs the
 * machine only to hand it to the chosen handler.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16e1.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x16e1 (0×/2500 frames, asserted — the
 *           group cascade this family drives runs only in real gameplay), so all three arms
 *           are reproduced by poking recordX / stepByte (and the object's motion state) on a
 *           booted machine and comparing RAM − STACK_SCRATCH + pc + SP against the oracle. A
 *           full recordX sweep pins the exact 93 reinit threshold and the sign split; a FRAME
 *           sweep drives the real motion through the bounce arms. Teeth: a swapped-sign twin
 *           (reverses on the wrong step sign) and a dropped-reinit twin (slides instead of
 *           reinitializing in the 90..92 band), both caught by the RAM diff.
 * LIVE-OUT: memory-only. loc_16e1 tail-returns through whichever handler it picks; the whole
 *           family is dispatched from the in-game substate table and returns through the NMI
 *           dispatcher, which reads no register or flag it leaves — the register file is dead
 *           ABI. RAM (+ SP/pc) backstops that.
 * NAMES:    none imported — recordX / stepByte are honest inputs (record #2's X and the
 *           object's published step, named in prose to match loc_16d5). The 93 rail threshold
 *           is unnamed engine scratch, kept in prose; the 0x6388 counter its loc_16ee callee
 *           advances is BOARD_ADVANCE_STEP (named in ram.js).
 */

import { loc_16d0 } from "./loc_16d0.js"; // ROM 0x16D0 — schedule a reversal, then slide
import { loc_16d5 } from "./loc_16d5.js"; // ROM 0x16D5 — the shared group-slide motion tick
// ROM 0x16EE — reinit object block + advance the 0x6388 step counter. The FROZEN ORACLE on
// purpose: an idiomatic twin (reloadObjectBlockAndAdvanceStep.js) exists and 0x16EE is in
// ROUTINES, but the oracle ends in a plain `ret` (it makes no m.call of its own) while the twin
// returns in JS, so the swap drops one guest-stack word. MEASURED — it fails this routine's own
// equivalence gate on SP (oracle=0x6C00 vs candidate 2 lower).
import { loc_16ee } from "../translated/loc_16ee.js";

export function loc_16e1(m, recordX, stepByte) {
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
    loc_16d5(m);
  }
}
