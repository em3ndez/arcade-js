// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnInterludeHeart — the board-cleared interlude's opening tableau: silence the sound, seed the
 * heart sprite record plus the blink-sprite code, blank a 3-cell run of the tilemap, then set the
 * sound-priority pair.
 *
 * A straight-line, INPUT-INDEPENDENT initializer: it reads no memory and takes no arguments — every
 * store is a constant, so its effect is the same whatever state it is entered with. In order:
 *
 *   1. Silence sound: zero every sound output and its work-RAM shadow, a clean audio slate before
 *      the priority write below.
 *   2. Seed a fixed 4-byte sprite record inside SPRITE_BUFFER to the constants 0x80 / 0x76 / 0x09 /
 *      0x20 — the [X, code, attribute, Y] field order the sprite records use. Code 0x76 is the whole
 *      heart.
 *   3. Seed the blink-sprite code — one byte inside the second sprite-buffer record — to 0x13, the
 *      byte whose bit 7 the attract/intro colour cycle toggles to make it blink.
 *   4. Run the generic 3-cell descending fill over tilemap character RAM, pointed at one column with
 *      a stride of one tilemap row and a start value of 0x10, so it lays 0x10 / 0x0F / 0x0E into
 *      three cells one row apart.
 *      WHAT THAT ACTUALLY DOES AT THIS CALL SITE: it BLANKS them. The tilemap has character RAM and
 *      nothing else — a cell's colour comes from a lookup table indexed by column and four-row band,
 *      which is not writable — and all three codes written here decode to entirely blank tiles. So
 *      this call paints no glyph and sets no colour; it clears three cells of one column. That is a
 *      fact about THIS call's operands, not about the shared fill, whose other callers hand it start
 *      values that are real visible glyphs.
 *   5. Set the sound-priority pair SND_PRIORITY / SND_PRIORITY_FRAMES to 0x07 / 0x03, re-written
 *      after step 1 zeroed them.
 *
 * WHAT THE NAME CLAIMS. It names the tableau's one identified element — the heart sprite seeded in
 * step 2 — and the scene that tableau opens. WHAT IT DOES NOT CLAIM: that every write here is part
 * of the heart. The three blanked tilemap cells and the sound-priority pair belong to the same
 * opening tableau, but what removing those three cells clears off the screen was not separately
 * established.
 *
 * Reads: nothing. Writes: the sound outputs and their work-RAM shadow, the 4-byte sprite record, the
 * blink-sprite code, three tilemap cells, and the sound-priority pair.
 * LIVE-OUT: memory-only — both callers reload their registers before use.
 */

import { SND_PRIORITY, SND_PRIORITY_FRAMES } from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";

// A 4-byte sprite record inside SPRITE_BUFFER; it carries no shared cell name.
const SPRITE_RECORD_6A20 = 0x6a20;
// Sprite-buffer record 1, +1 byte — the blink-sprite code the colour cycle toggles.
const BLINK_SPRITE_CODE = 0x6905;
// Where the 3-cell descending fill starts, in the tilemap's character RAM. The three codes
// written from here (0x10, 0x0F, 0x0E) are all blank tiles, so this call clears the cells
// rather than painting them.
const TILEMAP_COLUMN = 0x75c4;

export function spawnInterludeHeart(m) {
  const { regs, mem } = m;

  // 1. Silence every sound output, and its work-RAM shadow.
  silenceSound(m);

  // 2. Seed the fixed 4-byte sprite record: [X, code, attribute, Y].
  mem.write8(SPRITE_RECORD_6A20 + 0, 0x80);
  mem.write8(SPRITE_RECORD_6A20 + 1, 0x76);
  mem.write8(SPRITE_RECORD_6A20 + 2, 0x09);
  mem.write8(SPRITE_RECORD_6A20 + 3, 0x20);

  // 3. Seed the blink-sprite code.
  mem.write8(BLINK_SPRITE_CODE, 0x13);

  // 4. The 3-cell descending fill in tilemap character RAM: stride 0x20, one tilemap row, and
  //    a start value of 0x10 -> codes 0x10 / 0x0F / 0x0E. All three are blank tiles, so the
  //    three cells end up cleared. The fill takes its start, stride and value in registers.
  regs.hl = TILEMAP_COLUMN;
  regs.de = 0x0020;
  regs.a = 0x10;
  fillDescendingColumn(m);

  // 5. Set the sound-priority pair — step 1 just zeroed both.
  mem.write8(SND_PRIORITY, 0x07);
  mem.write8(SND_PRIORITY_FRAMES, 0x03);
}
