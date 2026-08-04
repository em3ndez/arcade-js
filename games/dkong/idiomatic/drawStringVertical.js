// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawStringVertical — put one of the game's canned strings on screen, or wipe it off again.
 *
 * A shared service, driven by a payload in a register that picks WHICH string and whether to draw
 * or erase it. Getting to the text takes two indirections:
 *
 *   - the payload is doubled into a word index into a pointer table, and that table entry is the
 *     address of a string DESCRIPTOR;
 *   - the descriptor's first word is the screen cell to start at, and the bytes after it are the
 *     characters, ended by a sentinel.
 *
 * Characters go down one per cell, stepping the destination back a whole tilemap row each time. So
 * the string is laid out VERTICALLY in tilemap terms — which is what reads as horizontal text on a
 * cabinet whose monitor is rotated a quarter turn.
 *
 * ERASE MODE. Bit 7 of the payload is a per-call erase flag. When it is set, every cell gets the
 * character and is then immediately overwritten with the blank tile, so the net effect is to clear
 * the string's footprint. When it is clear, the character stands. The flag holds for the whole run.
 * It does NOT change which string is selected: doubling the payload pushes bit 7 out, and the index
 * mask drops what is left of it.
 *
 * A LEAF: it calls nothing, and every operand but the payload is a fixed constant.
 *
 * LIVE-OUT: memory-only — the tilemap cells written, holding either the characters or the blank
 * tile.
 */

const STRING_PTR_TABLE = 0x364b; // base of the pointer table, indexed by payload * 2
const VRAM_ROW_STEP = 0xffe0; //    step back one tilemap row per character, so the draw runs down
const STRING_TERMINATOR = 0x3f; //  sentinel byte ending the character run
const BLANK_TILE = 0x10; //         the tile written in erase mode
const TABLE_INDEX_MASK = 0x7f; //   keeps the doubled index and drops what the erase flag leaves

export function drawStringVertical(m) {
  const { regs, mem } = m;

  const payload = regs.a & 0xff;
  const blankMode = (payload & 0x80) !== 0; // bit 7 of the payload is the erase flag
  const index = ((payload << 1) & 0xff) & TABLE_INDEX_MASK; // doubled index into the table

  // Two indirections: payload -> pointer-table entry (a descriptor) -> the descriptor's first word
  // is the destination cell and the bytes after it are the characters.
  const descriptor = mem.read16((STRING_PTR_TABLE + index) & 0xffff);
  let dst = mem.read16(descriptor); //         where on screen the string starts
  let src = (descriptor + 2) & 0xffff; //      first character byte

  for (;;) {
    const ch = mem.read8(src);
    if (ch === STRING_TERMINATOR) return; // the sentinel ends the run
    mem.write8(dst, ch); //                 store the character
    if (blankMode) mem.write8(dst, BLANK_TILE); // erase mode: overwrite it with the blank tile
    src = (src + 1) & 0xffff; //            next character
    dst = (dst + VRAM_ROW_STEP) & 0xffff; //and one tilemap row back
  }
}
