// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ACTIVE_SLOT_COUNT, STATUS_FLAGS, loc_43, loc_44, loc_45, DRAW_CURSOR_LO, DRAW_CURSOR_HI, loc_9f, TEMPLATE_COPY_LEN, VECTOR_TEMPLATE_BLOCK } from "./names.js";
import { emitByteAsBcdDigits } from "./emitByteAsBcdDigits.js";
import { emitRecordBodyC0 } from "./emitRecordBodyC0.js";

/**
 * stageTextLineWithCount — stage one vector-text line into the display list, optionally with a number. ROM 0xaa13.
 *
 * Role in the machine: Tempest draws its on-screen text as vector stroke records. This routine lays one text
 * line down into the vector text buffer at 0x2f60 by copying a variable-length stroke template out of ROM,
 * and on one flag path also renders a live count (the BCD of loc_9f+1) into the same line before closing the
 * record. It is how a labelled line like a score/lives readout gets built each frame.
 *
 * Behavior: it picks the string/template index. Normally that index is ACTIVE_SLOT_COUNT, but when STATUS_FLAGS
 * bit7 is clear AND any of loc_43/loc_44/loc_45 is nonzero the index is forced to 0x01. It seats the write
 * cursor DRAW_CURSOR_LO/HI at 0x2f60 (the text buffer page), then reads the template's byte length from the
 * TEMPLATE_COPY_LEN table at that index into y. It saves (len + cursorLo + 1) as savedSum — the cursor-low
 * value to restore after the copy. The do/while copies stroke bytes from VECTOR_TEMPLATE_BLOCK down through
 * index y until y wraps past 0, then does one final copy at y==0 (the 6502 copy-down loop touches index 0
 * after the branch). On the STATUS_FLAGS bit7 path it repoints the cursor to 0x2fa6 and calls
 * emitByteAsBcdDigits to draw (loc_9f+1) as BCD digits into the line. Finally it restores DRAW_CURSOR_LO to
 * savedSum and tail-calls emitRecordBodyC0 to terminate/emit the record.
 *
 * Live-out: the vector text buffer at 0x2f60 filled with the template (and BCD count on the bit7 path),
 * DRAW_CURSOR_LO/HI left by the emitter, and whatever emitRecordBodyC0 returns. Grounding: [seen].
 */
export function stageTextLineWithCount(m) {
  const { mem8, mem16 } = m;
  let x = mem8[ACTIVE_SLOT_COUNT];                 // default template index
  if (!(mem8[STATUS_FLAGS] & 0x80)) {
    if ((mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) !== 0) x = 0x01; // force index 1 when any of the trio is set
  }
  mem8[DRAW_CURSOR_LO] = 0x60;                     // seat the write cursor at 0x2f60 (text buffer page)
  mem8[DRAW_CURSOR_HI] = 0x2f;
  let y = mem8[u16(TEMPLATE_COPY_LEN + x)];        // template byte length -> copy-down counter
  const savedSum = (y + mem8[DRAW_CURSOR_LO] + 1) & 0xff; // cursor-low to restore after the copy
  do {
    mem8[u16(mem16[DRAW_CURSOR_LO] + y)] = mem8[u16(VECTOR_TEMPLATE_BLOCK + y)]; // copy stroke byte y
    y = (y - 1) & 0xff;
  } while (y !== 0);
  mem8[u16(mem16[DRAW_CURSOR_LO] + y)] = mem8[u16(VECTOR_TEMPLATE_BLOCK + y)]; // final byte at y==0
  if (mem8[STATUS_FLAGS] & 0x80) {
    mem8[DRAW_CURSOR_HI] = 0x2f;                   // repoint the cursor at 0x2fa6 for the count field
    mem8[DRAW_CURSOR_LO] = 0xa6;
    emitByteAsBcdDigits(m, (mem8[loc_9f] + 1) & 0xff); // draw (loc_9f+1) as BCD digits
  }
  mem8[DRAW_CURSOR_LO] = savedSum;                 // restore the cursor low byte for the emitter
  return emitRecordBodyC0(m);                      // terminate/emit the record
}
