// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_INDEX_TABLE, OBJECT_RECORD_TABLE, FIRE_GATE, POKEY1_RANDOM } from "./names.js";

// Clear a 64-byte tag table, then for each active slot store a 4-bit random and
// pack the slot index with it into the tag, substituting 0x0f when the tag is zero.
export function seedSlotRandomTags(m) {
  const { mem8 } = m;
  for (let x = 0x3f; x >= 0; x--) mem8[u16(OBJECT_RECORD_TABLE + x)] = 0;
  let x = u8(mem8[FIRE_GATE] - 1);
  do {
    const rand = mem8[POKEY1_RANDOM] & 0x0f;
    mem8[u16(OBJECT_INDEX_TABLE + x)] = rand;
    const tag = u8(x << 4) | rand;
    mem8[u16(OBJECT_RECORD_TABLE + x)] = tag === 0 ? 0x0f : tag;
    x = u8(x - 1);
  } while (!(x & 0x80));
}
