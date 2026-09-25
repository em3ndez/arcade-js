// SPDX-License-Identifier: GPL-3.0-only
/** loc_307f — tail of a per-slot sprite-entry fill: store a coordinate through the pointer and fold
 * it into A, then hand each slot to the straight placer while the counter holds; on the last, index
 * a word table by A, bump the byte past the entry, drop two stack bytes into AF, and finish diagonally. */

import { placeTileAtTableSuppliedOffset } from "./placeTileAtTableSuppliedOffset.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { placeDiagonallyAbuttingTile } from "./placeDiagonallyAbuttingTile.js";
import { u8, u16 } from "../../../core/int.js";
import { F_S, F_Z, F_H, F_PV, F_F3, F_F5 } from "../../../core/cpu/z80.js";

export function loc_307f(m, hl = m.regs.hl, e = m.regs.e, a = m.regs.a, b = m.regs.b) {
  const { regs, mem8 } = m;
  mem8[hl] = e;

  // AND (HL): fold the byte just stored into the accumulator. The Z80 AND sets H, clears N and C,
  // takes S/Z/F3/F5 from the result, and sets PV on even parity -- computed here explicitly.
  const result = a & mem8[hl];
  let parity = result ^ (result >> 4);
  parity ^= parity >> 2;
  parity ^= parity >> 1;
  const flags =
    (result & 0x80 ? F_S : 0) |
    (result === 0 ? F_Z : 0) |
    (result & (F_F3 | F_F5)) |
    F_H |
    (parity & 1 ? 0 : F_PV);

  // DJNZ: decrement the slot counter (8-bit wrap; DJNZ touches no flag). While it still holds, loop
  // back through the straight placer, seating the folded byte's flags and the decremented counter.
  const counter = (b - 1) & 0xff;
  if (counter !== 0) return (regs.f = flags, regs.b = counter, placeTileAtTableSuppliedOffset(m));

  // Last slot (counter exhausted to 0): index the word table by the folded byte, then INC (HL) the
  // byte one past that entry -- fetchTableWord left the pointer there, so the target is the entry
  // start (the fetched pointer stepped by the doubled index) advanced two. Its flags are dead: the
  // pop below overwrites AF before any read, so only the byte's increment survives. B ends 0.
  fetchTableWord(m, result);
  const entryTail = u16(hl + u8(result + result) + 2);
  mem8[entryTail] = mem8[entryTail] + 1;
  return (regs.b = counter, regs.af = m.pop16(), placeDiagonallyAbuttingTile(m));
}
