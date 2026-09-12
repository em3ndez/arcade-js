// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_00, loc_1, loc_3, loc_3d, loc_4e, loc_600, loc_602, loc_604, loc_605, loc_606 } from "./names.js";
import { loc_adce } from "./loc_adce.js";
import { loc_ddf7 } from "./loc_ddf7.js";
import { loc_ad22 } from "./loc_ad22.js";

// Per-frame tick of the active slot: while a countdown is idle, expire it into a reset;
// otherwise clamp the slot value to its rails, gate on the mode bits, and step the two
// counters -- re-arming when the step goes negative, else clearing the retired slot.
export function loc_ad6e(m) {
  const { mem8 } = m;
  mem8[loc_1] = 0x06;
  if ((mem8[loc_3] & 0x1f) === 0) {
    const count = u8(mem8[loc_605] - 1);
    mem8[loc_605] = count;
    if (count === 0) {
      mem8[loc_00] = 0x14;
      return;
    }
  }

  const slot = mem8[loc_602];
  const clamped = loc_adce(m, mem8[u16(loc_606 + slot)]);
  let value;
  if ((clamped & 0x80) === 0) value = clamped >= 0x1b ? 0x00 : clamped;
  else value = 0x1a;
  mem8[u16(loc_606 + slot)] = value;

  const gate = mem8[loc_4e] & 0x18;
  mem8[loc_4e] = mem8[loc_4e] & 0x67;
  if (gate === 0) return;

  mem8[loc_602] = u8(mem8[loc_602] - 1);
  const step = u8(mem8[loc_604] - 1);
  mem8[loc_604] = step;
  if ((step & 0x80) !== 0) {
    const idx = mem8[loc_3d];
    if (mem8[u16(loc_600 + idx)] < 0x04) loc_ddf7(m);
    loc_ad22(m);
    return;
  }
  mem8[u16(loc_606 + u8(slot - 1))] = 0x00;
}
