// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { GAME_MODE, MODE_DISPATCH_SEL, FRAME_COUNTER, loc_3d, INPUT_EDGE_FLAGS, SLOT_METRIC, ACTIVE_SLOT, REARM_COUNTER, PASS_COUNTER, SLOT_VALUE } from "./names.js";
import { loc_adce } from "./loc_adce.js";
import { loc_ddf7 } from "./loc_ddf7.js";
import { loc_ad22 } from "./loc_ad22.js";

// Per-frame tick of the active slot: while a countdown is idle, expire it into a reset;
// otherwise clamp the slot value to its rails, gate on the mode bits, and step the two
// counters -- re-arming when the step goes negative, else clearing the retired slot.
export function loc_ad6e(m) {
  const { mem8 } = m;
  mem8[MODE_DISPATCH_SEL] = 0x06;
  if ((mem8[FRAME_COUNTER] & 0x1f) === 0) {
    const count = u8(mem8[PASS_COUNTER] - 1);
    mem8[PASS_COUNTER] = count;
    if (count === 0) {
      mem8[GAME_MODE] = 0x14;
      return;
    }
  }

  const slot = mem8[ACTIVE_SLOT];
  const clamped = loc_adce(m, mem8[u16(SLOT_VALUE + slot)]);
  let value;
  if ((clamped & 0x80) === 0) value = clamped >= 0x1b ? 0x00 : clamped;
  else value = 0x1a;
  mem8[u16(SLOT_VALUE + slot)] = value;

  const gate = mem8[INPUT_EDGE_FLAGS] & 0x18;
  mem8[INPUT_EDGE_FLAGS] = mem8[INPUT_EDGE_FLAGS] & 0x67;
  if (gate === 0) return;

  mem8[ACTIVE_SLOT] = u8(mem8[ACTIVE_SLOT] - 1);
  const step = u8(mem8[REARM_COUNTER] - 1);
  mem8[REARM_COUNTER] = step;
  if ((step & 0x80) !== 0) {
    const idx = mem8[loc_3d];
    if (mem8[u16(SLOT_METRIC + idx)] < 0x04) loc_ddf7(m);
    loc_ad22(m);
    return;
  }
  mem8[u16(SLOT_VALUE + u8(slot - 1))] = 0x00;
}
