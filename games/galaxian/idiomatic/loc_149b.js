// SPDX-License-Identifier: GPL-3.0-only
// Activate a secondary object slot: bail if either of the slot's two live flags is already set. Otherwise
// consume the trigger flag, mark the slot alive, clear its state byte, inherit field 6 from the source
// record, stash the trigger index, and queue an activation command word (channel 1, param = trigger index).
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const LIVE_A = 0;   // primary live flag (bit 0)
const LIVE_B = 1;   // secondary live flag (bit 0)
const STATE = 2;
const INHERIT = 6;
const TRIGGER_IDX = 7;

export function loc_149b(m, slot = m.regs.iy, source = m.regs.ix, trigger = m.regs.hl) {
  const { mem8 } = m;

  if (mem8[slot + LIVE_A] & 1) return;
  if (mem8[slot + LIVE_B] & 1) return;

  const index = trigger & 0xff;
  mem8[trigger] = 0; // consume the trigger flag
  mem8[slot + LIVE_A] = 1;
  mem8[slot + STATE] = 0;
  mem8[slot + INHERIT] = mem8[source + INHERIT];
  mem8[slot + TRIGGER_IDX] = index;
  return enqueueCommandWord(m, (1 << 8) | index, trigger);
}
