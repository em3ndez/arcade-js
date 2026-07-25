// SPDX-License-Identifier: GPL-3.0-only
/**
 * spendCredit — deduct one credit and post the credit-display refresh task.  ROM 0x0977.
 *
 * Called at the moment a game starts, once per player being brought in: the credited-
 * state start handler loc_08f8 calls it once on the 1-player start arm (loc_0906) and
 * twice on the 2-player arm (loc_0919), so starting a 2P game spends two credits. Each
 * call does two things:
 *
 *   - BCD-decrement CREDITS (0x6001) by one, wrapping 0x00 -> 0x99. The oracle spends
 *     the credit with the classic Z80 ten's-complement idiom `ld a,0x99 / add a,(hl) /
 *     daa`: 0x99 is BCD -1, so `daa(0x99 + CREDITS)` is BCD(CREDITS - 1). bcdDecrement
 *     reproduces that add/daa byte-for-byte (it is bcdAdd(v, 0x99) — the same proven DAA
 *     reconstruction serviceCoinInput uses for the credit-AWARD path, ROM 0x01B0).
 *   - Enqueue the deferred task [opcode 0x04, arg 0x00] onto the task ring (enqueueTask,
 *     ROM 0x309F). This is the same "credit changed" task serviceCoinInput posts when a
 *     credit is awarded; the main loop drains it to redraw the on-screen credit count.
 *
 * NOT a leaf — it calls enqueueTask. Reads CREDITS; writes CREDITS + the task ring.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0977.test.js.
 * GATE:     crafted-entry — a real captured dispatch (attract inserts no coin, so 0x0977
 *           fires only on start; a coin+start input tape drives the credited state and one
 *           real 1P-start dispatch) covers the CREDITS==1 write arm. The full BCD decrement
 *           (all 256 CREDITS bytes, incl. the 0x00->0x99 wrap and non-canonical inputs) and
 *           the task-ring DROP / WRAP arms are crafted, poked identically on both sides.
 * LIVE-OUT: memory-only — CREDITS and the task ring (TASK_RING + TASK_TAIL, written by
 *           enqueueTask). The sole caller loc_08f8 reads no register/flag from the return
 *           before overwriting it (the 1P arm sets HL next, the 2P arm sets DE next), so the
 *           oracle's residual A/HL/F are dead ABI. pc/SP are the dropped stack model — the
 *           oracle's push16+call+ret becomes a plain JS call here — so the only oracle-vs-
 *           idiomatic residue is the pushed bytes in STACK_SCRATCH, excluded by the contract.
 * NAMES:    CREDITS (0x6001) from ram.js. Hex-kept: 0x0400 = the credit task message
 *           (D = opcode 0x04, E = arg 0x00). enqueueTask imported for the ROM 0x309F callee.
 */

import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F
import { CREDITS } from "../optimized/ram.js";

const CREDIT_TASK = 0x0400; // enqueueTask message: D = opcode 0x04, E = arg 0x00

/**
 * Packed-BCD (v - 1), wrapping 0x00 -> 0x99. This is the oracle's `ld a,0x99 /
 * add a,(hl) / daa`: 0x99 is BCD -1, so it is exactly bcdAdd(v, 0x99). DAA's
 * ±0x06 / ±0x60 corrections depend on the half-carry and carry the ADD produced,
 * both reconstructed here as the Z80 ALU sets them (add clears N, so DAA is in its
 * add form) — matching the oracle for every input byte, canonical BCD or not.
 */
function bcdDecrement(v) {
  const sum = v + 0x99;
  const lo = sum & 0xff;
  const halfCarry = ((v ^ 0x99 ^ lo) & 0x10) !== 0; // add's H flag
  const carry = sum > 0xff; //                         add's C flag
  let correction = 0;
  if (halfCarry || (lo & 0x0f) > 9) correction |= 0x06;
  if (carry || lo > 0x99) correction |= 0x60;
  return (lo + correction) & 0xff;
}

export function spendCredit(m) {
  const { regs, mem } = m;

  // Spend one credit: CREDITS := BCD(CREDITS - 1), wrapping 0x00 -> 0x99.
  mem.write8(CREDITS, bcdDecrement(mem.read8(CREDITS)));

  // Post the deferred "credit changed" task (D = opcode 0x04, E = arg 0x00).
  regs.de = CREDIT_TASK;
  enqueueTask(m); // ROM 0x309F
}
