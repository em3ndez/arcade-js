// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_0, loc_3d, loc_4e, loc_50, loc_600, loc_602, loc_603, loc_604, loc_605 } from "./names.js";
import { loc_ca48 } from "./loc_ca48.js";
import { loc_a789 } from "./loc_a789.js";

// Walk the packed request word two bits at a time: the first slot whose byte is 1..8 builds a scaled
// value, seeds the paired cells, arms two subsystems, and finishes; an exhausted word exits idle.
export function loc_ad22(m) {
  const { mem8 } = m;
  while (true) {
    if (mem8[loc_603] === 0) {
      mem8[loc_0] = 0x14; // exhausted
      return;
    }
    // Low two bits pick the slot index; consume them from the word.
    mem8[loc_3d] = u8((mem8[loc_603] & 0x03) - 1);
    mem8[loc_603] = mem8[loc_603] >> 1;
    mem8[loc_603] = mem8[loc_603] >> 1;
    const x = mem8[loc_3d];
    const n = mem8[u16(loc_600 + x)];
    if (n === 0 || n >= 0x09) continue; // skip empty / out-of-range slots
    // Scale, invert, and offset the slot byte into the paired value.
    let a = u8(n << 1);
    a = u8(a + n);
    a = a ^ 0xff;
    a = u8(a - 0xe5);
    mem8[loc_602] = a;
    loc_ca48(m);
    mem8[loc_605] = 0x60;
    mem8[loc_4e] = 0x00;
    mem8[loc_50] = 0x00;
    mem8[loc_604] = 0x02;
    loc_a789(m);
    mem8[loc_0] = 0x24; // armed
    return;
  }
}
