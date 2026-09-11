// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_203, loc_243, loc_3ab, loc_60ca } from "./names.js";

// Clear a 64-byte tag table, then for each active slot store a 4-bit random and
// pack the slot index with it into the tag, substituting 0x0f when the tag is zero.
export function loc_9246(m) {
  const { mem8 } = m;
  for (let x = 0x3f; x >= 0; x--) mem8[u16(loc_243 + x)] = 0;
  let x = u8(mem8[loc_3ab] - 1);
  do {
    const rand = mem8[loc_60ca] & 0x0f;
    mem8[u16(loc_203 + x)] = rand;
    const tag = u8(x << 4) | rand;
    mem8[u16(loc_243 + x)] = tag === 0 ? 0x0f : tag;
    x = u8(x - 1);
  } while (!(x & 0x80));
}
