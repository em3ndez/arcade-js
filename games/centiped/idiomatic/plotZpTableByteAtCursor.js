// SPDX-License-Identifier: GPL-3.0-only
import { loc_1a } from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * plotZpTableByteAtCursor — read the source byte from the zero-page table at loc_1a indexed
 * by Y, then plot it and advance the draw cursor.
 *
 * A row/field drawing step: callers seat Y to a record index and call repeatedly, laying one
 * table byte per call into video RAM. Y is the index input; the fetched byte is not returned.
 */
export function plotZpTableByteAtCursor(m, y = m.regs.y) {
  const byte = m.mem8[loc_1a + y];
  writeMaskedByteAndAdvancePointer(m, byte);
}
