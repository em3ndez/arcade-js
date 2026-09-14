// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, FRAME_COUNTER, VG_RECORD_HEADER, DRAW_CURSOR_LO } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

/**
 * emitCoordinateRecord — build a four-byte coordinate record from four zeropage
 * source slots, writing it out through the vector-generator draw cursor. ROM 0xdf92.
 *
 * Role in the machine: Tempest paints the tube with the Atari vector generator, and the
 * game feeds it a display list one record at a time through a moving write pointer (the
 * "draw cursor", loc_74). This routine assembles one coordinate record for the object
 * indexed by x: it pulls four adjacent per-object scratch bytes (the loc_0..loc_3 group,
 * reached here as GAME_MODE/…_PENDING/FRAME_COUNTER/MODE_DISPATCH_SEL offset by x), packs
 * them into the vector-word shape the generator expects, and hands the last byte to the
 * shared record tail so the cursor keeps moving down the list.
 *
 * Behavior: reads the 16-bit cursor into base, then stores three source bytes at base+0..2
 * — loc_2+x verbatim, loc_3+x masked to five bits, loc_0+x verbatim. The fourth byte is
 * key-folded: loc_1+x is XORed with the record-header key (loc_73), masked to five bits,
 * then XORed with the key again, so only the low five bits are actually re-keyed while the
 * top three come back from the key. That folded value is passed to emitRecordTailByte with
 * y=2, which places it at base+3 and advances (or terminates) the cursor.
 *
 * Live-out: three bytes and (via the tail) a fourth written through the draw cursor at
 * base+0..3, and the advanced cursor state left by emitRecordTailByte. Grounding: [seen].
 */
export function emitCoordinateRecord(m, x = m.regs.x) {
  const { mem8, mem16 } = m;
  const base = mem16[DRAW_CURSOR_LO];
  // Three source bytes straight through: loc_2+x, loc_3+x clipped to 5 bits, loc_0+x.
  mem8[u16(base + 0)] = mem8[(GAME_MODE_PENDING + x) & 0xff];
  mem8[u16(base + 1)] = mem8[(FRAME_COUNTER + x) & 0xff] & 0x1f;
  mem8[u16(base + 2)] = mem8[(GAME_MODE + x) & 0xff];
  // Fourth byte is key-folded: only the low 5 bits of loc_1+x are re-keyed; the top 3 come
  // back from the header key loc_73 (XOR key, mask 0x1f, XOR key).
  const key = mem8[VG_RECORD_HEADER];
  const last = ((mem8[(MODE_DISPATCH_SEL + x) & 0xff] ^ key) & 0x1f) ^ key;
  return emitRecordTailByte(m, last, 2);
}

/**
 * emitRecordTailByte — store the final record byte at the next cursor slot and either
 * advance the draw cursor or, on wrap to zero, run the terminating digit run. ROM 0xdfac.
 *
 * Role in the machine: the common tail for coordinate-record emitters. It writes one more
 * byte at cursor slot y+1, then decides whether this record is complete or whether the slot
 * index has wrapped past the end of the page. A wrap to zero means the display list has run
 * off its boundary, so instead of advancing it hands off to emitNibbleDigitRun to close the
 * run out; otherwise it advances the cursor to the just-written slot.
 *
 * Behavior: yy = (y+1)&0xff; store a at DRAW_CURSOR_LO base + yy. If yy is nonzero, tail-call
 * advanceDisplayCursor(m, yy); if yy wrapped to zero, tail-call emitNibbleDigitRun(m, a, yy).
 *
 * Live-out: one byte written through the draw cursor at base+yy, plus whatever cursor/list
 * state advanceDisplayCursor or emitNibbleDigitRun leaves behind. Grounding: [seen].
 */
export function emitRecordTailByte(m, a = m.regs.a, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const yy = (y + 1) & 0xff;
  // Store the tail byte at the next cursor slot.
  mem8[u16(mem16[DRAW_CURSOR_LO] + yy)] = a;
  // Nonzero index: advance the cursor. Wrap to zero: terminate with the digit run.
  if (yy !== 0) return advanceDisplayCursor(m, yy);
  return emitNibbleDigitRun(m, a, yy);
}
