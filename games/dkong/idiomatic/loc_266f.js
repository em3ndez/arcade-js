// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_266f — ensure object-2's step-direction latch is negative-going, then run the shared
 * publish/animate tail.  ROM 0x266F.
 *
 * The "Y above the 0xC0 threshold" arm of sub_262f (object-2's per-frame update inside the
 * 50m object cascade, so it only runs on BOARD 2 and never in attract). sub_262f branches
 * here when object-2's Y compares below 0xC0, having already fixed the shared latch pointer
 * at M50_OBJ2_STEP_DIR; that pointer is invariant across every real dispatch (proven by the
 * captured test that drives sub_262f into this arm), so this routine addresses the named
 * cell directly instead of through the caller's pointer register.
 *
 * It forces object-2's step direction negative unless it already is:
 *   - If the latch's sign bit is already set (already stepping negative), leave it untouched
 *     and drop straight into the shared tail.
 *   - Otherwise stamp the latch to 0xFF (a full negative step) first.
 * Either way it falls through to the shared tail loc_264c, which reduces the latch to a ±1
 * unit step, publishes both polarities to the mover's shadow bytes, and on every 32nd frame
 * advances object-2's mirrored sprite pair.
 *
 * NAME: kept the neutral loc_ — the mechanism (clamp the latch negative on this arm) is
 * pinned to the oracle, but WHICH on-screen 50m object this steers and what the 0xC0 Y
 * threshold represents are board-2 ungrounded (the same sprite-record caution that keeps
 * loc_264c and the M50 family neutral). Promote once corroborated on a real 50m board.
 *
 * Memory-equivalent to the frozen oracle — equivalence-266f.test.js.
 * GATE:     crafted-entry + captured — plain attract never dispatches 0x266F (the whole
 *           sub_25F2 object cascade is board-2 gated and attract plays 25m), so real states
 *           are reproduced by driving the translated caller sub_262f into this arm (Y < 0xC0)
 *           with the latch sign seeded both ways, plus crafted entries over the latch sign
 *           bit (both arms, including the 0x7F/0x80/0xC0 boundaries) with the frame counter
 *           set to exercise the tail's publish, leave, and sprite-advance arms. Teeth: an
 *           inverted sign test and a dropped force-negative write.
 * LIVE-OUT: memory-only. The tail's exit successor (sub_2AD3) reloads the accumulator with
 *           Mario's X on its first instruction and recomputes flags, so nothing downstream
 *           consumes a register this routine leaves; the oracle is a tail-jump chain
 *           (sub_262f -> here -> the tail -> ret) that nets exactly one caller-return pop,
 *           modelled by the JS return.
 * NAMES:    M50_OBJ2_STEP_DIR (0x62A3) — from names.js. The tail's published shadows (0x63A4/
 *           0x63A5) and its mirrored sprite pair (the 0x69EC block) live inside loc_264c.
 */

import { M50_OBJ2_STEP_DIR } from "./names.js";
import { loc_264c } from "./loc_264c.js"; // ROM 0x264C — the shared publish/animate tail

export function loc_266f(m) {
  const { mem } = m;

  // Force object-2's step direction negative unless the sign bit is already set: on the
  // not-yet-negative case stamp the latch to a full negative step before the shared tail.
  if ((mem.read8(M50_OBJ2_STEP_DIR) & 0x80) === 0) {
    mem.write8(M50_OBJ2_STEP_DIR, 0xff);
  }
  return loc_264c(m);
}
