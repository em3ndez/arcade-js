// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { queueCreditDisplayRefresh } from "./queueCreditDisplayRefresh.js";
import { CREDIT_COUNT } from "./names.js";
/**
 * addCreditsAndQueueDisplay — the shared accumulate tail of the three coin-accrual steps.
 *
 * Adds the incoming amount to the running score byte, then clamps the stored byte to 0x63; it
 * always tails into the display-command queue step.
 *
 * LIVE-OUT: memory only — the score byte and the queued display command. No caller reads A back.
 */
const SCORE_CAP = 0x63; // per-step clamp on the running score byte

export function addCreditsAndQueueDisplay(m, a = m.regs.a) {
  const { mem8 } = m;
  const sum = u8(a + mem8[CREDIT_COUNT]);
  mem8[CREDIT_COUNT] = sum < SCORE_CAP ? sum : SCORE_CAP;
  return queueCreditDisplayRefresh(m);
}
