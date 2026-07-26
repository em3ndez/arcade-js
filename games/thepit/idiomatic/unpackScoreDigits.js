// SPDX-License-Identifier: GPL-3.0-only
/**
 * unpackScoreDigits — expand the staged packed score value into display digit cells.  ROM 0x4d0c.
 *
 * The score-readout formatter (loc_4cca) stages one record's packed value at
 * 0x8037/0x8038 (0x8038 the high byte, 0x8037 the low) and points the buffer at
 * the record's on-screen digit cells, then hands off here. This routine splits
 * that value into four single-digit cells, most-significant digit first —
 *   cell 0 = high byte, upper digit
 *   cell 1 = high byte, lower digit
 *   cell 2 = low byte, upper digit
 *   cell 3 = low byte, lower digit
 * — and appends two trailing zero cells (the fixed low-order places a packed
 * score never stores — its implicit "00").
 *
 * Leading-zero blanking: when the most-significant digit is zero it is omitted
 * rather than drawn — that first cell is left untouched (keeping whatever blank
 * was already there) and the whole run shifts down one cell, so only five cells
 * are written instead of six.
 *
 * The buffer pointer comes in as a register and the advanced pointer goes back
 * out the same way (this routine runs at the boundary with its still-oracle
 * caller loc_4cca). It rests on the LAST cell written, not one past it — the
 * final store deliberately does not advance the pointer, and the caller relies on
 * exactly that resting point.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4d0c.test.js.
 * GATE:     crafted-entry + exhaustive — attract never draws the score readout, so
 *           entries are a real captured machine with the staged value poked. EQUAL
 *           over the full 65,536 packed values (both branch arms) on the cell
 *           output + advanced pointer, plus a whole-RAM/pc/SP contract check on a
 *           curated set (proves nothing outside the digit cells is touched). Teeth:
 *           a twin that never blanks the leading zero.
 * LIVE-OUT: memory (the five or six digit cells) + the advanced buffer pointer.
 *           The scratch digit/flag state the oracle leaves behind is dead (the
 *           caller reloads the pointer for its next record and reads nothing else).
 * NAMES:    0x8037/0x8038 kept hex — the staged score value low/high byte, not yet
 *           named in ram.js. The destination buffer is the caller-supplied pointer.
 */
export function unpackScoreDigits(m) {
  const { regs, mem } = m;

  const hi = mem.read8(0x8038); // staged value, high byte
  const lo = mem.read8(0x8037); // staged value, low byte

  // The four value nibbles most-significant first, then two trailing zero cells.
  const cells = [hi >> 4, hi & 0x0f, lo >> 4, lo & 0x0f, 0, 0];

  // Leading-zero blanking: a zero top digit is skipped, shifting the run down one.
  const start = cells[0] === 0 ? 1 : 0;

  let ptr = regs.hl;
  for (let i = start; i < cells.length; i++) {
    mem.write8(ptr, cells[i]);
    // Advance after every cell except the last — the pointer is left resting on it.
    if (i < cells.length - 1) ptr = (ptr + 1) & 0xffff;
  }
  regs.hl = ptr;
}
