// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17b6 — step 0 of the board-render sequence: draw the initial how-high screen (four
 * girder/ladder items plus a sprite-object row), set the priority tune, then arm and repoint the
 * auto-advance machinery for the rest of the sequence.
 *
 * LIVE-OUT: memory-only.
 */

import { SND_PRIORITY, SND_PRIORITY_FRAMES, SUBSTATE_TIMER, SPRITE_OBJ_BLOCK, SEQ_ADVANCE_PTR, BOARD_ADVANCE_STEP, COLOR_COLUMN_A_TOP } from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { fillTileBlock } from "./fillTileBlock.js";
import { drawBoardLayout } from "./drawBoardLayout.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

const HOW_HIGH_ANIM = 0x6390;      // how-high interlude animation stepper
const BLINK_SPRITE_CODE = 0x6905;  // the blink sprite the colour cycle toggles

const SPRITE_TEMPLATE = 0x385c;
const SPRITE_X_SHIFT = 0x44;

// Four render items: [tilemap dest for the 5x14 blank-tile block, girder/ladder segment table].
const RENDER_ITEMS = [
  [0x76da, 0x3a47],
  [0x76d5, 0x3a4d],
  [0x76d0, 0x3a53],
  [0x76cb, 0x3a59],
];

export function loc_17b6(m) {
  const { mem8, mem16 } = m;

  silenceSound(m);

  mem8[SND_PRIORITY] = 0x0e;
  mem8[SND_PRIORITY_FRAMES] = 0x03;

  // Colour and step chain across the two column fills — the second continues the descend
  // (value 0x10 -> 0x0d) at the same stride the first used.
  fillDescendingColumn(m, COLOR_COLUMN_A_TOP, 0x10, 0x0020);
  fillDescendingColumn(m, 0x7583, 0x0d, 0x0020);

  for (const [tileDest, segTable] of RENDER_ITEMS) {
    fillTileBlock(m, tileDest);
    drawBoardLayout(m, undefined, segTable);
  }

  loadSpriteObjectBlock(m, SPRITE_TEMPLATE);
  addToSpriteObjectColumn(m, SPRITE_OBJ_BLOCK, SPRITE_X_SHIFT);

  mem8[BLINK_SPRITE_CODE] = 0x13;

  mem8[SUBSTATE_TIMER] = 0x20;
  mem8[HOW_HIGH_ANIM] = 0x80;

  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
  mem16[SEQ_ADVANCE_PTR] = BOARD_ADVANCE_STEP;
}
