// SPDX-License-Identifier: GPL-3.0-only
/**
 * spendCredit — BCD-decrement CREDITS by one (wrapping 0x00 -> 0x99) and post the credit-display
 * refresh task. Called once per player brought in at game start.
 *
 * LIVE-OUT: memory-only — CREDITS and the task ring.
 */

import { enqueueTask } from "./enqueueTask.js";
import {
  CREDITS,
  CREDIT_DISPLAY_TASK,
} from "./names.js";


/** Packed-BCD (v - 1), wrapping 0x00 -> 0x99. */
function bcdDecrement(v) {
  const sum = v + 0x99;
  const lo = sum & 0xff;
  const halfCarry = ((v ^ 0x99 ^ lo) & 0x10) !== 0;
  const carry = sum > 0xff;
  let correction = 0;
  if (halfCarry || (lo & 0x0f) > 9) correction |= 0x06;
  if (carry || lo > 0x99) correction |= 0x60;
  return (lo + correction) & 0xff;
}

export function spendCredit(m) {
  const { regs, mem8 } = m;

  mem8[CREDITS] = bcdDecrement(mem8[CREDITS]);

  regs.de = CREDIT_DISPLAY_TASK;
  enqueueTask(m);
}
