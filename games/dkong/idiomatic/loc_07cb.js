// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07cb — a timed animation sub-state step: arm a fresh 96-frame run when the timer is 0,
 * tick it otherwise, and on the tick that reaches 0 set SUBSTATE_TIMER=2 and advance
 * GAME_SUBSTATE. Each active frame streams two pattern bits into two latch cells, table-fills
 * tiles, queues two tasks, reloads the sprite-object block and shifts its columns.
 *
 * LIVE-OUT: memory-only — the timer/pattern pair, the two latch cells, the tile fills, the
 * two queued tasks, the reloaded sprite-object block and its two shifted columns, the fixed
 * tilemap pair, and on expiry SUBSTATE_TIMER = 2 with GAME_SUBSTATE incremented.
 */

import { u16 } from "../../../core/int.js";
import {
  ANIM_TILE_FILL_TABLE,
  GAME_SUBSTATE,
  PALETTE_ANIM_PATTERN,
  PALETTE_ANIM_TIMER,
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  SPRITE_OBJ_BLOCK,
  SUBSTATE_TIMER,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
// Guest-stack-consuming lift form on purpose: not interchangeable with a direct call.
import { loc_3f24 } from "../translated/loc_3f24.js";

const ARM_FRAMES = 0x60;
const SEED_PATTERN = 0x5f;


const FILL_TILE = 0xb0;

const SPRITE_TEMPLATE = 0x39cf;

export function loc_07cb(m) {
  const { mem, mem8 } = m;

  let timer = mem8[PALETTE_ANIM_TIMER];
  let pattern;
  if (timer !== 0) {
    pattern = mem8[PALETTE_ANIM_PATTERN];
    timer = (timer - 1) & 0xff;
    mem8[PALETTE_ANIM_TIMER] = timer;
  } else {
    timer = ARM_FRAMES;
    mem8[PALETTE_ANIM_TIMER] = ARM_FRAMES;
    pattern = SEED_PATTERN;
  }

  if (timer === 0) {
    mem8[SUBSTATE_TIMER] = 0x02;
    mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);
    mem8[PALETTE_ANIM_TIMER] = 0x00;
    mem8[PALETTE_ANIM_PATTERN] = 0x00;
    return;
  }

  // Decode the top two pattern bits into the latches, then rotate the pattern left by two.
  mem.write8(PALETTE_BANK_BIT0, (pattern >> 7) & 1);
  mem.write8(PALETTE_BANK_BIT1, (pattern >> 6) & 1);
  mem8[PALETTE_ANIM_PATTERN] = ((pattern << 2) | (pattern >> 6));

  let hl = ANIM_TILE_FILL_TABLE;
  for (;;) {
    const count = mem8[hl];
    const lo = mem8[u16(hl + 1)];
    const hi = mem8[u16(hl + 2)];
    hl = u16(hl + 3);
    let dest = u16((hi << 8) | lo);
    let b = count; // a count of 0 would run 256 times; the table never contains one
    do {
      mem8[dest] = FILL_TILE;
      dest = u16(dest + 1);
      b = (b - 1) & 0xff;
    } while (b !== 0);
    if (mem8[hl] === 0) break;
  }

  enqueueTask(m, 0x03, 0x1e);
  enqueueTask(m, 0x03, 0x1f);

  loadSpriteObjectBlock(m, SPRITE_TEMPLATE);
  loc_3f24(m);

  addToSpriteObjectColumn(m, SPRITE_OBJ_BLOCK, 0x44);
  addToSpriteObjectColumn(m, u16(SPRITE_OBJ_BLOCK + 3), 0x78);
}
