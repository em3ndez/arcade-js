// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c05 — resolve one airborne frame: run the descent probe, then take exactly one of
 * four tails — settle the landing, re-run the fall-height test, carry on as an ordinary
 * airborne frame, or (on the single frame that arms the fall-height test) run the player's
 * object-overlap search and latch what it found.  ROM 0x1C05.
 *
 * Entered only by a tail jump, from the two airborne paths at ROM 0x1BEC and 0x1BF2, with
 * this frame's ballistic step already committed. It writes nothing itself except on the
 * trigger frame; every other cell it affects is written by the tail it hands off to.
 *
 *   - The descent probe (ROM 0x2B1C, still the frozen oracle) runs first and hands back a
 *     verdict byte and an object counter. Verdict 1 goes to loc_1c3a, which ticks that
 *     counter and settles the landing when the tick reaches zero.
 *   - Otherwise, while MARIO_AIR_LANDCHECK is armed, the frame re-runs the fall-height test
 *     (markFatalFallByHeight) — the check that turns a long enough drop lethal.
 *   - Otherwise it is an ordinary airborne frame and goes to loc_1c33 carrying
 *     MARIO_AIR_FRAMES minus the trigger frame, which is the value loc_1c33's wrap test reads.
 *   - On the one frame where MARIO_AIR_FRAMES is exactly the trigger, it arms
 *     MARIO_AIR_LANDCHECK for the rest of the arc and runs the object-overlap search once. A
 *     zero severity code ends the frame at the mover's shared sprite-record tail; a nonzero
 *     one latches EFFECT_SELECT / EFFECT_STATE / ITEM_COLLECTED and then takes the loc_1c33
 *     tail with an arrival value of 1 — the collision path loc_1c33's header describes.
 *
 * NOT DEAD CODE: the last block lives at ROM 0x1C23-0x1C32, which the frozen oracle records as
 * hidden behind `defb UNREACHED` in the published listing. Attract enters it on 8 of 360
 * dispatches and takes its store arm on 2 (see GATE), so a reader meeting that annotation
 * should not believe it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1c05.test.js.
 * GATE:     captured + crafted, ATTRACT ONLY for the captured half. 0x1C05 is richly reachable
 *           without input and the gate MEASURES it: 360 real dispatches over 6000 attract
 *           frames, with all four tails present — 191 fall-height, 152 ordinary, 9 landing and
 *           8 trigger-frame (6 of those with severity 0, 2 with a nonzero severity through the
 *           0x1C23 block). 78 of the 360 are replayed: every 20th, plus the first at each of
 *           the 63 distinct entry shapes (board / land-check / airborne-frame count), plus the
 *           first of each of the 5 observed tail chains — and the test asserts every shape and
 *           every chain is in the sample. Two crafted arms cover what attract does not
 *           produce: a both-sides stub for the frozen descent probe sweeps all 256 verdict
 *           values against a landing counter AND against one that does not tick to zero (512
 *           combinations, the second half unreachable in attract), and the trigger frame is
 *           driven on boards 2, 3 and 4. Credited gameplay and two-player are NOT covered.
 *           Teeth: an off-by-one verdict predicate, an off-by-one trigger frame, a dropped
 *           land-check arm, a dropped ITEM_COLLECTED latch and an inverted severity test.
 * LIVE-OUT: memory-only, plus the propagated return value. Derived from BOTH callers — the
 *           only two are ROM 0x1BEC and 0x1BF2, both of which reach this routine by a tail
 *           jump and propagate its return without reading a register; following their chain
 *           out (tail jumps throughout the airborne block, then out of ROM 0x1AC3) reaches ROM
 *           0x1983, whose next act is the next call in the per-frame cascade, so no register
 *           or flag survives to a reader. That is a DERIVATION; there is no committed live-wire
 *           arm in this gate to corroborate it.
 * NAMES:    MARIO_AIR_LANDCHECK (0x621F), MARIO_AIR_FRAMES (0x6214), EFFECT_SELECT (0x6342),
 *           EFFECT_STATE (0x6340), ITEM_COLLECTED (0x6225) — all from ram.js. Direct-called:
 *           loc_1c3a, markFatalFallByHeight (0x1C76), loc_1c33, searchPlayerObjectOverlap
 *           (0x2853) and writeMarioSpriteRecord (0x1DA6), all already idiomatic. loc_1c3a and
 *           loc_1c33 still take their live-ins in registers, so this routine marshals into
 *           them; that dissolves when their signatures are promoted. The one remaining m.call
 *           is ROM 0x2B1C, which has no idiomatic twin in ROUTINES yet.
 */

import { u8 } from "../../../core/int.js";
import {
  EFFECT_SELECT,
  EFFECT_STATE,
  ITEM_COLLECTED,
  MARIO_AIR_FRAMES,
  MARIO_AIR_LANDCHECK,
} from "./ram.js";
import { loc_1c33 } from "./loc_1c33.js";
import { loc_1c3a } from "./loc_1c3a.js";
import { markFatalFallByHeight } from "./markFatalFallByHeight.js"; // ROM 0x1C76
import { searchPlayerObjectOverlap } from "./searchPlayerObjectOverlap.js"; // ROM 0x2853
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js"; // ROM 0x1DA6

// The airborne frame on which the fall-height test is armed for the rest of the arc.
const LAND_CHECK_TRIGGER_FRAME = 20;

// The two ROM continuation addresses this routine must place on the guest stack before a
// call that still returns through it. Both are genuine oracle boundaries, not dissolvable
// call/return brackets: the descent probe is the frozen oracle, and the overlap search —
// idiomatic in form — still dispatches into the frozen per-board arms, whose own `ret`
// consumes the word. Dropping either push makes the callee unwind two bytes off. ROM code
// addresses, so kept hex.
const PROBE_RETURN = 0x1c08;
const OVERLAP_SEARCH_RETURN = 0x1c23;

export function loc_1c05(m) {
  const { regs, mem8 } = m;

  // This frame's descent probe. Both of its exits — the normal return and the two-level
  // caller-skip its reject/hit path takes — consume the stacked continuation and resume here.
  m.push16(PROBE_RETURN);
  m.call(0x2b1c);
  const probeVerdict = regs.a;

  // loc_1c3a's live-ins are still register-based (its ABI was written while this handler was
  // frozen): the DECREMENTED verdict, which it reads as its landing flag and which is 0 on
  // this arm, and the object counter the probe left in the counter register.
  regs.a = u8(probeVerdict - 1);
  if (probeVerdict === 1) return loc_1c3a(m);

  // Once armed, the fall-height test runs on every remaining frame of the arc.
  if (mem8[MARIO_AIR_LANDCHECK] === 1) return markFatalFallByHeight(m);

  // How far this frame is from the frame that arms the test. loc_1c33 reads the value back
  // and bumps it, so the one arrival that wraps to zero is the frame just before the trigger.
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
