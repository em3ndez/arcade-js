// SPDX-License-Identifier: GPL-3.0-only
/** tallyCoinSlot1AndAwardCredit — one frame of coin slot 1's accounting. The raw coin line is clocked into a debounce
 * shift register and only a clean rising edge (its low three bits reading 1) counts as a coin: it
 * blips the coin sound, bumps the tally, and adds a unit to the coins-inserted accumulator. Once the
 * accumulator passes the coinage threshold (coins-per-credit in the high nibble, credits awarded in
 * the low), the overshoot is carried forward and — unless the no-credit flag is set — the low nibble
 * is added to the packed-decimal credit count (saturated at 99) and its panel repainted. Either way
 * the mechanical coin counter is pulsed. LIVE-OUT: memory, plus the latched counter line. */

import { requestCoinSound } from "./requestCoinSound.js";
import { paintCreditCountPanel } from "./paintCreditCountPanel.js";
import { pulseSlot1CoinCounter } from "./pulseSlot1CoinCounter.js";
import { bcdAddByte } from "../../../core/bcd.js";
import { COIN_ACCEPTED, COIN_SLOT_1_ACCUMULATOR, COIN_SLOT_1_DEBOUNCE, COIN_SLOT_1_RATIO, CREDIT_COUNT, FREE_PLAY, IN0_MIRROR } from "./names.js";

export function tallyCoinSlot1AndAwardCredit(m) {
  const { mem8 } = m;

  const coinBit = mem8[IN0_MIRROR] & 0x01; // the coin line (bit 0)
  const debounce = ((mem8[COIN_SLOT_1_DEBOUNCE] << 1) | coinBit) & 0xff; // shift the coin line in
  mem8[COIN_SLOT_1_DEBOUNCE] = debounce;
  if ((debounce & 0x07) !== 0x01) return; // not the clean rising edge

  requestCoinSound(m);
  mem8[COIN_ACCEPTED] = mem8[COIN_ACCEPTED] + 1;

  const accumulator = (mem8[COIN_SLOT_1_ACCUMULATOR] + 0x10) & 0xff;
  mem8[COIN_SLOT_1_ACCUMULATOR] = accumulator;
  const coinage = mem8[COIN_SLOT_1_RATIO]; // coins/credit hi nibble, credits lo nibble
  if (coinage >= accumulator) return; // still short of a credit

  mem8[COIN_SLOT_1_ACCUMULATOR] = accumulator - ((coinage & 0xf0) + 0x10); // carry the overshoot forward (write8 truncates)

  if (mem8[FREE_PLAY] !== 0) return pulseSlot1CoinCounter(m);

  const { value, carry } = bcdAddByte(mem8[CREDIT_COUNT], coinage & 0x0f);
  mem8[CREDIT_COUNT] = carry ? 0x99 : value; // BCD add, saturated at 99
  paintCreditCountPanel(m);
  return pulseSlot1CoinCounter(m);
}
