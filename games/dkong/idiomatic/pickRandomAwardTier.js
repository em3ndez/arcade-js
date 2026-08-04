// SPDX-License-Identifier: GPL-3.0-only
/**
 * pickRandomAwardTier — pick one of three award-popup tiers from two bits of RANDOM.
 *
 * The random tail of the effect machine's arm-timer state, taken when that state's selector
 * byte has its third bit set. This routine reads the PRNG accumulator RANDOM and dispatches
 * on its low two bits to one of three sibling setters, which differ ONLY in the fixed pair
 * each stages — a sprite code and a deferred-task message — before delegating to the shared
 * popup feeder:
 *
 *   RANDOM bit0 set          -> the 500 tier
 *   bit0 clear, bit1 set     -> the 800 tier
 *   both bits clear          -> the 300 tier
 *
 * It WRITES no memory of its own and READS only RANDOM.
 *
 * LIVE-OUT: memory-only, and none of it written here — the chosen tier posts the deferred
 * task, clears the effect block's first byte, and stamps the popup sprite record and its
 * board-gated sound.
 */
import { RANDOM } from "./names.js";
import { stageAward300Popup } from "./stageAward300Popup.js";
import { stageAward500Popup } from "./stageAward500Popup.js";
import { stageAward800Popup } from "./stageAward800Popup.js";

export function pickRandomAwardTier(m) {
  const rnd = m.mem.read8(RANDOM);

  // Low bit set: the 500 tier.
  if (rnd & 0x01) return stageAward500Popup(m);
  // Next bit set: the 800 tier.
  if (rnd & 0x02) return stageAward800Popup(m);
  // Both clear: the 300 tier.
  return stageAward300Popup(m);
}
