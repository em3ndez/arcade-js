// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnInterludeHeart — the board-cleared interlude's opening tableau: silence sound, seed the
 * heart sprite record plus the blink-sprite code, blank a 3-cell run of the tilemap, then set
 * the sound-priority pair. A straight-line, input-independent initializer.
 *
 * LIVE-OUT: memory-only.
 */

import {
  BLINK_COLOR_COLUMN_TOP,
  CUTSCENE_SPRITE_RECORD,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
} from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";

const BLINK_SPRITE_CODE = 0x6905;  // blink-sprite code the colour cycle toggles

export function spawnInterludeHeart(m) {
  const { regs, mem8 } = m;

  silenceSound(m);

  // Fixed 4-byte sprite record: [X, code, attribute, Y].
  mem8[CUTSCENE_SPRITE_RECORD + 0] = 0x80;
  mem8[CUTSCENE_SPRITE_RECORD + 1] = 0x76;
  mem8[CUTSCENE_SPRITE_RECORD + 2] = 0x09;
  mem8[CUTSCENE_SPRITE_RECORD + 3] = 0x20;

  mem8[BLINK_SPRITE_CODE] = 0x13;

  fillDescendingColumn(m, BLINK_COLOR_COLUMN_TOP, 0x10, 0x0020);

  mem8[SND_PRIORITY] = 0x07;
  mem8[SND_PRIORITY_FRAMES] = 0x03;
}
