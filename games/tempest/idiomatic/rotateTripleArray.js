// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { COLOR_CYCLE_0, COLOR_RAM_9 } from "./names.js";

// Rotate the three-entry array down by one, threading the displaced value, and
// mirror each new entry into the paired array.
export function rotateTripleArray(m) {
  const { mem8 } = m;
  let carry = mem8[COLOR_CYCLE_0];              // the entry that wraps around
  for (let x = 2; x >= 0; x--) {
    const old = mem8[u16(COLOR_CYCLE_0 + x)];
    mem8[u16(COLOR_CYCLE_0 + x)] = carry;
    mem8[u16(COLOR_RAM_9 + x)] = carry;     // mirror the new value
    carry = old;
  }
}
