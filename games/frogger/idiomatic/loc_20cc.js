// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20cc — stamp a source block into VRAM as a grid of two-byte column pairs.
 *
 * Saves the source pointer and row count into scratch, then walks C columns: each column
 * copies B rows of a two-byte pair from the source down the destination at a 32-byte row
 * pitch, restarting the source at the top of every column, and advances the destination by
 * the column stride between columns. A count of zero runs its 8-bit loop a full 256 times.
 * LIVE-OUT: memory-only.
 */
import { loc_13ef, loc_8001, loc_8003, loc_81b1 } from "./names.js";

const ROW_PITCH = 32;
const PAIR = 2;
const FULL_RUN = 256;

export function loc_20cc(m) {
  const { regs, mem8, mem16 } = m;
  const source = regs.de;
  const rowCount = regs.b;
  const colCount = regs.c;

  mem16[loc_8001] = source;
  mem8[loc_8003] = rowCount;

  const rows = rowCount === 0 ? FULL_RUN : rowCount;
  const cols = colCount === 0 ? FULL_RUN : colCount;
  let dst = mem16[loc_13ef];
  for (let col = 0; col < cols; col++) {
    let d = dst;
    let s = source;
    for (let r = 0; r < rows; r++) {
      mem8[d] = mem8[s];
      mem8[(d + 1) & 0xffff] = mem8[(s + 1) & 0xffff];
      d = (d + ROW_PITCH) & 0xffff;
      s = (s + PAIR) & 0xffff;
    }
    dst = (d + mem8[loc_81b1]) & 0xffff;
  }
}
