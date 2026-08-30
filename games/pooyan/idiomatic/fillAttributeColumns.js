// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ATTRIB_MAP_BASE } from "./names.js";
/**
 * fillAttributeColumns — flood the tile-attribute (colour) map with one source byte per
 * column, each byte stamped down every row of its column. [seen]
 *
 * ROM 0x075d-0x0778. A pure leaf: writes only the attribute cells, calls nothing.
 *
 * Alongside the tilemap (which glyph shows in each cell) the hardware keeps a parallel
 * attribute map (which colour that cell uses). This routine paints the whole colour map in a
 * columnar pattern: every cell in a given screen column gets the SAME attribute byte, and each
 * successive column draws its byte from the next entry of a per-column source table the caller
 * points at. That produces vertical colour bands — the backdrop-colouring pass used, for
 * example, at attract state-0 completion.
 *
 * The map is walked column-major. Cells in one column are one row apart, which is a 0x20-byte
 * stride in the attribute map. The base ATTRIB_MAP_BASE (0x8040) is the top of the first
 * painted column; column N is base + N, and each of its rows is another 0x20 further on.
 *
 * The original counts columns via the low 5 bits of the destination low byte and stops when
 * they reach 0x1f — 31 columns — and counts rows by the destination high byte crossing 0x84,
 * i.e. 30 rows per column. Both counts are reproduced literally below.
 *
 * LIVE-OUT: A = 0x1f. The original's column loop exits with the terminal (L & 0x1f) = 0x1f
 * still in A, and a caller stores that leftover into a work-RAM scratch cell verbatim — it is
 * a byproduct, not a meaningful value, but it must be produced. HL/DE are dead; callers reload
 * them.
 */
export function fillAttributeColumns(m, src = m.regs.bc) {
  const { mem8 } = m;

  // Walk 31 columns. Each column consumes exactly one byte of the source table, and that byte
  // colours the entire column, so the source pointer advances once per column below.
  let source = src;
  for (let col = 0; col < 31; col++) {
    const value = mem8[source]; // the single attribute byte for this whole column

    // Stamp that byte down all 30 rows of the column, stepping one row (0x20 bytes) each time.
    let cell = ATTRIB_MAP_BASE + col;
    for (let row = 0; row < 30; row++) {
      mem8[cell] = value;
      cell += 0x20;
    }

    source = u16(source + 1); // next column reads the next source-table byte (16-bit wrap)
  }

  // The original leaves the terminal column-count value (0x1f) in A; a caller writes it out to
  // a scratch cell, so reproduce it as the live-out.
  return (m.regs.a = 0x1f);
}
