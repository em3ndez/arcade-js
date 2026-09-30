// SPDX-License-Identifier: GPL-3.0-only
/**
 * blankCellsPaintedLastPass — blank the character-plane cells the previous pass painted.
 *
 * ROM 0x530E-0x5336 (loc_530e). Grounding: [seen] (names.js ROUTINES 0x530E).
 *
 * What it is: some cells are drawn through two deferred lists in work RAM rather than written
 * straight to video RAM. Each list is a run of four-byte entries {address low, address high,
 * shape, colour} whose address is a colour-plane cell, headed by a cursor word four bytes before
 * its first entry:
 *   - the PAINT list (entries from 0xAE04, cursor 0xAE00), which paintDeferredCells drains into
 *     both planes;
 *   - the BLANK list (entries from DEFERRED_BLANK_LIST 0xAE84 [seen], cursor DEFERRED_BLANK_CURSOR
 *     0xAE80 [seen]), which this routine drains.
 * Nothing appends to the blank list entry by entry: once a pass the shared caller
 * (drainBothDeferredCellLists) drains this list, drains the paint list, then copies the paint list
 * wholesale onto this one and stores this cursor as the paint cursor's low byte plus 0x80. So on
 * pass N this list is exactly what was painted on pass N-1, and draining it erases last pass's
 * cells before this pass's are painted.
 *
 * For each pending entry: if the colour cell already has its high-priority bit (0x10) set, the
 * entry is passed over untouched; otherwise the blank shape is written into the CHARACTER plane
 * at the matching address — the character plane sits 0x400 above the colour plane — and the
 * colour is left exactly as it was. The entry's last two bytes are stepped over unread.
 *
 * Grounding: under MAME, a character-plane write tap attributed by program counter showed the
 * cells this routine blanked on each pass equal, in both directions and with zero exceptions, the
 * cells the paint routine wrote on the pass before. The pair is not a double buffer.
 *
 * LIVE-OUT: memory only — character-plane cells.
 */

import { u8 } from "../../../core/int.js";
import { DEFERRED_BLANK_CURSOR, DEFERRED_BLANK_LIST } from "./names.js";

// The copy sets the cursor's top bit (+0x80); the reader masks it away (`and 0x7f`).
const CURSOR_BITS = 0x7f;
// Each entry is four bytes, and the cursor itself sits four bytes before the first entry.
const ENTRY_BYTES = 4;
const HEADER_BYTES = 4;
// `rrca / rrca / and 0x1f`: the byte count divided by four, as a five-bit entry count.
const ENTRY_COUNT_BITS = 0x1f;
// The colour byte's high-priority bit: a cell drawn above the sprites is left alone.
const ABOVE_SPRITES = 0x10;
// `set 2,d`: bit 10 of the address moves a colour-plane cell to its character-plane twin.
const TO_CHARACTER_PLANE = 0x400;
// The blank shape (`ld a,0x20`).
const BLANK = 32;

/**
 * Step the read cursor one byte on WITHOUT leaving its page — the ROM steps it with `inc l`, an
 * 8-bit increment of the low byte only, so the carry into the high byte is dropped.
 */
const nextByte = (cursor) => cursor - u8(cursor) + u8(cursor + 1);

export function blankCellsPaintedLastPass(m) {
  const { mem8, mem16 } = m;
  // How much is pending: `ld hl,(0xae80) / ld a,l / and 0x7f / sub 0x04`. Only the cursor's low
  // byte matters (the list lives inside one page); masking drops the copy's +0x80, and taking off
  // the four header bytes leaves the bytes of entries written. A cursor still at the first entry
  // leaves zero, and the ROM returns at once (`ret z`) — nothing is pending.
  const filled = u8((u8(mem16[DEFERRED_BLANK_CURSOR]) & CURSOR_BITS) - HEADER_BYTES);
  if (filled === 0) return;

  // Walk the entries from the head of the list (`ld hl,0xae84`), counting down one per entry
  // (`ld b,a` ... `djnz`).
  let cursor = DEFERRED_BLANK_LIST;
  let left = Math.floor(filled / ENTRY_BYTES) & ENTRY_COUNT_BITS;
  do {
    // Read the entry's colour-plane address, low byte then high (`ld e,(hl) / inc l / ld d,(hl)`),
    // then step past the rest of the entry — its shape and colour bytes are not needed here.
    const low = mem8[cursor];
    cursor = nextByte(cursor);
    const colourCell = low | (mem8[cursor] << 8);
    cursor = nextByte(nextByte(nextByte(cursor)));
    // `ld a,(de) / and 0x10`: a cell whose colour is marked high-priority is skipped
    // (`jr nz`); any other gets the blank shape in the character plane (`set 2,d / ld (de),a`),
    // its colour byte untouched.
    if ((mem8[colourCell] & ABOVE_SPRITES) === 0) {
      mem8[colourCell | TO_CHARACTER_PLANE] = BLANK;
    }
    left = u8(left - 1);
  } while (left !== 0);
}
