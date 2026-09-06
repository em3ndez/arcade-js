// SPDX-License-Identifier: GPL-3.0-only
// Per-tick stage-advance handler. Bails unless the enable flag is set and its countdown reaches zero.
// On that tick it disarms the enable, refills the flag block from a packed template, reseeds the
// formation anchor, steps the stage selector (saturating at the max), enqueues a command word, and
// services a pending two-slot request.
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import {
  loc_4222, loc_4223, loc_421a, loc_425f, loc_420e, loc_421b, loc_421e,
  loc_4177, loc_4178, loc_051b, loc_0700,
} from "./names.js";

const SELECTOR_MAX = 7;

export function loc_1637(m) {
  const { mem8, mem16 } = m;

  // Gate: the enable flag's bit 0 must be set and the countdown must land on zero this tick.
  if (!(mem8[loc_4222] & 1)) return;
  const countdown = (mem8[loc_4223] - 1) & 0xff;
  mem8[loc_4223] = countdown;
  if (countdown !== 0) return;

  // Disarm the enable and rebuild the 128-flag block from the packed template.
  mem8[loc_4222] = 0;
  unpackBitmaskToFlagBytes(m, loc_051b);

  mem8[loc_421a] = 0;
  mem8[loc_425f] = 0;
  mem16[loc_420e] = 1; // reseed the formation anchor

  // Step the stage selector: its high byte counts up, its low byte advances but saturates at the max.
  const sel = mem16[loc_421b];
  const low = sel & 0xff;
  const nextHigh = ((sel >> 8) + 1) & 0xff;
  const nextLow = low < SELECTOR_MAX ? low + 1 : SELECTOR_MAX;
  mem16[loc_421b] = (nextHigh << 8) | nextLow;

  enqueueCommandWord(m, loc_0700);

  // Service a pending request: raise the first slot, decrement the count, raise the second while it remains.
  const request = mem8[loc_421e];
  if (request === 0) return;
  mem8[loc_4177] = 1;
  const remaining = (request - 1) & 0xff;
  mem8[loc_421e] = remaining;
  if (remaining === 0) return;
  mem8[loc_4178] = 1;
  mem8[loc_421e] = 0;
}
