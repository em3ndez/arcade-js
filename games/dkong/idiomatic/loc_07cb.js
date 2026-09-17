// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07cb — a timed animation sub-state step: run a per-frame screen animation while a
 * countdown timer ticks, then advance the game sub-state.
 *
 * Owns a timer/pattern register pair in engine scratch. Arms a fresh 96-frame run when the
 * timer is 0, ticks it otherwise, and on the tick that reaches 0 sets SUBSTATE_TIMER=2 and
 * increments GAME_SUBSTATE. Each active frame streams two pattern bits into two latch cells,
 * table-fills tiles, queues two tasks, reloads the sprite-object block and shifts its columns.
 *
 * LIVE-OUT: memory-only — the timer/pattern pair, the two latch cells, the tile fills, the
 * two queued tasks, the reloaded sprite-object block and its two shifted columns, the fixed
 * tilemap pair, and on expiry SUBSTATE_TIMER = 2 with GAME_SUBSTATE incremented.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, SPRITE_OBJ_BLOCK } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
// Imported in its guest-stack-consuming lift form on purpose: not interchangeable with a direct
// call, which would leave the guest stack one word off.
import { loc_3f24 } from "../translated/loc_3f24.js";

const ANIM_TIMER = 0x638a;
const ANIM_PATTERN = 0x638b;
const ARM_FRAMES = 0x60; // 96 frames a fresh run is armed with
const SEED_PATTERN = 0x5f;

const LATCH_BIT7 = 0x7d86; // write-only latch fed the pattern's bit 7
const LATCH_BIT6 = 0x7d87; // write-only latch fed the pattern's bit 6

const FILL_TABLE = 0x3d08; // [count, dest_lo, dest_hi] records, zero-count terminated
const FILL_TILE = 0xb0;

const SPRITE_TEMPLATE = 0x39cf;

export function loc_07cb(m) {
  const { regs, mem, mem8 } = m;

  // Tick an active run, or arm a fresh one.
  let timer = mem8[ANIM_TIMER];
  let pattern;
  if (timer !== 0) {
    pattern = mem8[ANIM_PATTERN];
    timer = (timer - 1) & 0xff;
    mem8[ANIM_TIMER] = timer;
  } else {
    timer = ARM_FRAMES;
    mem8[ANIM_TIMER] = ARM_FRAMES;
    pattern = SEED_PATTERN;
  }

  // The tick that hit 0 ends the run and advances the sub-state.
  if (timer === 0) {
    mem8[SUBSTATE_TIMER] = 0x02; // wait 2 frames...
    mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1) & 0xff; // ...then next sub-state
    mem8[ANIM_TIMER] = 0x00;
    mem8[ANIM_PATTERN] = 0x00;
    return;
  }

  // Decode the top two pattern bits into the latches, then rotate the pattern left by two.
  mem.write8(LATCH_BIT7, (pattern >> 7) & 1);
  mem.write8(LATCH_BIT6, (pattern >> 6) & 1);
  mem8[ANIM_PATTERN] = ((pattern << 2) | (pattern >> 6)) & 0xff;

  // Table-driven fill: stamp FILL_TILE across each [count, dest] span until the zero terminator.
  let hl = FILL_TABLE;
  for (;;) {
    const count = mem8[hl];
    const lo = mem8[(hl + 1) & 0xffff];
    const hi = mem8[(hl + 2) & 0xffff];
    hl = (hl + 3) & 0xffff;
    let dest = ((hi << 8) | lo) & 0xffff;
    let b = count; // a count of 0 would run 256 times; the table never contains one
    do {
      mem8[dest] = FILL_TILE;
      dest = (dest + 1) & 0xffff;
      b = (b - 1) & 0xff;
    } while (b !== 0);
    if (mem8[hl] === 0) break;
  }

  // Queue two follow-up tasks, [0x03, 0x1e] then [0x03, 0x1f].
  regs.de = 0x031e;
  enqueueTask(m);
  regs.de = (regs.de + 1) & 0xffff;
  enqueueTask(m);

  // Reload the sprite-object block from its template, then stamp the fixed tilemap pair.
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m);
  loc_3f24(m);

  // Shift the sprite-object row: the X column, then the Y column at offset +3.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = 0x44;
  addToSpriteObjectColumn(m);
  regs.hl = (SPRITE_OBJ_BLOCK + 3) & 0xffff;
  regs.c = 0x78;
  addToSpriteObjectColumn(m);
}
