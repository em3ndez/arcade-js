// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { VECRAM_TAIL_CURSOR_LO, VECRAM_TAIL_CURSOR_HI, VEC_LIST_JMP_LO, VEC_LIST_JMP_HI, VEC_LIST_HALT } from "./names.js";

/**
 * emitVectorTailRecord — write the display list's terminating jump/halt record. ROM 0xb896.
 *
 * Role in the machine: the Analog Vector Generator walks vector RAM until it hits a jump-and-halt
 * record; that record is what makes the beam loop back and re-scan the frame. This routine plants
 * that tail record at the top of vector RAM (the fixed cells $2ffc–$2fff) pointing at the cursor that
 * marks where the growing per-frame list currently ends, then rolls that tail cursor down by one
 * record (0x20 bytes) so the next tail lands just below this one.
 *
 * Behavior: copy the tail cursor low byte ($139) verbatim into the JMP-low cell ($2ffc), copy the
 * high byte ($13a) tagged with 0x70 (the vector-generator's JMP opcode bits) into JMP-high ($2ffd),
 * and stamp 0xc0 (the HALT word) into $2fff. Then step the cursor low byte down 0x20; if that
 * subtraction borrowed past zero (bit 7 set), decrement the high byte to carry the borrow. Finally
 * mask the low byte to 0x7f, keeping it inside the record-aligned lower half of the range.
 *
 * Live-out: the $2ffc/$2ffd/$2fff jump-halt record, and the advanced tail cursor $139/$13a for the
 * next call. Grounding: [seen]
 */
export function emitVectorTailRecord(m) {
  const { mem8 } = m;
  mem8[VEC_LIST_JMP_LO] = mem8[VECRAM_TAIL_CURSOR_LO];          // JMP target low = current tail cursor low
  mem8[VEC_LIST_JMP_HI] = mem8[VECRAM_TAIL_CURSOR_HI] | 0x70;   // JMP target high, tagged with the JMP opcode bits
  mem8[VEC_LIST_HALT] = 0xc0;                                   // HALT word terminates the beam scan
  const stepped = u8(mem8[VECRAM_TAIL_CURSOR_LO] - 0x20);       // step cursor down one 0x20-byte record
  if ((stepped & 0x80) !== 0) {
    // Borrowed past zero: carry into the high byte; the low byte wraps into the low half of its range.
    mem8[VECRAM_TAIL_CURSOR_HI] = u8(mem8[VECRAM_TAIL_CURSOR_HI] - 1);
  }
  mem8[VECRAM_TAIL_CURSOR_LO] = stepped & 0x7f;                 // keep cursor low inside the record-aligned range
}
