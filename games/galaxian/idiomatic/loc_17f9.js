// SPDX-License-Identifier: GPL-3.0-only
// Sound-counter manager tail: when the counter is still running, decrement it and store it back to the
// sound counter cell; either way, stage the sound pitch keyed on the low two bits at the pointer.
import { u8 } from "../../../core/int.js";
import { loc_41c4 } from "./names.js";
import { stageSoundPitchBySelector } from "./stageSoundPitchBySelector.js";

export function loc_17f9(m, count = m.regs.a, cell = m.regs.hl) {
  if (count !== 0) m.mem8[loc_41c4] = u8(count - 1);
  return stageSoundPitchBySelector(m, cell);
}
