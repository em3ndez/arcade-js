// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1df5 — pick one of three effect-sprite setters from two bits of RANDOM.  ROM 0x1df5.
 *
 * The RNG tail of loc_1dc9 (sub_1dbd's 0x6340==1 entry): loc_1dc9 tail-jumps here when
 * 0x6342 bit2 is set. loc_1df5 reads the PRNG accumulator RANDOM (0x6018) and dispatches
 * on its low two bits to one of the three sibling setters, which differ ONLY in the fixed
 * (B = sprite code, DE = deferred-task message) pair each stages before delegating to the
 * shared feeder loc_1e15:
 *
 *   RANDOM bit0 set             -> loc_1e08 (B=0x7E, DE=0x0005)
 *   bit0 clear, bit1 set        -> loc_1e10 (B=0x7F, DE=0x0008)
 *   bit0 clear, bit1 clear      -> loc_1e00 (B=0x7D, DE=0x0003)   [fall-through]
 *
 * The oracle extracts the bits with two `rra`s (carry = bit0, then bit1); `& 0x01` /
 * `& 0x02` is the same test without the register model. The oracle's last case is a
 * fall-through into loc_1e00 (no `jp`), modelled here as the else arm. Each arm's `jp` is
 * a TAIL JUMP — a direct JS call in this layer, so the Z80 stack becomes the JS call
 * stack. loc_1df5 WRITES no memory of its own and READS only RANDOM; the rotated A it
 * leaves is dead (the arm chains overwrite it before any use, and loc_1dc9's caller reads
 * no register after the tail).
 *
 * NAME: kept the neutral loc_ — the MECHANICS are certain (dispatch on two RNG bits to
 * three constant-setters), but naming it for the effect would inherit exactly the
 * game-identity the whole family (loc_1e00/1e08/1e10/1e15/1e36, and the sibling dispatcher
 * loc_1dc9) declined to claim to the routine-name evidence bar. Promote the family
 * together once the effect is corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1df5.test.js.
 * GATE:     exhaustive (dispatch) — loc_1df5's only input is RANDOM's low two bits, so on
 *           real captured 0x1df5 bases (attract reaches this via loc_1dc9's 0x6342-bit2
 *           tail) sweep RANDOM 0..255 identically on both sides and compare RAM −
 *           STACK_SCRATCH; all three arms are exercised and each swept value's arm is
 *           pinned by the B stamped at record byte 0x6A31. Plus real captured dispatches
 *           (natural RNG) for realism. Teeth: an arm-swap twin caught at 0x6A31.
 * LIVE-OUT: memory-only — nothing here; everything is written by the CHOSEN arm's loc_1e15
 *           chain: the task ring + TASK_TAIL (enqueueTask), the block[0] clear at *(0x6343),
 *           and the sprite record 0x6A30..0x6A33 + the board-gated sound 0x6085 (loc_1e36).
 *           The rotated A, and B/C/DE/HL/flags, are all dead; SP/pc are the dropped stack
 *           model (the oracle's tail jumps become direct calls).
 * NAMES:    RANDOM (0x6018, ram.js) is the PRNG accumulator dispatched on. The three arms
 *           loc_1e00 / loc_1e08 / loc_1e10 (ROM 0x1E00 / 0x1E08 / 0x1E10) are the idiomatic
 *           callees, imported and called directly; each owns its own constants and the
 *           downstream RAM writes.
 */
import { RANDOM } from "../optimized/ram.js";
import { loc_1e00 } from "./loc_1e00.js"; // ROM 0x1E00 — both bits clear
import { loc_1e08 } from "./loc_1e08.js"; // ROM 0x1E08 — bit0 set
import { loc_1e10 } from "./loc_1e10.js"; // ROM 0x1E10 — bit0 clear, bit1 set

export function loc_1df5(m) {
  const rnd = m.mem.read8(RANDOM);

  // `rra` (carry = bit0) then `jp c,0x1e08`.
  if (rnd & 0x01) return loc_1e08(m);
  // second `rra` (carry = bit1) then `jp c,0x1e10`.
  if (rnd & 0x02) return loc_1e10(m);
  // fall-through into loc_1e00 (both bits clear).
  return loc_1e00(m);
}
