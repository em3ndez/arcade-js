// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_CHAR_TABLE_ROW0, OBJECT_CHAR_TABLE_ROW1, OBJECT_DRAWN_FLAG } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { clearAndReseedObjectSlot } from "./clearAndReseedObjectSlot.js";
import { paintTileBlock2x2Above } from "./paintTileBlock2x2Above.js";

/**
 * drawObjectStackedTiles — object-draw handler (rst-0x28 state 2, dispatch-table slot 2) for the record based at IX.
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

export function drawObjectStackedTiles(m, rec = m.regs.ix) {
  const { mem8 } = m;
  advanceObjectAnimationFrame(m, rec);

  mem8[rec + OFF_TIMER] = u8(mem8[rec + OFF_TIMER] - 1);
  if (mem8[rec + OFF_TIMER] !== 0) return; // still counting -> omit ret (seam completes it)

  const sprite = mem8[rec + OFF_SPRITE];
  const screenPtr = mem8[rec + OFF_PTR_LO] | (mem8[rec + OFF_PTR_HI] << 8);
  paintTileBlock2x2Above(m, screenPtr, fetchWordFromTableIndex(m, sprite, OBJECT_CHAR_TABLE_ROW0)); // lower row
  paintTileBlock2x2Above(m, u16(screenPtr - ROW_ABOVE), fetchWordFromTableIndex(m, sprite, OBJECT_CHAR_TABLE_ROW1)); // above

  if (mem8[OBJECT_DRAWN_FLAG] === 0) mem8[OBJECT_DRAWN_FLAG] = 1;

  return clearAndReseedObjectSlot(m, rec); // tail into the record-clear handler -> caller
}
