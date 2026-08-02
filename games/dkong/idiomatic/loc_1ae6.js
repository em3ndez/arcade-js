// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1ae6 — the RIGHT arm of Mario's on-foot movement dispatch: walk him right when Right is
 * held and the position gate has not flagged the right-hand limit, otherwise hand the frame on
 * to the left/climb arm.  ROM 0x1AE6.
 *
 * The player-movement state machine (ROM 0x1AC3) reaches here on any frame Mario is neither
 * airborne, nor frozen, nor mid-jump-press — i.e. the frame is his to spend on the ground or a
 * ladder. This routine owns the setup the whole ground-movement dispatch shares, then makes the
 * first of its three direction decisions:
 *
 *   1. Ask the horizontal position gate (loc_241f) for its two-flag verdict. D flags the LEFT
 *      limit, E the RIGHT limit; both are 0 when Mario is free to move either way.
 *   2. Read the cooked control word P1_INPUT once, for every arm downstream.
 *   3. Right is honoured only when E says the right-hand limit is clear. E == 1 — Mario at the
 *      far-right edge (MARIO_X >= 0xEA) — blocks the rightward step outright, before the button
 *      is even looked at, so a player leaning on Right at the edge simply gets no step.
 *   4. Clear of the limit and Right held (control bit 0) -> walkMarioRight spends the frame on
 *      one rightward walk step.
 *
 * Everything else — Right blocked, or Right simply not held — falls through to the next arm at
 * ROM 0x1AF5, which asks the same two questions of the LEFT direction (D against control bit 1,
 * into walkMarioLeft) and, failing that, falls into the ladder/climb collision handler
 * (loc_1afe). The three arms are one straight-line cascade in the ROM, so movement priority is
 * fixed: right beats left beats climb.
 *
 * DIFFERENCE FROM ITS 0x1AF5 MIRROR. The two arms are near-twins in shape — decrement a verdict
 * flag, test one control bit, tail-jump to a walk routine — but they are NOT peers:
 *   - This arm gates on E and tests control bit 0 (Right) into walkMarioRight (ROM 0x1C8F);
 *     0x1AF5 gates on D and tests control bit 1 (Left) into walkMarioLeft (ROM 0x1CAB).
 *   - This arm performs the shared SETUP that 0x1AF5 only consumes: it is the one that calls
 *     the position gate and the one that loads P1_INPUT. 0x1AF5 recomputes neither — it reads
 *     the verdict and the control word this routine left behind. That makes 0x1AF5 a
 *     continuation of this routine rather than an independent entry, and it is why the hand-off
 *     below stages the control word in the accumulator: loc_1af5 takes that word in a register,
 *     exactly as the ROM fall-through delivered it. (0x1AF5 landed in the same batch as this
 *     routine and is now DIRECT-CALLED; the hand-off was an m.call to the frozen oracle until
 *     0x1AF5 was wired into ROUTINES.)
 *   - Consequently the blocked path differs in destination: blocked-right lands on the LEFT
 *     test (movement may still happen), whereas blocked-left lands on the climb handler.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1ae6.test.js.
 * GATE:     REAL CAPTURED DISPATCHES + one crafted arm. Measured reachability: a plain
 *           3000-frame attract run (no coin, no pokes) dispatches 0x1AE6 1264 times, splitting
 *           570 walk-right / 694 hand-off-to-0x1AF5; the hand-off captures cover Right-not-held
 *           for Left (0x02, 293x), Up (0x04, 377x) and the jump-edge (0x80, 24x) control words.
 *           What attract NEVER produces is the right-limit block: MARIO_X peaks at 0xE2 over all
 *           1264 dispatches, short of the gate's 0xEA threshold, so E is 0 every time and the
 *           E == 1 arm has ZERO real captures. It is covered by crafted entries instead — a real
 *           Right-held capture with MARIO_X poked identically on both sides to 0xE9 (still
 *           walks), 0xEA and 0xF0 (blocked), which pins the threshold rather than merely
 *           exercising it. Every case compares work RAM minus STACK_SCRATCH, plus pc and SP.
 *           Teeth: three broken twins, all caught — ignoring the E verdict, testing the Left
 *           control bit instead of Right (caught on 776 of the 1264 real dispatches), and
 *           omitting the accumulator staging below (caught on 293).
 * LIVE-OUT: memory-only, and no meaningful return value — loc_1ac3 tail-returns this routine's
 *           result and loc_197a discards it. The registers the oracle leaves are dead ABI: the
 *           decrement it applies to E is read by nothing in either arm's subtree (loc_236e, the
 *           only routine there that touches E at all, writes it before reading it), and the
 *           IX-relative address helper the oracle threads through as a second argument is
 *           declared by 0x1AF5 and 0x1AFE but used by neither, so it is dropped here. The one
 *           register that IS live across the hand-off is the accumulator, carrying the control
 *           word into loc_1af5. pc/SP model the single net return the whole
 *           cascade performs, supplied by the harness on the fully-idiomatic arm.
 * NAMES:    P1_INPUT (0x6010) from ram.js — bit 0 Right, bit 1 Left, both recorded there as
 *           observed. No object-record or sprite-record pointer is dereferenced here, so neither
 *           the OBJ_ nor the SPRITE_ offset namespace applies. loc_241f (ROM 0x241F) and
 *           walkMarioRight (ROM 0x1C8F) are direct-called, AS IS loc_1af5 (ROM 0x1AF5) — it
 *           landed in the same batch and is registered, so there is NO oracle boundary left in
 *           this routine. The accumulator staging below survives the dissolve because loc_1af5
 *           still takes both inputs in the register file (this routine is the one that computed
 *           them); promoting them to honest parameters is a clarify-pass job for the pair.
 *           (An earlier version of this note called 0x1AF5 the one remaining oracle boundary and
 *           said the m.call must dissolve once the callee landed. That is DONE — the dissolve
 *           happened in the same commit that wired 0x1AF5, which is the standard
 *           callee-lands-then-dissolve-every-caller step.)
 */

import { P1_INPUT } from "./ram.js";
import { loc_241f } from "./loc_241f.js";               // ROM 0x241F — horizontal position gate
import { walkMarioRight } from "./walkMarioRight.js";   // ROM 0x1C8F — one rightward walk step
import { loc_1af5 } from "./loc_1af5.js";               // ROM 0x1AF5 — the LEFT arm this hands off to

const CONTROL_RIGHT = 0x01; // P1_INPUT bit 0 — the Right direction is held
const AT_RIGHT_LIMIT = 1;   // the position gate's E verdict: Mario is at the right-hand limit

export function loc_1ae6(m) {
  const { regs, mem } = m;

  // The verdict pair and the control word are read once here and serve every arm of the cascade.
  const positionGate = loc_241f(m); // e is always 0 or 1, so testing it against 1 is exact
  const control = mem.read8(P1_INPUT);

  // Right: allowed only away from the right-hand limit, and only while the direction is held.
  if (positionGate.e !== AT_RIGHT_LIMIT && (control & CONTROL_RIGHT) !== 0) {
    return walkMarioRight(m);
  }

  // No rightward step this frame — hand the frame to the leftward arm. It is still the frozen
  // oracle and takes the control word in the accumulator, where the ROM's fall-through left it.
  // Stage the control word where the Left arm reads it: loc_1af5 takes both its inputs in the
  // register file (this routine is the one that computed them), so the hand-off is by register,
  // not by parameter. Promoting them to honest parameters is a clarify-pass job for the pair.
  regs.a = control;
  return loc_1af5(m);
}
