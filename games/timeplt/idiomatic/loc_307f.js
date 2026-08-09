// SPDX-License-Identifier: GPL-3.0-only
/** loc_307f — tail of a per-slot sprite-entry fill: store a coordinate through the pointer and fold
 * it into A, then hand each slot to the straight placer while the counter holds; on the last, index
 * a word table by A, bump the byte past the entry, drop two stack bytes into AF, and finish diagonally. */

import { loc_3074 } from "./loc_3074.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { placeDiagonallyAbuttingTile } from "./placeDiagonallyAbuttingTile.js";

export function loc_307f(m) {
  const { regs, mem } = m;
  mem.write8(regs.hl, regs.e);
  regs.and(mem.read8(regs.hl));
  if (regs.djnz() !== 0) return loc_3074(m);

  fetchTableWord(m);
  regs.incMem8(mem, regs.hl);
  regs.af = m.pop16();
  return placeDiagonallyAbuttingTile(m);
}
