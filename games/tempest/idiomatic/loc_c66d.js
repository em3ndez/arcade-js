// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  TABLE_CURSOR, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI,
  DRAW_CURSOR_LO, DRAW_CURSOR_OFFSET, OBJ_DY_HI, OBJ_DY_LO, OBJ_DX_HI, OBJ_DX_LO,
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
  const slot = mem8[TABLE_CURSOR];
  const next = (slot + 1) & 0x0f;

  const [lo1, hi1] = halfSum(
    mem8[u16(OBJ_DY_LO + slot)], mem8[u16(OBJ_DY_HI + slot)],
    mem8[u16(OBJ_DY_LO + next)], mem8[u16(OBJ_DY_HI + next)]);
  mem8[PROJ_Y_LO] = lo1;
  mem8[PROJ_Y_HI] = hi1;

  const [lo2, hi2] = halfSum(
    mem8[u16(OBJ_DX_LO + slot)], mem8[u16(OBJ_DX_HI + slot)],
    mem8[u16(OBJ_DX_LO + next)], mem8[u16(OBJ_DX_HI + next)]);
  mem8[PROJ_X_LO] = lo2;
  mem8[PROJ_X_HI] = hi2;

  const ptr = mem16[DRAW_CURSOR_LO];
  let cursor = mem8[DRAW_CURSOR_OFFSET];
  mem8[u16(ptr + cursor)] = lo2; cursor = u8(cursor + 1);
  mem8[PREV_X_LO] = lo2;
  mem8[PREV_X_HI] = hi2;
  mem8[u16(ptr + cursor)] = hi2 & 0x1f; cursor = u8(cursor + 1);
  mem8[u16(ptr + cursor)] = lo1; cursor = u8(cursor + 1);
  mem8[PREV_Y_LO] = lo1;
  mem8[PREV_Y_HI] = hi1;
  mem8[u16(ptr + cursor)] = hi1 & 0x1f; cursor = u8(cursor + 1);
  mem8[DRAW_CURSOR_OFFSET] = cursor;
}
