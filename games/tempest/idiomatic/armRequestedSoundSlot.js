// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { GAME_MODE, loc_3d, INPUT_EDGE_FLAGS, SPINNER_ACCUM, SLOT_METRIC, ACTIVE_SLOT, REQUEST_BITS, REARM_COUNTER, PASS_COUNTER } from "./names.js";
import { selectProjectionScale } from "./selectProjectionScale.js";
import { resetPerSlotStateTable } from "./resetPerSlotStateTable.js";

// Walk the packed request word two bits at a time: the first slot whose byte is 1..8 builds a scaled
// value, seeds the paired cells, arms two subsystems, and finishes; an exhausted word exits idle.
export function armRequestedSoundSlot(m) {
  const { mem8 } = m;
  while (true) {
    if (mem8[REQUEST_BITS] === 0) {
      mem8[GAME_MODE] = 0x14; // exhausted
      return;
    }
    // Low two bits pick the slot index; consume them from the word.
    mem8[loc_3d] = u8((mem8[REQUEST_BITS] & 0x03) - 1);
    mem8[REQUEST_BITS] = mem8[REQUEST_BITS] >> 1;
    mem8[REQUEST_BITS] = mem8[REQUEST_BITS] >> 1;
    const x = mem8[loc_3d];
    const n = mem8[u16(SLOT_METRIC + x)];
    if (n === 0 || n >= 0x09) continue; // skip empty / out-of-range slots
    // Scale, invert, and offset the slot byte into the paired value.
    let a = u8(n << 1);
    a = u8(a + n);
    a = a ^ 0xff;
    a = u8(a - 0xe5);
    mem8[ACTIVE_SLOT] = a;
    selectProjectionScale(m);
    mem8[PASS_COUNTER] = 0x60;
    mem8[INPUT_EDGE_FLAGS] = 0x00;
    mem8[SPINNER_ACCUM] = 0x00;
    mem8[REARM_COUNTER] = 0x02;
    resetPerSlotStateTable(m);
    mem8[GAME_MODE] = 0x24; // armed
    return;
  }
}
