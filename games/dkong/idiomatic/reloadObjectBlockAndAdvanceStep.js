// SPDX-License-Identifier: GPL-3.0-only
/**
 * reloadObjectBlockAndAdvanceStep — reload the board's sprite-object block from its stored
 * template, patch three record fields, and advance the board-advance step index.
 *
 * LIVE-OUT: memory-only.
 */

import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import {
  BOARD_ADVANCE_STEP,
  SPRITE_OBJECT_BLOCK_TEMPLATE,
  SPRITE_OBJ_BLOCK,
} from "./names.js";

const BOARD_OBJECT_SCRATCH = 0x62af;

export function reloadObjectBlockAndAdvanceStep(m) {
  const { regs, mem8 } = m;

  loadSpriteObjectBlock(m, SPRITE_OBJECT_BLOCK_TEMPLATE);

  // Patch three record field-0 bytes AFTER the copy (write order is load-bearing).
  mem8[SPRITE_OBJ_BLOCK + 0x04] = 0x66;
  mem8[SPRITE_OBJ_BLOCK + 0x1c] = 0x00;
  mem8[SPRITE_OBJ_BLOCK + 0x24] = 0x00;

  mem8[BOARD_OBJECT_SCRATCH] = 0x00;

  mem8[BOARD_ADVANCE_STEP] = (mem8[BOARD_ADVANCE_STEP] + 1);
}
