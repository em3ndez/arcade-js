// SPDX-License-Identifier: GPL-3.0-only
/**
 * pickRandomAwardTier — dispatch on the low two bits of RANDOM to one of three award-tier setters:
 * bit0 set the 500 tier, bit0 clear/bit1 set the 800 tier, both clear the 300 tier.
 *
 * LIVE-OUT: memory-only, none written here — the chosen setter does the work.
 */
import { RANDOM } from "./names.js";
import { stageAward300Popup } from "./stageAward300Popup.js";
import { stageAward500Popup } from "./stageAward500Popup.js";
import { stageAward800Popup } from "./stageAward800Popup.js";

export function pickRandomAwardTier(m) {
  const { mem8 } = m;
  const rnd = mem8[RANDOM];

  if (rnd & 0x01) return stageAward500Popup(m);
  if (rnd & 0x02) return stageAward800Popup(m);
  return stageAward300Popup(m);
}
