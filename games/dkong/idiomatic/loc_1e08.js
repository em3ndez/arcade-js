// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e08 — stage this effect's (sprite-code, deferred-task) constants, then run the
 * shared effect handler.  ROM 0x1e08.
 *
 * One of three sibling setters that all tail-jump into the shared convergence loc_1e15,
 * each loading its own two constants first:
 *
 *   loc_1e00 : B = 0x7D, DE = 0x0003
 *   loc_1e08 : B = 0x7E, DE = 0x0005   <- this one (the middle set)
 *   loc_1e10 : B = 0x7F, DE = 0x0008
 *
 * B is the sprite's code byte that loc_1e15's tail (loc_1e36) stamps into the effect
 * record at 0x6A31; DE is the deferred-task message enqueueTask posts (D = opcode 0x00,
 * E = argument 0x05). All memory work happens downstream in loc_1e15 — the task post,
 * the 0x6343 param-block read + byte-0 clear, and the 0x6A30 record stamp + board-gated
 * sound. This routine only stages B/DE and delegates; the Z80 `jp 0x1e15` tail-jump
 * becomes a direct JS call. Reached from loc_1dc9 / loc_1df5 (level-gated paths), not
 * from attract.
 *
 * NAME: kept the neutral loc_ — its callee loc_1e15 and that chain's tail loc_1e36 both
 * stayed neutral because the effect's game-identity (plausibly a score-popup: sprite
 * code 0x7E with a +500 award) is an inference, not confirmed to the routine-name
 * evidence bar. Promoting the feeder past its own tail would overclaim exactly what the
 * tail declined; promote the family together once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e08.test.js.
 * GATE:     crafted-entry — attract never dispatches loc_1e08 (its callers are level-2+
 *           paths the 25m demo doesn't take), so it is gated by cloning REAL loc_1e15
 *           entry states (the exact live-in a `jp 0x1e15` lands in) and running the
 *           oracle vs idiomatic loc_1e08 on each — both stage the identical B/DE, so the
 *           captured base is a faithful crafted entry. Arms: the captured-base replay,
 *           the inherited BOARD-exhaustive (loc_1e36's gate) / param-block / full-ring
 *           DROP sweeps, all identical on both sides. Two teeth on loc_1e08's OWN
 *           contribution: a wrong B constant (caught at record byte 0x6A31) and a wrong
 *           DE constant (caught at the ring argument slot).
 * LIVE-OUT: memory-only — everything loc_1e15 writes (task ring + TASK_TAIL via
 *           enqueueTask, the *(0x6343) byte-0 clear, the 0x6A30..0x6A33 record + gate-open
 *           0x6085 via loc_1e36). B/DE are consumed inside this same dispatch (loc_1e15's
 *           live-in) and the caller reads no register afterward, so B/D/E/A/C/HL and all
 *           flags are dead. SP/pc are the dropped stack model — the oracle's `jp`/`call`/
 *           `ret` chain becomes the JS call stack.
 * NAMES:    loc_1e15 (ROM 0x1E15) is the idiomatic callee, imported and called directly.
 *           B = 0x7E and DE = 0x0005 are ROM-literal payload constants (a sprite code and
 *           a task message), not RAM addresses, so they stay raw hex.
 */
import { loc_1e15 } from "./loc_1e15.js"; // ROM 0x1E15

export function loc_1e08(m) {
  const { regs } = m;

  // Stage this effect's constants: B = the sprite code loc_1e36 stamps at 0x6A31,
  // DE = the deferred-task message enqueueTask posts (D = 0x00 opcode, E = 0x05 argument).
  regs.b = 0x7e;
  regs.de = 0x0005;

  // Z80 `jp 0x1e15` tail-jump -> a direct call into the shared effect handler.
  loc_1e15(m);
}
