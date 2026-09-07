// SPDX-License-Identifier: GPL-3.0-only
//
// serviceCoinInputs — the per-frame coin/credit input front-end.
//
// WHAT IT IS
//   Runs first in the per-frame service cluster (loc_0066) and turns raw coin-mech edges into
//   either an immediate credit or ticks of a coarse coin-pulse counter. It combines the two
//   input shadows, complements them (coin lines are active-low), and masks by two guard cells so
//   only a genuine, enabled edge survives.
//
// ROLE IN THE MACHINE
//   This is the reader; the counted pulses/credits it produces are turned into banked credits by
//   the downstream coin-meter routine. In config mode 3 the whole thing is bypassed for a preset.
//
// THE CELLS
//   loc_4000    — config/coinage mode; value 3 is the special "preset credits" setting.
//   IN0_SHADOW (0x4010) | loc_4013 — the two latched input shadows (raw port + shifted history).
//   loc_4015 & loc_4016 — coin guard cells; the edge must pass both masks to count.
//   loc_4004    — coarse coin-pulse counter, ticked once (or twice) per qualifying frame.
//   bit 7 (COIN_BIT) of the combined value routes to the direct add-a-credit path instead.
//
// ROM 0x18ef.  Grounding: [seen].
// LIVE-OUT: loc_4004 (or credit state, via the delegated helpers).
import { u8 } from "../../../core/int.js";
import { loc_4000, loc_4004, loc_4013, loc_4015, loc_4016, IN0_SHADOW } from "./names.js";
import { presetCreditCount } from "./presetCreditCount.js";
import { addCreditForCoin } from "./addCreditForCoin.js";

// Config mode 3 means "preset the credit count" rather than service real coins.
const MODE_PRESET = 3;
// Bit 7 of the combined edge means a coin to grant as a credit directly.
const COIN_BIT = 0x80;

export function serviceCoinInputs(m) {
  const { mem8 } = m;

  // Preset mode short-circuits everything: hand off to the credit-count preset and return.
  if (mem8[loc_4000] === MODE_PRESET) return presetCreditCount(m);

  // Combine the two input shadows, complement (coin lines idle high), then AND with both guard
  // cells so only an enabled, genuine coin edge leaves bits set in `combined`.
  const combined = u8(~(mem8[IN0_SHADOW] | mem8[loc_4013])) & mem8[loc_4015] & mem8[loc_4016];

  // High bit set -> a coin to bank immediately: delegate to the direct-credit path and return.
  if (combined & COIN_BIT) return addCreditForCoin(m);

  // Otherwise the low two bits are the coarse coin-pulse lines; nothing set means no pulse.
  const low = combined & 3;
  if (low === 0) return;
  // At least one pulse line: tick the counter once.
  mem8[loc_4004]++;
  // A second tick lands only when BOTH low bits are set (both pulse lines active this frame).
  if (!(low & 1)) return;
  if (!(low & 2)) return;
  mem8[loc_4004]++;
}
