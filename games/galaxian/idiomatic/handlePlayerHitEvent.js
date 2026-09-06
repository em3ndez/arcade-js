// SPDX-License-Identifier: GPL-3.0-only
// Consume the pending hit event. If its flag's bit0 is clear, do nothing. Otherwise clear the flag,
// reset the object-active pair, arm the two pulse counters (10 and 4), queue the hit sound command, tick
// the activity countdown (floored at 0) and the [0,5] cycle counter, and — when the mode bit is set —
// raise the sound latch.
import {
  HIT_EVENT_FLAG, OBJ_ACTIVE_FLAG, loc_4201, loc_4205, loc_4206,
  loc_421a, loc_421d, loc_4006, SOUND_W_REG3,
} from "./names.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function handlePlayerHitEvent(m) {
  const { mem8 } = m;

  if ((mem8[HIT_EVENT_FLAG] & 0x01) === 0) return; // no event pending

  mem8[HIT_EVENT_FLAG] = 0;
  mem8[OBJ_ACTIVE_FLAG] = 0;   // reset the object-active pair
  mem8[loc_4201] = 1;
  mem8[loc_4205] = 10;         // arm the two pulse counters
  mem8[loc_4206] = 4;
  enqueueCommandWord(m, (2 << 8) | 5); // queue the hit sound command

  if (mem8[loc_421a] !== 0) mem8[loc_421a] = mem8[loc_421a] - 1; // activity countdown, floored at 0

  let cycle = (mem8[loc_421d] - 1) & 0xff; // step the [0,5] cycle counter, wrapping past 0 back to 5
  if (cycle >= 6) cycle = 5;
  mem8[loc_421d] = cycle;

  if (mem8[loc_4006] & 0x01) mem8[SOUND_W_REG3] = 1; // pulse the sound latch when the mode bit is set
}
