// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_37, loc_40, loc_42, loc_55, loc_56, loc_57, loc_58, loc_5b, loc_5f,
  loc_9e, loc_9f, loc_a0, loc_115, loc_11f, loc_200, loc_3fe,
} from "./names.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_bd09 } from "./loc_bd09.js";

// While the guard flag is set, force three cursor cells and, for each nonzero slot in
// the eight-entry table, pick a draw mode and emit it; then restore the saved cells.
// Tail: when the second flag is set and the counter is high enough, bump one counter.
export function loc_c54d(m) {
  const { mem8 } = m;
  if (mem8[loc_115] !== 0) {
    const save5f = mem8[loc_5f];
    const save5b = mem8[loc_5b];
    const saveA0 = mem8[loc_a0];
    mem8[loc_5f] = 0xe8;
    mem8[loc_5b] = 0xff;
    mem8[loc_a0] = 0x28;
    // Walk the eight slots top-down; the shared index wraps past zero to end the pass.
    mem8[loc_37] = 0x07;
    for (;;) {
      const slot = mem8[loc_37];
      const entry = mem8[u16(loc_3fe + slot)];
      if (entry !== 0) {
        mem8[loc_57] = entry;
        mem8[loc_56] = 0x80;
        mem8[loc_58] = 0x80;
        let mode;
        if (mem8[loc_9f] >= 0x05) {
          mode = slot & 0x07;
          if (mode === 0x07) mode = 0x04;
        } else {
          mode = 0x06;
        }
        mem8[loc_9e] = mode;
        loc_df4c(m, 0x08, mem8[loc_9e]);
        mem8[loc_55] = u8(((slot & 0x03) << 1) + 0x0a);
        loc_bd09(m);
      }
      mem8[loc_37] = u8(mem8[loc_37] - 1);
      if (mem8[loc_37] & 0x80) break;
    }
    mem8[loc_a0] = saveA0;
    mem8[loc_5b] = save5b;
    mem8[loc_5f] = save5f;
  }
  if (mem8[loc_11f] === 0) return;
  if (mem8[loc_42] < 0x15) return;
  const k = mem8[loc_40];
  mem8[u16(loc_200 + k)] = u8(mem8[u16(loc_200 + k)] + 1);
}
