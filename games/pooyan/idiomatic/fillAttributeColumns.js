// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ATTRIB_MAP_BASE } from "./names.js";
/**
 * fillAttributeColumns — flood the tile-attribute (colour) map with per-column bytes.
 *
 * Walks 31 columns from ATTRIB_MAP_BASE. Each column takes one source byte and stamps it down all
 * 30 rows at the 0x20 row stride, the source pointer advancing one byte per column. A leaf — writes
 * only the attribute cells, calls nothing.
 *
 * LIVE-OUT: A = 0x1f. The column loop exits when (L & 0x1f) == 0x1f, leaving that value in A; a caller
 * stores the leftover A into a work-RAM cell verbatim (a scratch byte, not a meaningful value), so A
 * is a live-out even though it carries no data. HL/DE are dead (callers reload them).
 */
export function fillAttributeColumns(m, src = m.regs.bc) {
  const { mem8 } = m;

  let source = src;
  for (let col = 0; col < 31; col++) {
    const value = mem8[source]; // one byte flooded down the whole column
    let cell = ATTRIB_MAP_BASE + col;
    for (let row = 0; row < 30; row++) {
      mem8[cell] = value;
      cell += 0x20;
    }
    source = u16(source + 1);
  }
  return (m.regs.a = 0x1f); // the loop's terminal (L & 0x1f); a caller stores this leftover A
}
