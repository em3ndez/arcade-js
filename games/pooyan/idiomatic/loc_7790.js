// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_CHAR_TABLE_ROW0, OBJECT_CHAR_TABLE_ROW1, OBJECT_DRAWN_FLAG } from "./names.js";
import { loc_4006 } from "./loc_4006.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_77c8 } from "./loc_77c8.js";
import { paintTileBlock2x2Above } from "./paintTileBlock2x2Above.js";

/**
 * loc_7790 — object-draw handler (rst-0x28 state 2, dispatch-table slot 2) for the record based at IX.
 *
 * Advances the animation, decrements the frame timer (+0x11) and returns while it runs. On expiry it
 * draws two stacked 2x2 blocks — sprite index (+0x13) selects a char-table word blitted at the screen
 * pointer (+0x15/+0x16), then the row above (pointer - 0x400) from a second table — raises
 * OBJECT_DRAWN_FLAG once, and falls through to the record-clear handler (its ret returns to caller).
 *
 * LIVE-OUT: none — a void handler.
 */

const OFF_TIMER = 0x11;
const OFF_SPRITE = 0x13;
const OFF_PTR_LO = 0x15;
const OFF_PTR_HI = 0x16;
const ROW_ABOVE = 0x400; // one tile-row group up from the pointer

export function loc_7790(m, rec = m.regs.ix) {
  const { mem8 } = m;
  loc_4006(m, rec);

  mem8[rec + OFF_TIMER] = u8(mem8[rec + OFF_TIMER] - 1);
  if (mem8[rec + OFF_TIMER] !== 0) return; // still counting -> omit ret (seam completes it)

  const sprite = mem8[rec + OFF_SPRITE];
  const screenPtr = mem8[rec + OFF_PTR_LO] | (mem8[rec + OFF_PTR_HI] << 8);
  paintTileBlock2x2Above(m, screenPtr, loc_0c45(m, sprite, OBJECT_CHAR_TABLE_ROW0)); // lower row
  paintTileBlock2x2Above(m, u16(screenPtr - ROW_ABOVE), loc_0c45(m, sprite, OBJECT_CHAR_TABLE_ROW1)); // above

  if (mem8[OBJECT_DRAWN_FLAG] === 0) mem8[OBJECT_DRAWN_FLAG] = 1;

  return loc_77c8(m, rec); // tail into the record-clear handler -> caller
}
