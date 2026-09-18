// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17b6 — step 0 of the board-render sequence: draw the initial how-high screen (four
 * girder/ladder items plus a sprite-object row), set the priority tune, then arm and repoint the
 * auto-advance machinery for the rest of the sequence.
 *
 * LIVE-OUT: memory-only.
 */

import {
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SUBSTATE_TIMER,
  SPRITE_OBJ_BLOCK,
  SEQ_ADVANCE_PTR,
  BOARD_ADVANCE_STEP,
} from "./names.js";
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
  const { regs, mem8, mem16 } = m;

  silenceSound(m);

  mem8[SND_PRIORITY] = 0x0e;
  mem8[SND_PRIORITY_FRAMES] = 0x03;

  // Colour and step chain across the two column fills — the second reuses what the first left.
  regs.a = 0x10;
  regs.de = 0x0020;
  fillDescendingColumn(m, 0x7623);
  fillDescendingColumn(m, 0x7583);

  for (const [tileDest, segTable] of RENDER_ITEMS) {
    fillTileBlock(m, tileDest);
    regs.de = segTable;
    drawBoardLayout(m);
  }

  loadSpriteObjectBlock(m, SPRITE_TEMPLATE);
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = SPRITE_X_SHIFT;
  addToSpriteObjectColumn(m);

  mem8[BLINK_SPRITE_CODE] = 0x13;

  mem8[SUBSTATE_TIMER] = 0x20;
  mem8[HOW_HIGH_ANIM] = 0x80;

  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1) & 0xff;
  mem16[SEQ_ADVANCE_PTR] = BOARD_ADVANCE_STEP;
}
