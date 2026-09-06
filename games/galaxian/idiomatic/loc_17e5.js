// SPDX-License-Identifier: GPL-3.0-only
// Sound-counter manager head. Return early while the first gate's bit0 is set. Otherwise step the pointer
// forward one cell; if the second gate's bit0 is set, hand straight to the pitch-selector dispatcher.
// Failing that, bump the pointed cell while the sound counter stays below its ceiling, then fall into the
// counter tick.
import { u16 } from "../../../core/int.js";
import { loc_4226, loc_425f, loc_41c4 } from "./names.js";
import { stageSoundPitchBySelector } from "./stageSoundPitchBySelector.js";
import { tickSoundCounterAndStagePitch } from "./tickSoundCounterAndStagePitch.js";

const COUNTER_CEILING = 96; // the pointed cell is bumped only while the sound counter stays below this

export function loc_17e5(m, ptr = m.regs.hl) {
  const { mem8 } = m;

  if (mem8[loc_4226] & 1) return;
  ptr = u16(ptr + 1);
  if (mem8[loc_425f] & 1) return stageSoundPitchBySelector(m, ptr);

  const count = mem8[loc_41c4];
  if (count < COUNTER_CEILING) mem8[ptr] = mem8[ptr] + 1;
  return tickSoundCounterAndStagePitch(m, count, ptr);
}
