// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintDeferredCells — paint a list of pending cell edits into the character plane and its colour plane.
 *
 * The list is a run of four-byte entries — a colour-plane address, then the shape and the colour
 * to put there — and how many are pending is read off the low half of the list's own write
 * cursor, which is why the whole list lives inside one page: every step of the read cursor wraps
 * inside that page rather than carrying out of it. A cursor still sitting at the first entry
 * means nothing is pending and the routine leaves at once.
 *
 * An entry whose colour cell already has its high-priority bit set is passed over untouched, so a
 * cell drawn above the sprites is never repainted from here. Every other entry has its shape
 * written into the character plane at the matching address and its colour written back where the
 * address points, with one shared bias added first — so the whole list re-tints together.
 * LIVE-OUT: memory-only.
 */

import { u8 } from "../../../core/int.js";
import { DEFERRED_WRITE_CURSOR } from "./names.js";

const TINT_BIAS_CELL = 0xad0c;
const TINT_BIAS_BITS = 0x0f;
const FIRST_ENTRY = 0xae04;
const ENTRY_BYTES = 4;
const HEADER_BYTES = 4;
const ENTRY_COUNT_BITS = 0x1f;
const ABOVE_SPRITES = 0x10;
const TO_CHARACTER_PLANE = 0x0400;

/** Step the read cursor one byte on WITHOUT leaving its page — the carry is dropped. */
const nextByte = (cursor) => (cursor & 0xff00) | u8(cursor + 1);

export function paintDeferredCells(m) {
  const { mem8, mem16 } = m;
  const bias = mem8[TINT_BIAS_CELL] & TINT_BIAS_BITS;
  const filled = u8(u8(mem16[DEFERRED_WRITE_CURSOR]) - HEADER_BYTES);
  if (filled === 0) return;

  let cursor = FIRST_ENTRY;
  let left = Math.floor(filled / ENTRY_BYTES) & ENTRY_COUNT_BITS;
  do {
    const low = mem8[cursor];
    cursor = nextByte(cursor);
    const colourCell = low | (mem8[cursor] << 8);
    cursor = nextByte(cursor);
    if ((mem8[colourCell] & ABOVE_SPRITES) === 0) {
      mem8[colourCell | TO_CHARACTER_PLANE] = mem8[cursor];
      cursor = nextByte(cursor);
      mem8[colourCell] = u8(mem8[cursor] + bias);
      cursor = nextByte(cursor);
    } else {
      cursor = nextByte(nextByte(cursor));
    }
    left = u8(left - 1);
  } while (left !== 0);
}
