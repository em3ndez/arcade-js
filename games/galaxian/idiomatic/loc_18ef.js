// SPDX-License-Identifier: GPL-3.0-only
// Per-frame coin/input service. In mode 3, hand off to the credit-count preset. Otherwise combine the two
// input shadows, complement them, and mask by the two guard cells: with the high bit set, add a credit;
// else each of the low two bits ticks the counter once.
import { u8 } from "../../../core/int.js";
import { loc_4000, loc_4004, loc_4013, loc_4015, loc_4016, IN0_SHADOW } from "./names.js";
import { presetCreditCount } from "./presetCreditCount.js";
import { addCreditForCoin } from "./addCreditForCoin.js";

const MODE_PRESET = 3;
const COIN_BIT = 0x80;

export function loc_18ef(m) {
  const { mem8 } = m;

  if (mem8[loc_4000] === MODE_PRESET) return presetCreditCount(m);

  const combined = u8(~(mem8[IN0_SHADOW] | mem8[loc_4013])) & mem8[loc_4015] & mem8[loc_4016];
  if (combined & COIN_BIT) return addCreditForCoin(m);

  const low = combined & 3;
  if (low === 0) return;
  mem8[loc_4004]++;
  if (!(low & 1)) return;
  if (!(low & 2)) return;
  mem8[loc_4004]++;
}
