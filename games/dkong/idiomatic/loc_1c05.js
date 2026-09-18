// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c05 — resolve one airborne frame: run the descent probe, then take exactly one of four
 * tails — settle the landing, re-run the fall-height test, carry on as an ordinary airborne
 * frame, or, on the single frame that arms the fall-height test, run the player's object-overlap
 * search and latch what it found.
 *
 * Entered only by a tail jump from the airborne paths, with this frame's ballistic step already
 * committed. It writes nothing itself except on the trigger frame.
 *   - Descent probe first: verdict 1 goes to the landing-settle tail (ticks the object counter,
 *     settles when it reaches zero).
 *   - Otherwise, while MARIO_AIR_LANDCHECK is armed, re-run the fall-height test.
 *   - Otherwise an ordinary airborne frame, carrying MARIO_AIR_FRAMES minus the trigger frame.
 *   - On the one frame where MARIO_AIR_FRAMES equals the trigger, arm MARIO_AIR_LANDCHECK and run
 *     the overlap search once: severity 0 ends at the shared sprite tail; nonzero latches
 *     EFFECT_SELECT, EFFECT_STATE and ITEM_COLLECTED, then takes the airborne tail with 1 (marking
 *     the collision path).
 *
 * THE LAST BLOCK IS NOT DEAD CODE: the trigger frame's overlap search and its nonzero-severity
 * latch both run in an ordinary attract demo.
 *
 * LIVE-OUT: memory, plus the return value propagated out of whichever tail it takes.
 */

import { u8 } from "../../../core/int.js";
import {
  EFFECT_SELECT,
  EFFECT_STATE,
  ITEM_COLLECTED,
  MARIO_AIR_FRAMES,
  MARIO_AIR_LANDCHECK,
} from "./names.js";
import { loc_1c33 } from "./loc_1c33.js";
import { loc_1c3a } from "./loc_1c3a.js";
import { markFatalFallByHeight } from "./markFatalFallByHeight.js";
import { searchPlayerObjectOverlap } from "./searchPlayerObjectOverlap.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

const LAND_CHECK_TRIGGER_FRAME = 20;

// Continuations placed on the guest stack before calls that return back through this routine;
// dropping either push unwinds the callee two bytes off.
const PROBE_RETURN = 0x1c08;
const OVERLAP_SEARCH_RETURN = 0x1c23;

export function loc_1c05(m) {
  const { regs, mem8 } = m;

  m.push16(PROBE_RETURN);
  m.call(0x2b1c);
  const probeVerdict = regs.a;

  // The landing-settle tail reads the DECREMENTED verdict as its landing flag.
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);

  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);

  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - LAND_CHECK_TRIGGER_FRAME);
  if (framesToTrigger !== 0) {
    return loc_1c33(m, framesToTrigger);
  }

  // Trigger frame: arm the fall-height test, then run the overlap search once.
  mem8[MARIO_AIR_LANDCHECK] = 1;
  m.push16(OVERLAP_SEARCH_RETURN);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;

  if (severity === 0) return writeMarioSpriteRecord(m);

  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  mem8[ITEM_COLLECTED] = 1;

  return loc_1c33(m, 1);
}
