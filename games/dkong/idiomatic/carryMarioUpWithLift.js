// SPDX-License-Identifier: GPL-3.0-only
/**
 * carryMarioUpWithLift — carry Mario one pixel UP the screen while he rides a rising lift,
 * or kill him once he reaches the top of his OWN run.  ROM 0x276F.
 *
 * One arm of dispatchElevatorRideByColumn (ROM 0x2745), chosen while Mario's X sits in the
 * [0x2C, 0x43) band — the RISING column, where lifts are spawned at X = 0x37 (55). It looks
 * at how far up MARIO_Y has travelled:
 *
 *   - Once MARIO_Y has dropped below the 0x71 limit — smaller Y is higher on screen, so he
 *     has been carried up to row 112 — it hands off to killMarioAtEndOfLiftTravel, which
 *     zeroes MARIO_ACTIVE. That is the game's kill primitive: Mario dies, the death
 *     animation runs and a life is lost.
 *   - Otherwise it decrements MARIO_Y by one — a single pixel up the screen, since a larger
 *     Y is lower — and mirrors the new value into the Y field of Mario's hardware sprite
 *     record, so the on-screen sprite follows the move the same frame.
 *
 * The 0x71 limit and the -1 step are this arm's; the sibling arm carryMarioDownWithLift runs
 * the same shape downward, and both end in the same killMarioAtEndOfLiftTravel.
 *
 * THE LIMIT IS AN ABSOLUTE MARIO_Y ROW, NOT THE LIFT'S END OF TRAVEL. This routine never
 * reads an object record; the only comparison it makes is MARIO_Y against the constant
 * 0x71, and the two places are not the same one. A rider's Y is stamped OBJ_Y - 12 when he
 * boards (ROM 0x29E0-E2) and the measured gap held at 11-12 through the ride, so he crosses
 * row 112 with the lift around OBJ_Y 123-124 — while the rising column itself runs on to
 * OBJ_Y 96 (ROM 0x27B5) from its spawn at OBJ_Y 248 (ROM 0x27FC). That leaves 27-28 px,
 * about 18% of the column's 152 px climb, still to run at the moment the rider is killed:
 * he dies at the top of HIS run and the platform carries on past him. So the sibling's
 * name, "end of lift travel", is the lift-relative reading of this test and is loose by
 * that much on this arm; what the code tests is Mario's own row.
 *
 * WHAT IS DRAWN, and why "lift" and not "shaft" (grounded in real MAME pixels, isolated
 * per-actor by blanking every other sprite's code byte at the DMA latch and diffing frames):
 * each of the six OBJ_ARRAY_66 records draws sprite code 0x44, which decodes out of gfx2.bin
 * as a 16x8 X-braced TRUSS PLATFORM, and Mario's feet ride its top row at that fixed 11-12
 * px gap. Its collision half-extents (+9/+0x0A = 8/4) are exactly that drawn box. Yellow
 * riveted drive housings (sprite 0x45) sit at the head and foot of each rail, on the very
 * rows this ROM's constants name — OBJ_Y 96 and 248 (ROM 0x27B5/0x27CE), which its 16px
 * height spans from anchors 0x60 and 0xF7. So "lift" is
 * pixel-grounded, not inferred. But there is no SHAFT: an exposed vertical rail with a
 * drive housing at each end is what is on screen — no enclosure, no car, no doors — so this
 * file says "the lift's run", never "the shaft". (spawnBoardObject, which seeds the same six
 * records, still says "The concrete kind of object spawned is not grounded here"; that
 * predates this grounding. Lifting it is that file's edit, not this one's.)
 *
 * NAME: promoted from loc_276f in understanding pass 15 (proposer != confirmer; both
 * derivations independently said "one pixel UP the screen"). Corroboration from OUTSIDE the
 * routine (R5). The direction rests on a named cell's grounded convention, not on a reading:
 * MARIO_Y (0x6205) is `[seen]` in names.js as "larger = lower on screen", so this arm's `dec`
 * is up. The lockstep was then measured on a real 75m ride: over 199 flag-set frames
 * liftY - MARIO_Y took only the values 11 and 12 with ZERO drift, Mario's Y and the lift's Y
 * each moved exactly -49 px over the same 198 frames, and Mario's sprite-record Y (0x694F)
 * equalled MARIO_Y on 199/199 frames — so the mirror this arm writes is the drawn position.
 * The column is the rising one from OBJ_ARRAY_66 (0x6600) `[seen]`, whose records at X = 55
 * have their Y DECREASE 244 -> 96. Both arms were observed: 50 dispatches, 49 of them the
 * step arm and 1 the hand-off.
 *
 * Memory-equivalent to the frozen oracle — equivalence-276f.test.js.
 * GATE:     crafted-entry, EXHAUSTIVE over the one input that decides everything — the prior
 *           MARIO_Y (0..255) — built on a real booted attract base so the surrounding work
 *           RAM is self-consistent. The sweep covers both arms outright: 0x00..0x70 take the
 *           kill hand-off, 0x71..0xFF take the decrement-and-mirror. 0x276F is never
 *           dispatched in attract (verified 0 over 6000 frames — it fires only while Mario
 *           is riding a 75m lift), so crafted coverage carries the gate. Teeth: a wrong
 *           limit, a dropped sprite mirror, a missing decrement, and a skipped hand-off.
 *           ★ Attract-0 is NOT "this code never runs": a real 75m ride put 50 dispatches
 *           through it (49 step + 1 hand-off), which this gate does not replay.
 * LIVE-OUT: memory-only. On the decrement arm: MARIO_Y (0x6205) and Mario's sprite-record Y
 *           (0x694F). On the hand-off arm: MARIO_ACTIVE and EDGE_REPOSITION_FLAG (via
 *           killMarioAtEndOfLiftTravel). The caller (dispatchElevatorRideByColumn, itself a
 *           discarded per-frame tail) consumes no register/flag, and the terminal return is
 *           dead ABI — the equivalence test still lines pc + SP up to prove the dissolved
 *           tail-jump bracket matches.
 * NAMES:    MARIO_Y (0x6205), MARIO_SPRITE_RECORD (0x694C) + SPRITE_Y (+3 = 0x694F) from
 *           names.js; killMarioAtEndOfLiftTravel (ROM 0x277F) direct-called for the kill.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./names.js";
import { killMarioAtEndOfLiftTravel } from "./killMarioAtEndOfLiftTravel.js"; // ROM 0x277F — the kill at this arm's limit

// MARIO_Y below this = he has been carried up to row 112 or above (smaller Y is higher on
// screen), which ends the ride. An absolute row of Mario's own — nothing here consults the lift, which
// still has 27-28 px of climb left at this point. Paired with the X bands 0x2C/0x43/0x6C/0x83
// that dispatchElevatorRideByColumn keys this arm off.
const TOP_LIMIT = 0x71;

/**
 * @param {object} m  the machine (uses m.mem; hands off to killMarioAtEndOfLiftTravel).
 * @returns {void}
 */
export function carryMarioUpWithLift(m) {
  const { mem } = m;

  const y = mem.read8(MARIO_Y);

  // Carried to the top of his run — kill Mario and clear the on-a-lift flag.
  if (y < TOP_LIMIT) {
    killMarioAtEndOfLiftTravel(m);
    return;
  }

  // Still travelling — step one pixel up and mirror the new Y to the sprite record so the
  // on-screen sprite tracks it. The value only lands in byte stores (which truncate), and
  // y >= 0x71 means y - 1 never goes negative, so no wrap is needed here.
  const stepped = y - 1;
  mem.write8(MARIO_Y, stepped);
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_Y, stepped);
}
