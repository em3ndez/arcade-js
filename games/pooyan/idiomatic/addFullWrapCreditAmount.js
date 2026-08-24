// SPDX-License-Identifier: GPL-3.0-only
import { addCreditsAndQueueDisplay } from "./addCreditsAndQueueDisplay.js";
/**
 * addFullWrapCreditAmount — full-wrap entry into the shared score-accumulate tail.
 *
 * Seeds the accumulate amount to the wrap constant and falls straight into the accumulate tail,
 * which adds it to the running score byte and clamps.
 *
 * LIVE-OUT: memory only — via the accumulate tail.
 */
const WRAP_AMOUNT = 0x63; // amount seeded on a full-ring wrap

export function addFullWrapCreditAmount(m) {
  return addCreditsAndQueueDisplay(m, WRAP_AMOUNT);
}
