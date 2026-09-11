// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_22, loc_809 } from "./names.js";

// Rotate the three-entry array down by one, threading the displaced value, and
// mirror each new entry into the paired array.
export function loc_b875(m) {
  const { mem8 } = m;
  let carry = mem8[loc_22];              // the entry that wraps around
  for (let x = 2; x >= 0; x--) {
    const old = mem8[u16(loc_22 + x)];
    mem8[u16(loc_22 + x)] = carry;
    mem8[u16(loc_809 + x)] = carry;     // mirror the new value
    carry = old;
  }
}
