// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { FIELD_RECORD_PTR_TABLE } from "./names.js";
/**
 * drawStackedCharField — the message painter: draw a table-selected field of stacked characters
 * bottom-up into the tilemap. [seen] · ROM 0x05b2–0x05ec.
 *
 * This is the game's canned-text stamper. A caller hands it a single selector byte and it
 * paints a whole pre-authored field — a banner, a points tally, a help line — by chasing a
 * ROM script. There is no per-character positioning in the call: every glyph's destination
 * is baked into the script, so the caller only chooses WHICH field.
 *
 * How the script is shaped:
 *   - The selector's low seven bits, DOUBLED, index a word-pointer table at
 *     FIELD_RECORD_PTR_TABLE (ROM 0x7a0d). Doubling is because each table slot is a 2-byte
 *     little-endian pointer; masking to 7 bits keeps the index inside the table.
 *   - That pointer heads a LIST OF RECORDS. Each record is a 2-byte little-endian destination
 *     tilemap address followed by an inline character string.
 *   - Inside a record, characters are stamped one tilemap ROW UP per glyph: the destination
 *     is decremented by 0x20 (ROW_UP) each cell, so the field grows bottom-to-top. A pooyan
 *     tile row is 0x20 cells wide, which is why one row up is exactly -0x20.
 *
 * Two sentinels steer the walk, both ordinary ASCII bytes appearing in the string:
 *   - '.' (END_RECORD) closes the current record; the walk resumes at the byte after it,
 *     which is the next record's destination address.
 *   - '?' (END_RUN) ends the entire field and returns.
 *
 * The selector's BIT 7 (MODE_BLANK_BIT) picks the paint mode, and it holds for the whole
 * field:
 *   - clear → DIGIT mode: each character is written as its digit tile, char − '0'
 *     (DIGIT_BASE). The canned fields are score/points strings, so their glyphs are decimal
 *     digits whose tile codes sit right after '0'.
 *   - set   → BLANK mode: every character position is overwritten with BLANK_TILE (0x10),
 *     the space tile. This is the ERASE path — same script, same destinations, but it wipes
 *     a previously drawn field (e.g. clearing the attract how-to-play help lines).
 *
 * LIVE-OUT: memory only — the stamped (or blanked) tilemap cells. No register value is
 * meaningful on return; callers reload whatever they need around the call.
 */

const MODE_BLANK_BIT = 0x80; // selector bit 7: set → blank-fill (erase), clear → digit-fill
const INDEX_MASK = 0x7f; //    the doubled selector is masked to a 7-bit table index
const BLANK_TILE = 0x10; //    the space tile written in blank/erase mode
const ROW_UP = -0x20; //       one tilemap row up per glyph (a row is 0x20 cells); u16-wrapped
const END_RECORD = 0x2e; //    '.' ends this record; walk continues at the next record
const END_RUN = 0x3f; //       '?' ends the whole field
const DIGIT_BASE = 0x30; //    '0': a digit char maps to its tile by subtracting this

export function drawStackedCharField(m, selector = m.regs.a) {
  const { mem8 } = m;

  // The mode is decided once, from bit 7, and applies to every glyph of the field: set →
  // erase with the blank tile, clear → stamp each glyph as a digit tile.
  const blankMode = (selector & MODE_BLANK_BIT) !== 0;

  // Double the selector and mask to 7 bits to form the byte offset into the word-pointer
  // table: each entry is a 2-byte pointer, so entry N lives at offset N*2.
  const index = (selector << 1) & INDEX_MASK;

  // Follow the table entry to the head of this field's record list (little-endian word).
  const head = u16(FIELD_RECORD_PTR_TABLE + index);
  let list = mem8[head] | (mem8[u16(head + 1)] << 8);

  for (;;) {
    // Each record opens with a 2-byte little-endian destination tilemap address — where the
    // FIRST (bottom-most) glyph of this record lands. The inline string starts two bytes on.
    const dest = mem8[list] | (mem8[u16(list + 1)] << 8);
    let src = u16(list + 2);
    let cell = dest;

    for (;;) {
      const ch = mem8[src];
      // '.' closes this record; break out to advance to the next record's address.
      if (ch === END_RECORD) break;
      // '?' ends the whole field — nothing more to paint.
      if (ch === END_RUN) return;

      // Stamp one glyph: the blank tile in erase mode, otherwise the digit tile (char − '0').
      mem8[cell] = blankMode ? BLANK_TILE : u8(ch - DIGIT_BASE);

      // Advance the source to the next character, and the destination one tilemap row up so
      // the field stacks bottom-to-top.
      src = u16(src + 1);
      cell = u16(cell + ROW_UP);
    }

    // Step past the '.' terminator to the next record's destination address and loop.
    list = u16(src + 1);
  }
}
