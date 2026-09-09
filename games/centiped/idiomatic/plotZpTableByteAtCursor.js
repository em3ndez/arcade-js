// SPDX-License-Identifier: GPL-3.0-only
import { loc_1a } from "./names.js";
import { writeMaskedByteAndAdvancePointer } from "./writeMaskedByteAndAdvancePointer.js";

/**
 * plotZpTableByteAtCursor — the thinnest wrapper over the byte-plot primitive: read one glyph
 * byte out of the zero-page glyph table based at `loc_1a` (0x001a), indexed by Y, then plot it
 * through the shared draw cursor and let the primitive advance that cursor one tile.
 *
 * Role in the machine: this is the per-record "lay a glyph column" step of the sorted-object
 * readout. The object-table renderer (`plotRecordFieldColumns`) seats Y to a record index and
 * calls this three times in a row, so each call spills exactly one byte of the `loc_1a` glyph
 * table into video RAM at the moving cursor — building the object's three-glyph column one
 * tile per call. The zero-page table at `loc_1a` is the same block the sort/insert path shuffles
 * in lockstep with the key records, so what lands here is whatever glyph currently belongs to
 * that record slot.
 *
 * Grounding: [code] — the wrapper's shape is read from behaviour; `writeMaskedByteAndAdvancePointer`
 * is the MAME-observed store primitive it defers to.
 *
 * Live-out: none returned. Y is the pure index input; the fetched byte is written to video RAM
 * as a side effect and is deliberately NOT handed back (unlike `plotNormalizedCharCode`, this
 * wrapper exposes no exit carry — its callers do not thread digit state through it).
 */
export function plotZpTableByteAtCursor(m, y = m.regs.y) {
  // Fetch the source glyph: zero-page glyph table base `loc_1a` (0x001a) + the caller's record
  // index Y. This is a plain zero-page indexed load — no masking or normalization here, because
  // the bytes in this table are already final tile codes, not raw character/nibble codes.
  const byte = m.mem8[loc_1a + y];
  // Hand the raw tile code to the single store step. That primitive XORs it against the flip
  // mask, writes it through the current 16-bit cursor, and advances the cursor one tile down the
  // column (flip-aware stride). We ignore its exit carry — nobody downstream reads it here.
  writeMaskedByteAndAdvancePointer(m, byte);
}
