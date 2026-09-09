// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_34, loc_44, loc_54, loc_64, loc_8b, loc_8c } from "./names.js";

/**
 * detectColumnCollision — does another LIVE object share object X's column and sit within a
 * row band of it?
 *
 * Stamps X into the scratch pair loc_8b/loc_8c (loc_8c = X+1), then scans slots Y = 0x0c..0x00
 * for a DIFFERENT active object in the same column whose wrapped row delta, folded with X's
 * delta key, reads within the band (>= 0xf4). A row byte of 0xf4..0xff marks a retired slot.
 * Returns carry: SET on the first such neighbour (collision), CLEAR when the scan comes up
 * empty. Reads the three X-indexed cells once up front and writes only the two scratch cells. [code]
 */
export function detectColumnCollision(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_8b] = x;
  mem8[loc_8c] = u8(x + 1);
  const columnX = mem8[(loc_64 + x) & 0xff]; // zp,X read of object X's column
  const rowFineX = mem8[(loc_54 + x) & 0xff];
  const deltaKeyX = mem8[(loc_44 + x) & 0xff];
  let found = false;
  for (let y = 0x0c; y >= 0; y--) {
    if (mem8[loc_64 + y] !== columnX) continue; // different column -> skip
    if (mem8[loc_34 + y] >= 0xf4) continue; // slot Y retired/inactive -> skip
    if (y === mem8[loc_8b]) continue; // object X's own slot -> skip
    const rowDelta = u8(rowFineX - mem8[loc_54 + y]) ^ deltaKeyX;
    if (rowDelta >= 0xf4) { found = true; break; } // within the row band -> collision
  }
  return (m.regs.fC = found);
}
