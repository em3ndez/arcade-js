// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_38, loc_61, loc_62, loc_63, loc_64, loc_6a, loc_6b, loc_6c, loc_6d,
  loc_74, loc_a9, loc_35a, loc_36a, loc_37a, loc_38a,
} from "./names.js";

// Round-up signed average of two 16-bit bytes (halve preserving the sign bit).
function halfSum(loA, hiA, loB, hiB) {
  const loSum = loA + loB + 1;
  const low = loSum & 0xff;
  const carry = loSum > 0xff ? 1 : 0;
  const high = (hiA + hiB + carry) & 0xff;
  return [(low >> 1) | ((high & 0x01) << 7), (high >> 1) | (high & 0x80)];
}

// Average one slot's two coordinate pairs with its wrap-around neighbour, stash the two
// midpoints, then append the four midpoint bytes to the pointer-based display list (high
// bytes masked to 0x1f) and mirror all four into a scratch block.
export function loc_c66d(m) {
  const { mem8, mem16 } = m;
  const slot = mem8[loc_38];
  const next = (slot + 1) & 0x0f;

  const [lo1, hi1] = halfSum(
    mem8[u16(loc_36a + slot)], mem8[u16(loc_35a + slot)],
    mem8[u16(loc_36a + next)], mem8[u16(loc_35a + next)]);
  mem8[loc_61] = lo1;
  mem8[loc_62] = hi1;

  const [lo2, hi2] = halfSum(
    mem8[u16(loc_38a + slot)], mem8[u16(loc_37a + slot)],
    mem8[u16(loc_38a + next)], mem8[u16(loc_37a + next)]);
  mem8[loc_63] = lo2;
  mem8[loc_64] = hi2;

  const ptr = mem16[loc_74];
  let cursor = mem8[loc_a9];
  mem8[u16(ptr + cursor)] = lo2; cursor = u8(cursor + 1);
  mem8[loc_6c] = lo2;
  mem8[loc_6d] = hi2;
  mem8[u16(ptr + cursor)] = hi2 & 0x1f; cursor = u8(cursor + 1);
  mem8[u16(ptr + cursor)] = lo1; cursor = u8(cursor + 1);
  mem8[loc_6a] = lo1;
  mem8[loc_6b] = hi1;
  mem8[u16(ptr + cursor)] = hi1 & 0x1f; cursor = u8(cursor + 1);
  mem8[loc_a9] = cursor;
}
