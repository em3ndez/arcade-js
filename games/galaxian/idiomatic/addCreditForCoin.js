// SPDX-License-Identifier: GPL-3.0-only
/**
 * addCreditForCoin — credit the machine for one accepted coin and cue the credit-count HUD redraw.
 *
 * WHAT IT IS
 *   The coin-service credit bump. When serviceCoinInputs (0x18ef) sees the coin bit set, it calls here:
 *   if the credit count is below its cap, bump it, raise a service event flag, and enqueue a command
 *   that repaints the credit-count digits. At the cap it is a no-op, so coins beyond 99 credits are
 *   silently ignored.
 *
 * ROLE IN THE MACHINE
 *   The credit count lives in loc_4002 (0x4002), capped at 99. loc_41c9 (0x41c9) is the credit-service
 *   event flag this raises to 1. The enqueued channel-7 word (arg 1) drives the credit-count HUD redraw
 *   (the dispatch renders 0x4002, capped at 99, as two BCD digits into the credit field). enqueueCommandWord
 *   is passed loc_4002 as the restored-HL argument.
 *
 * ROM 0x191e.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: enqueueCommandWord's result; credit count 0x4002, event flag 0x41c9, and the command queue
 * are written on a successful bump. Nothing is written at the cap.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { loc_4002, loc_41c9 } from "./names.js";

// Credit count saturates at 99; the redraw command is a channel-7 word with arg 1.
const CAP = 99;
const EVENT_WORD = (7 << 8) | 1;

export function addCreditForCoin(m) {
  const { mem8 } = m;

  // At the 99-credit cap, drop the coin: no bump, no event, no redraw.
  if (mem8[loc_4002] >= CAP) return;
  // Bump the credit count and raise the credit-service event flag.
  mem8[loc_4002]++;
  mem8[loc_41c9] = 1;
  // Enqueue the credit-count HUD redraw (channel-7 arg 1); loc_4002 is the enqueue's restored HL.
  return enqueueCommandWord(m, EVENT_WORD, loc_4002);
}
