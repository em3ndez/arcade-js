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
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { addStrided } from "./addStrided.js";
import { SUBSTATE_TIMER, GAME_SUBSTATE, BOARD, SPRITE_OBJ_BLOCK, SPRITE_BUFFER } from "./names.js";

const OBJECT_TEMPLATE_SRC = 0x385c;
const HEAD_COPY_BYTES = 8;

export function loc_0d5f(m) {
  const { regs, mem8 } = m;

  initBoardState(m);
  loadBoardObjectRecords(m);

  mem8[SUBSTATE_TIMER] = 0x40;
  mem8[GAME_SUBSTATE] = mem8[GAME_SUBSTATE] + 1;

  // The block loader leaves its source pointer advanced past the 0x28 bytes it copied; the head
  // copy below continues the same template stream from that advanced pointer.
  regs.hl = OBJECT_TEMPLATE_SRC;
  loadSpriteObjectBlock(m);

  let src = regs.hl;
  let dst = SPRITE_BUFFER;
  for (let i = 0; i < HEAD_COPY_BYTES; i++) {
    mem8[dst] = mem8[src];
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }
  regs.hl = src;
  regs.de = dst;
  regs.bc = 0;

  const board = mem8[BOARD];

  if (board === 4) {
    regs.hl = SPRITE_OBJ_BLOCK;
    regs.c = 0x44;
    addToSpriteObjectColumn(m);

    regs.de = 0x0004;
    regs.b = 0x02;
    regs.c = 0x10;
    regs.hl = SPRITE_BUFFER;
    addStrided(m);

    regs.b = 0x02;
    regs.c = 0xf8;
    regs.hl = SPRITE_BUFFER + 3;
    addStrided(m);
    return;
  }

  // 50m / 75m — bit 1 of BOARD set: no per-board offset.
  if (board & 0x02) return;

  regs.hl = SPRITE_OBJ_BLOCK + 3;
  regs.c = 0xfc;
  addToSpriteObjectColumn(m);
}
