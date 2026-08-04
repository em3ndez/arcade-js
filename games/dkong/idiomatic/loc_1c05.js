// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c05 — resolve one airborne frame: run the descent probe, then take exactly one of four
 * tails — settle the landing, re-run the fall-height test, carry on as an ordinary airborne frame,
 * or, on the single frame that arms the fall-height test, run the player's object-overlap search
 * and latch what it found.
 *
 * It is entered only by a tail jump from the airborne paths, with this frame's ballistic step
 * already committed. It writes nothing itself except on the trigger frame; every other cell it
 * affects is written by the tail it hands off to.
 *
 *   - The descent probe runs first and hands back a verdict byte and an object counter. A verdict
 *     of 1 goes to the landing-settle tail, which ticks that counter and settles the landing when
 *     the tick reaches zero.
 *   - Otherwise, while MARIO_AIR_LANDCHECK is armed, the frame re-runs the fall-height test — the
 *     check that turns a long enough drop lethal.
 *   - Otherwise it is an ordinary airborne frame, and goes to the ordinary-airborne tail carrying
 *     MARIO_AIR_FRAMES minus the trigger frame, which is the value that tail's wrap test reads.
 *   - On the one frame where MARIO_AIR_FRAMES is exactly the trigger, it arms MARIO_AIR_LANDCHECK
 *     for the rest of the arc and runs the object-overlap search once. A zero severity code ends
 *     the frame at the mover's shared sprite-record tail; a nonzero one latches EFFECT_SELECT,
 *     EFFECT_STATE and ITEM_COLLECTED, then takes the ordinary-airborne tail with an arrival value
 *     of 1 — the value that marks it as the collision path rather than a plain airborne frame.
 *
 * THE LAST BLOCK IS NOT DEAD CODE. The trigger frame's overlap search and its nonzero-severity
 * latch both run in an ordinary attract demo, the latch on a small minority of dispatches.
 *
 * LIVE-OUT: memory, plus the return value it propagates out of whichever tail it takes. Nothing
 * reads a register back from it: every path out of the airborne block is a tail jump, and the
 * cascade that eventually regains control just makes its next call.
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

// The airborne frame on which the fall-height test is armed for the rest of the arc.
const LAND_CHECK_TRIGGER_FRAME = 20;

// The two continuation addresses this routine must place on the guest stack before a call that
// returns back through it. Neither push is a dissolvable call/return bracket: the descent probe
// and the per-board arms the overlap search dispatches into both return by popping this word, so
// dropping either push makes the callee unwind two bytes off.
const PROBE_RETURN = 0x1c08;
const OVERLAP_SEARCH_RETURN = 0x1c23;

export function loc_1c05(m) {
  const { regs, mem8 } = m;

  // This frame's descent probe. Both of its exits — the normal return and the two-level
  // caller-skip its reject/hit path takes — consume the stacked continuation and resume here.
  m.push16(PROBE_RETURN);
  m.call(0x2b1c);
  const probeVerdict = regs.a;

  // The landing-settle tail still takes its live-ins in registers: the DECREMENTED verdict, which
  // it reads as its landing flag and which is 0 on this arm, and the object counter the probe
  // left behind.
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);

  // Once armed, the fall-height test runs on every remaining frame of the arc.
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);

  // How far this frame is from the frame that arms the test. The ordinary-airborne tail reads the
  // value back and bumps it, so the one arrival that wraps to zero is the frame before the trigger.
  const framesToTrigger = u8(mem8[MARIO_AIR_FRAMES] - LAND_CHECK_TRIGGER_FRAME);
  if (framesToTrigger !== 0) {
    regs.a = framesToTrigger;
    return loc_1c33(m);
  }

  // The trigger frame itself: arm the fall-height test, then run the player's object-overlap
  // search once. It hands the severity code back in the result register.
  mem8[MARIO_AIR_LANDCHECK] = 1;
  m.push16(OVERLAP_SEARCH_RETURN);
  searchPlayerObjectOverlap(m);
  const severity = regs.a;

  // Nothing overlapped: the frame ends at the mover's shared sprite-record tail.
  if (severity === 0) return writeMarioSpriteRecord(m);

  // Something did: hand the severity to the effect machine, raise it, and flag the pickup for
  // the landing code to consume.
  mem8[EFFECT_SELECT] = severity;
  mem8[EFFECT_STATE] = 1;
  mem8[ITEM_COLLECTED] = 1;

  // Back to the same tail, arriving with 1 — a value its wrap test can never select.
  regs.a = 1;
  return loc_1c33(m);
}
