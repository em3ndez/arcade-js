// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e10 — effect-sprite setter: load (B, DE) then hand off to the feeder loc_1e15.
 * ROM 0x1e10.
 *
 * The third of sub_1dbd's (0x6340) three constant setters — loc_1e00 (B=0x7D,
 * DE=0x0003), loc_1e08 (B=0x7E, DE=0x0005) and this one — each of which loads its own
 * fixed (B, DE) parameter pair and tail-jumps into the shared feeder loc_1e15. B is the
 * effect sprite's code byte and DE is the deferred-task message (D = opcode 0, E =
 * argument 8); both are pure parameters this routine sets, and loc_1e15 then posts the
 * task, reads the sprite's X/Y from the 0x6343 parameter block, and stamps the 4-byte
 * hardware sprite record (see loc_1e15 / loc_1e36).
 *
 * loc_1e10 READS nothing — it overwrites B and DE with constants regardless of their
 * entry value — so its whole contribution is those two register loads plus the tail-jump.
 * The oracle's `jp 0x1e15` is a tail JUMP (no push): in the idiomatic layer that is a
 * direct call to loc_1e15, and the Z80 stack becomes the JS call stack.
 *
 * NAME: kept the neutral loc_ — the mechanics are certain (set two constants, delegate),
 * but the specific effect this sprite is (and thus a meaningful English name) is not
 * confirmed to the routine-name evidence bar. Its sibling setters loc_1e00/1e08 and
 * loc_3e70, and the feeder loc_1e15 / tail loc_1e36, all stayed neutral for the same
 * reason; promoting this setter past them would overclaim. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e10.test.js.
 * GATE:     crafted-entry — attract never dispatches 0x1e10 (it plays level-1 25m only:
 *           loc_1dc9's `jp 0x1e10` tail needs level >= 3, and loc_1df5's `jp c,0x1e10`
 *           needs RNG 0x6018 bit1 set). Validated on (a) a GENUINE 0x1e10 entry forced
 *           down the loc_1df5 RNG path (poke 0x6018 bit1 identically, real state
 *           otherwise), (b) real captured 0x1e15-boundary states — a faithful loc_1e10
 *           continuation, since loc_1e10 reads neither B nor DE — and (c) a BOARD-
 *           exhaustive sweep (0..255) covering loc_1e36's 50m/100m closed sound gate.
 *           Teeth: wrong-B (caught at record byte 0x6A31) and wrong-E (caught at the
 *           task ring's argument byte).
 * LIVE-OUT: memory-only — everything is written by the loc_1e15 chain: the task ring +
 *           TASK_TAIL (via enqueueTask), the block[0] clear at *(0x6343), and the sprite
 *           record 0x6A30..0x6A33 + gate-open 0x6085 (via loc_1e36). B/D/E are set only
 *           as loc_1e15's live-in and are consumed within this same dispatch; the caller
 *           (loc_1dc9 / loc_1df5 tail-jump here) reads no register afterward. SP/pc are
 *           the dropped stack model — the oracle's tail-jump becomes the JS call.
 * NAMES:    loc_1e15 (ROM 0x1E15) is the idiomatic feeder, imported and called directly;
 *           it owns all the RAM writes and their ram.js names. The literals 0x7F (B, the
 *           sprite code byte) and 0x0008 (DE, the deferred-task message) are this setter's
 *           fixed parameters, kept as literals exactly as the oracle loads them.
 */
import { loc_1e15 } from "./loc_1e15.js"; // ROM 0x1E15 — the shared feeder

export function loc_1e10(m) {
  const { regs } = m;

  // The setter's fixed parameters: B = the effect sprite's code byte; DE = the
  // deferred-task message (D = opcode 0x00, E = argument 0x08).
  regs.b = 0x7f;
  regs.de = 0x0008;

  // `jp 0x1e15` — tail-jump into the shared feeder. B and DE are its live-in.
  loc_1e15(m);
}
