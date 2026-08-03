// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2679 — on a timer, reverse object-3's step direction; then run the shared tail.  ROM 0x2679.
 *
 * The third object-update in the 50m object cascade (under sub_25F2, so it only runs on
 * BOARD 2 and never in attract). It manages one object's periodic direction reversal and
 * then falls through to the shared publish/animate tail (loc_268d):
 *
 *   - On frames whose frame-counter low bit is SET, it does nothing of its own and drops
 *     straight through to the tail (so its countdown only advances every other frame).
 *   - On the other frames it ticks object-3's reversal-timer countdown by one. While the
 *     countdown has not yet reached zero it just runs the tail. When it underflows to zero
 *     it reloads the countdown to 255 and reverses object-3's step-direction latch (via
 *     reverseStepDirection), so the object periodically flips which way it travels.
 *
 * This is the object-3 twin of object-1's reversal driver (sub_2602) and object-2's
 * (sub_262f): each ticks its own paired countdown and flips its own M50_OBJx_STEP_DIR
 * latch on expiry. Every path ends in the shared tail loc_268d, which reduces the latch
 * to a unit step, publishes it to the mover's shadow byte, and every 32nd frame advances
 * the mirrored sprite pair.
 *
 * REGISTER-ABI MARSHALLING (dissolves once the callee takes an honest arg): reverseStepDirection
 * still reads the byte address it flips from the pointer register, so this routine loads
 * exactly what the oracle's call site loads — the M50_OBJ3_STEP_DIR address — before invoking
 * it. loc_268d takes nothing from its caller (it sets up its own pointers), so the tail is a
 * plain call.
 *
 * NAME: kept the neutral loc_ — the mechanism (a timed step-direction reversal) is pinned to
 * the oracle, but WHICH on-screen 50m object this steers is board-2 ungrounded (the same
 * sprite-record caution that keeps loc_268d and the M50 family neutral). Its countdown cell is
 * named M50_OBJ3_REVERSE_TIMER (0x62A5); promote the routine name once corroborated on a real
 * 50m board.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2679.test.js.
 * GATE:     crafted-entry — plain attract never dispatches 0x2679 (the whole sub_25F2 object
 *           cascade is board-2 gated and attract plays 25m), so real states are reproduced by
 *           crafting entries on a real attract base that poke the frame counter (odd → tail,
 *           even → tick), the countdown (still-counting, exact-expiry, and the 0 → 255 wrap
 *           seam), and the step-direction latch sign (both reverse arms). Teeth: a dropped
 *           countdown reload, a dropped direction reversal, and an inverted frame-parity gate.
 * LIVE-OUT: memory-only. The tail's exit successor (sub_2AD3) reloads the accumulator with
 *           Mario's X on its first instruction and recomputes flags, so nothing downstream
 *           consumes a register this routine leaves; the oracle's terminal `ret` is the JS
 *           return (the tail-jump chain nets exactly one caller-return pop).
 * NAMES:    FRAME (0x601A), M50_OBJ3_REVERSE_TIMER (0x62A5), M50_OBJ3_STEP_DIR (0x62A6) — from
 *           ram.js. The tail's published shadow (0x63A6) and sprite pair (0x69F4) live inside loc_268d.
 */

import { u8 } from "../../../core/int.js";
import { FRAME, M50_OBJ3_REVERSE_TIMER, M50_OBJ3_STEP_DIR } from "./ram.js";
import { loc_268d } from "./loc_268d.js"; // ROM 0x268D — the shared publish/animate tail
import { reverseStepDirection } from "./reverseStepDirection.js"; // ROM 0x26DE

export function loc_2679(m) {
  const { regs, mem } = m;

  // On frames whose low bit is set, skip the countdown entirely and run the shared tail —
  // so the reversal timer only advances on every other frame.
  if ((mem.read8(FRAME) & 0x01) !== 0) return loc_268d(m);

  // Tick the reversal-timer countdown. Until it underflows to zero, just run the tail.
  const remaining = u8(mem.read8(M50_OBJ3_REVERSE_TIMER) - 1);
  mem.write8(M50_OBJ3_REVERSE_TIMER, remaining);
  if (remaining !== 0) return loc_268d(m);

  // Countdown expired: reload it and reverse object-3's step direction, then run the tail.
  mem.write8(M50_OBJ3_REVERSE_TIMER, 0xff);
  regs.hl = M50_OBJ3_STEP_DIR; // reverseStepDirection flips the byte at this pointer
  reverseStepDirection(m);
  return loc_268d(m);
}
