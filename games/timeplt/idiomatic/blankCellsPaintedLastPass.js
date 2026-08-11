// SPDX-License-Identifier: GPL-3.0-only
/** blankCellsPaintedLastPass — blank the character-plane cells a list of pending erasures names. The list is a run
 * of four-byte entries, each opening with a colour-plane address, and how many are pending is read
 * off the low half of the list's own write cursor with its top bit masked away — the whole list
 * lives inside one page, so every step of the read cursor wraps inside that page rather than
 * carrying out of it, and a cursor still at the first entry means nothing is pending. An entry
 * whose colour cell already has its high-priority bit set is passed over untouched; every other
 * one has the blank shape written into the character plane at the matching address, its colour
 * left exactly as it was, and the two bytes past its address stepped over unread.
 * LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { DEFERRED_BLANK_CURSOR, DEFERRED_BLANK_LIST } from "./names.js";

const CURSOR_BITS = 0x7f;
const ENTRY_BYTES = 4;
const HEADER_BYTES = 4;
const ENTRY_COUNT_BITS = 0x1f;
const ABOVE_SPRITES = 0x10;
const TO_CHARACTER_PLANE = 0x0400;
const BLANK = 32;

/** Step the read cursor one byte on WITHOUT leaving its page — the carry is dropped. */
const nextByte = (cursor) => (cursor & 0xff00) | u8(cursor + 1);

export function blankCellsPaintedLastPass(m) {
  const { mem8, mem16 } = m;
  const filled = u8((u8(mem16[DEFERRED_BLANK_CURSOR]) & CURSOR_BITS) - HEADER_BYTES);
  if (filled === 0) return;

  let cursor = DEFERRED_BLANK_LIST;
  let left = Math.floor(filled / ENTRY_BYTES) & ENTRY_COUNT_BITS;
  do {
    const low = mem8[cursor];
    cursor = nextByte(cursor);
    const colourCell = low | (mem8[cursor] << 8);
    cursor = nextByte(nextByte(nextByte(cursor)));
    if ((mem8[colourCell] & ABOVE_SPRITES) === 0) {
      mem8[colourCell | TO_CHARACTER_PLANE] = BLANK;
    }
    left = u8(left - 1);
  } while (left !== 0);
}
