// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawStringVertical — put one of the game's canned strings on screen, or wipe it off again.
 *
 * A payload register picks which string and whether to draw or erase it. Two indirections reach the
 * text: the doubled payload indexes a pointer table whose entry is a descriptor; the descriptor's
 * first word is the start cell and the bytes after it are the characters, sentinel-ended. Characters
 * step back one tilemap row each, so the string runs down the column (horizontal on the rotated
 * monitor). In erase mode (bit 7 of the payload) each character is immediately overwritten with the
 * blank tile; the flag holds for the whole run and does not affect string selection.
 *
 * LIVE-OUT: memory-only — the tilemap cells written.
 */

const STRING_PTR_TABLE = 0x364b;
const VRAM_ROW_STEP = 0xffe0; //    step back one tilemap row per character
const STRING_TERMINATOR = 0x3f;
const BLANK_TILE = 0x10;
const TABLE_INDEX_MASK = 0x7f; //   keeps the doubled index, drops the erase flag's remnant

export function drawStringVertical(m) {
  const { regs, mem8, mem16 } = m;

  const payload = regs.a & 0xff;
  const blankMode = (payload & 0x80) !== 0;
  const index = ((payload << 1) & 0xff) & TABLE_INDEX_MASK;

  const descriptor = mem16[(STRING_PTR_TABLE + index) & 0xffff];
  let dst = mem16[descriptor];
  let src = (descriptor + 2) & 0xffff;

  for (;;) {
    const ch = mem8[src];
    if (ch === STRING_TERMINATOR) return;
    mem8[dst] = ch;
    if (blankMode) mem8[dst] = BLANK_TILE;
    src = (src + 1) & 0xffff;
    dst = (dst + VRAM_ROW_STEP) & 0xffff;
  }
}
