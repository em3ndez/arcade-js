// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d5f — board-setup continuation: run the common per-board init, scatter the object records,
 * arm the setup dwell timer and advance the sub-state, stage the sprite-object block, then apply a
 * per-board sprite offset. Reached through two tail jumps that consume no return register.
 *
 * LIVE-OUT: memory-only.
 */

import { initBoardState } from "./initBoardState.js";
import { loadBoardObjectRecords } from "./loadBoardObjectRecords.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addStrided } from "./addStrided.js";
import { SUBSTATE_TIMER, GAME_SUBSTATE, BOARD, SPRITE_OBJ_BLOCK, SPRITE_BUFFER } from "./names.js";

const OBJECT_TEMPLATE_SRC = 0x385c;
const HEAD_COPY_BYTES = 8;
const OBJ_BLOCK_BYTES = 0x28; // loadSpriteObjectBlock copies this many, advancing its source
const OBJ_COLUMN_STRIDE = 4; // one sprite-object record
const OBJ_COLUMN_COUNT = 0x0a; // ten records — the fixed sprite-object column shape

export function loc_0d5f(m) {
  const { mem8 } = m;

  initBoardState(m);
  loadBoardObjectRecords(m);

  mem8[SUBSTATE_TIMER] = 0x40;
  mem8[GAME_SUBSTATE] = mem8[GAME_SUBSTATE] + 1;

  // The block loader leaves its source pointer advanced past the 0x28 bytes it copied; the head
  // copy below continues the same template stream from that advanced pointer.
  loadSpriteObjectBlock(m, OBJECT_TEMPLATE_SRC);

  let src = (OBJECT_TEMPLATE_SRC + OBJ_BLOCK_BYTES) & 0xffff;
  let dst = SPRITE_BUFFER;
  for (let i = 0; i < HEAD_COPY_BYTES; i++) {
    mem8[dst] = mem8[src];
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  const board = mem8[BOARD];

  if (board === 4) {
    addStrided(m, 0x44, OBJ_COLUMN_STRIDE, OBJ_COLUMN_COUNT, SPRITE_OBJ_BLOCK);

    addStrided(m, 0x10, OBJ_COLUMN_STRIDE, 0x02, SPRITE_BUFFER);

    addStrided(m, 0xf8, OBJ_COLUMN_STRIDE, 0x02, SPRITE_BUFFER + 3);
    return;
  }

  // 50m / 75m — bit 1 of BOARD set: no per-board offset.
  if (board & 0x02) return;

  addStrided(m, 0xfc, OBJ_COLUMN_STRIDE, OBJ_COLUMN_COUNT, SPRITE_OBJ_BLOCK + 3);
}
