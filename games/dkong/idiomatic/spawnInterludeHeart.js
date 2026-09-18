// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnInterludeHeart — the board-cleared interlude's opening tableau: silence sound, seed the
 * heart sprite record plus the blink-sprite code, blank a 3-cell run of the tilemap, then set
 * the sound-priority pair. A straight-line, input-independent initializer.
 *
 * LIVE-OUT: memory-only.
 */

import { SND_PRIORITY, SND_PRIORITY_FRAMES } from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";

const SPRITE_RECORD_6A20 = 0x6a20; // 4-byte sprite record inside SPRITE_BUFFER
const BLINK_SPRITE_CODE = 0x6905;  // blink-sprite code the colour cycle toggles
const TILEMAP_COLUMN = 0x75c4;     // codes 0x10/0x0F/0x0E are blank tiles, so this clears the cells

export function spawnInterludeHeart(m) {
  const { regs, mem8 } = m;

  silenceSound(m);

  // Fixed 4-byte sprite record: [X, code, attribute, Y].
  mem8[SPRITE_RECORD_6A20 + 0] = 0x80;
  mem8[SPRITE_RECORD_6A20 + 1] = 0x76;
  mem8[SPRITE_RECORD_6A20 + 2] = 0x09;
  mem8[SPRITE_RECORD_6A20 + 3] = 0x20;

  mem8[BLINK_SPRITE_CODE] = 0x13;

  fillDescendingColumn(m, TILEMAP_COLUMN, 0x10, 0x0020);

  mem8[SND_PRIORITY] = 0x07;
  mem8[SND_PRIORITY_FRAMES] = 0x03;
}
