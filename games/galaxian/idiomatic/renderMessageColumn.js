// SPDX-License-Identifier: GPL-3.0-only
//
// renderMessageColumn -- ROM 0x22f1, grounding [seen]. This is channel 6, the message painter.
//
// WHAT IT IS
//   Paints (or erases, or arms a scroll of) one vertical column of text in tilemap VRAM. The argument
//   `index` selects both WHICH message and WHAT to do with it: its low five bits pick a record from the
//   pointer table, and its top two bits pick the mode.
//
// ROLE IN THE MACHINE
//   MESSAGE_PTR_TABLE (0x235c) is an array of 2-byte record pointers. Each record begins with a 2-byte
//   destination VRAM word and is followed by the message's character bytes, terminated by the code 63.
//   Text runs UP the column: one screen row up (stride -32) per character. Three modes, keyed on the top
//   two argument bits:
//     bit 7 -> erase: overwrite each character's cell with the blank tile 64.
//     bit 6 -> arm the scroller: record dest/text/cursor pointers (MESSAGE_DEST_PTR 0x40b5,
//              MESSAGE_TEXT_PTR 0x40b3, MESSAGE_CURSOR_PTR 0x40b1), clear the whole column to tile 16,
//              seed the cursor with a packed destination-row byte, and raise MESSAGE_SCROLL_ENABLE (0x40b0)
//              so advanceMessageScroller reveals it one glyph per frame.
//     neither -> draw immediately: map each char to its tile (char - 48) up the column.
//
// LIVE-OUT: VRAM column cells; and in the arm-scroller mode the four scroller cells listed above.
import { u16 } from "../../../core/int.js";
import {
  MESSAGE_PTR_TABLE,
  MESSAGE_DEST_PTR,
  MESSAGE_TEXT_PTR,
  MESSAGE_CURSOR_PTR,
  MESSAGE_SCROLL_ENABLE,
  VRAM_BASE,
  loc_4020,
} from "./names.js";

const TEXT_END = 63; // string terminator
const GLYPH_BASE = 48; // char code minus this maps to the tile code
const BLANK_TILE = 64; // painted over a message being erased
const CLEAR_TILE = 16; // painted down a freshly-armed column
const ROW_STRIDE = 32; // one screen row
const COLUMN_CELLS = 32; // cells in one column

export function renderMessageColumn(m, index = m.regs.a) {
  const { mem8, mem16 } = m;

  // Index the pointer table by the low five bits (*2 for a 2-byte entry) to fetch the record address,
  // then read the record: its first word is the destination VRAM cell, and the bytes right after it
  // (record+2) are the character stream. `dest` walks up the column; `text` walks forward through chars.
  const record = mem16[MESSAGE_PTR_TABLE + (index & 0x1f) * 2];
  const dest = mem16[record];
  const text = u16(record + 2);

  if (index & 0x80) { // blank-fill: overwrite each char cell up the column
    // Erase mode: walk the text to find its length, and for every character stamp the blank tile into
    // the matching cell, stepping the destination one row up (-32) per char, until the 63 terminator.
    for (let dst = dest, src = text; mem8[src] !== TEXT_END; src = u16(src + 1), dst = u16(dst - ROW_STRIDE)) {
      mem8[dst] = BLANK_TILE;
    }
    return;
  }

  if (index & 0x40) { // position setup: record the cursor, then clear the column
    // Arm-scroller mode. Latch the destination and text pointers into the scroller's state cells so
    // advanceMessageScroller can pick up where this leaves off.
    mem16[MESSAGE_DEST_PTR] = dest;
    mem16[MESSAGE_TEXT_PTR] = text;

    // Derive this column's per-column delay/cursor pointer: the destination's low byte gives the column
    // (0..31), and loc_4020 is the base of a 2-byte-per-column table of cursor/delay cells.
    const lo = dest & 0xff;
    const col = lo & 0x1f;
    const cursor = loc_4020 + col * 2;
    mem16[MESSAGE_CURSOR_PTR] = cursor;

    // pack the destination row into the top five bits
    // (dest page bits 0..1 -> bits 6..7, dest low byte >>2 -> bits 2..7) masked to 0xf8: the scroller
    // reads this seed as the starting row within the column and counts a delay in the low three bits.
    const packed = (((dest >> 8) & 0x03) << 6 | lo >> 2) & 0xf8;

    // Clear the entire 32-cell column to the clear tile 16 before the scroll begins (a clean slate that
    // the glyphs will be revealed onto), stepping one screen row (+32) per cell from the top of the column.
    let cell = VRAM_BASE + col;
    for (let i = 0; i < COLUMN_CELLS; i++, cell += ROW_STRIDE) mem8[cell] = CLEAR_TILE;

    // Seed the cursor cell with the packed row byte and raise the scroller-enable flag; from here
    // advanceMessageScroller drives the reveal one glyph per eligible frame.
    mem8[cursor] = packed;
    mem8[MESSAGE_SCROLL_ENABLE] = 1;
    return;
  }

  // glyph draw: each char's tile code up the column
  // Immediate-draw mode (neither top bit set): paint the whole message at once, mapping each character
  // to its tile by subtracting the '0' character code (48) and stepping one row up (-32) per char.
  for (let dst = dest, src = text; mem8[src] !== TEXT_END; src = u16(src + 1), dst = u16(dst - ROW_STRIDE)) {
    mem8[dst] = mem8[src] - GLYPH_BASE;
  }
}
