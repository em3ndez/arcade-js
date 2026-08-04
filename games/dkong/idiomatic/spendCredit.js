// SPDX-License-Identifier: GPL-3.0-only
/**
 * spendCredit — deduct one credit and post the credit-display refresh task.
 *
 * Called at the moment a game starts, once per player being brought in — so starting a
 * two-player game spends two credits. Each call does two things:
 *
 *   - BCD-decrement CREDITS by one, wrapping 0x00 back to 0x99. The hardware spends the
 *     credit with the ten's-complement idiom: adding the BCD representation of −1 and
 *     applying the decimal-adjust correction. The helper below reproduces that
 *     byte-for-byte, and it is the same reconstruction the credit-AWARD path uses.
 *   - Enqueue the deferred "credit changed" task onto the task ring — the same task the coin
 *     handler posts when a credit is awarded. The main loop drains it to redraw the
 *     on-screen credit count.
 *
 * NOT a leaf — it enqueues. Reads CREDITS; writes CREDITS and the task ring.
 *
 * LIVE-OUT: memory-only — CREDITS and the task ring.
 */

import { enqueueTask } from "./enqueueTask.js";
import { CREDITS } from "./names.js";

const CREDIT_TASK = 0x0400; // the task message: opcode 4, argument 0

/**
 * Packed-BCD (v - 1), wrapping 0x00 -> 0x99. Adding 0x99 is adding BCD −1, and the decimal
 * adjust that follows applies its ±0x06 / ±0x60 corrections from the half-carry and carry the
 * add produced — both reconstructed here as the hardware sets them (the add leaves the adjust
 * in its addition form). It matches for every input byte, canonical BCD or not.
 */
function bcdDecrement(v) {
  const sum = v + 0x99;
  const lo = sum & 0xff;
  const halfCarry = ((v ^ 0x99 ^ lo) & 0x10) !== 0; // the add's half-carry
  const carry = sum > 0xff; //                         the add's carry
  let correction = 0;
  if (halfCarry || (lo & 0x0f) > 9) correction |= 0x06;
  if (carry || lo > 0x99) correction |= 0x60;
  return (lo + correction) & 0xff;
}

export function spendCredit(m) {
  const { regs, mem } = m;

  // Spend one credit: CREDITS := BCD(CREDITS - 1), wrapping 0x00 -> 0x99.
  mem.write8(CREDITS, bcdDecrement(mem.read8(CREDITS)));

  // Post the deferred "credit changed" task.
  regs.de = CREDIT_TASK;
  enqueueTask(m);
}
