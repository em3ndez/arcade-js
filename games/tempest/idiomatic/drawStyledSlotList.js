// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SPIKE_ACTIVE_FLAG, SLOT_LOOP_INDEX, ENEMY_DEPTH, OBJ_DEPTH, ENEMY_SLOT_FLAGS, DRAW_STYLE } from "./names.js";
import { loc_b5d7 } from "./loc_b5d7.js";

// When the guard flag is clear, walk seven slots high-to-low; for each nonzero control
// byte cache it, split the paired slot byte into a style nibble and a doubled selector,
// then dispatch the draw handler that selector chooses for the slot.
export function drawStyledSlotList(m) {
  const { mem8 } = m;
  if (mem8[SPIKE_ACTIVE_FLAG] & 0x80) return;
  mem8[SLOT_LOOP_INDEX] = 0x06;                     // SLOT_LOOP_INDEX is the loop counter, seeded at 6
  while (true) {
    const x = mem8[SLOT_LOOP_INDEX];
    const ctrl = mem8[u16(ENEMY_DEPTH + x)];
    if (ctrl !== 0) {
      mem8[OBJ_DEPTH] = ctrl;
      const paired = mem8[u16(ENEMY_SLOT_FLAGS + x)];
      mem8[DRAW_STYLE] = (paired & 0x18) >> 3;
      loc_b5d7(m, (paired & 0x07) << 1, x); // the dispatch handler reads the slot index x
    }
    const dv = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;   // decrement and stop once it goes negative
    mem8[SLOT_LOOP_INDEX] = dv;
    if (dv & 0x80) break;
  }
}
