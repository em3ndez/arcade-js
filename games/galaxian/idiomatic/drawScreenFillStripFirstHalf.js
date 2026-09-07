// SPDX-License-Identifier: GPL-3.0-only
//
// drawScreenFillStripFirstHalf -- first slice of the attract-mode animated screen fill.
//
// WHAT IT IS
//   During boot/attract the machine paints the character map a horizontal strip at a time so the screen
//   appears to fill in. This routine draws the top-tile half of one strip: starting at the VRAM write
//   cursor it stamps `count` consecutive two-tile pairs (tiles 48 and 50), advancing two cells per pass,
//   then falls straight into drawScreenFillStripSecondHalf to lay the matching bottom-tile pairs.
//
// ROLE IN THE MACHINE
//   The fill overlay runs on the alternate per-frame path (dispatch flag loc_401a == 2). Its head,
//   advanceScreenFillStrip (ROM 0x1d28), pets the watchdog, checks the strip gate loc_4008, loads the
//   VRAM write cursor VRAM_WRITE_PTR (0x400b) into HL and the strip length into B, then enters here.
//   This is the "first half"; the "second half" (ROM 0x1d43) stamps SECOND_HALF_PAIRS more pairs of a
//   different tile pair, stores the advanced cursor back to VRAM_WRITE_PTR, and ticks the strip dwell.
//
//   ROM 0x1d39.  Grounding: [seen].
//
// LIVE-OUT: two-tile pairs written into VRAM; control (and the advanced cursor) handed to the second half,
//           which is what commits VRAM_WRITE_PTR and ticks the dwell timer -- this half writes no counter.
import { u16 } from "../../../core/int.js";
import { drawScreenFillStripSecondHalf } from "./drawScreenFillStripSecondHalf.js";

// The top-row tile pair this half stamps (0x30/0x32); the second half uses tiles 52/54 for the bottom row.
const STRIP_TILE_A = 48;
const STRIP_TILE_B = 50;
// Fixed length handed to the second half: it always lays 16 more pairs regardless of this half's count.
const SECOND_HALF_PAIRS = 16;

export function drawScreenFillStripFirstHalf(m, cursor = m.regs.hl, count = m.regs.b) {
  const { mem8 } = m;

  // Walk forward from the cursor stamping (A, B) into adjacent cells, two cells consumed per pass.
  // `remaining` is the Z80 B loop counter: it is pre-decremented and masked to 8 bits, so an entry
  // count of 0 runs a full 256 pairs before the byte wraps back to zero and the do/while exits.
  let ptr = cursor;
  let remaining = count;
  do {
    mem8[ptr] = STRIP_TILE_A;
    ptr = u16(ptr + 1);
    mem8[ptr] = STRIP_TILE_B;
    ptr = u16(ptr + 1);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);

  // Fall through to the second half with the advanced cursor; it stamps the bottom pairs, saves the
  // cursor to VRAM_WRITE_PTR, and ticks the strip dwell that decides when the fill is done for the frame.
  return drawScreenFillStripSecondHalf(m, ptr, SECOND_HALF_PAIRS);
}
