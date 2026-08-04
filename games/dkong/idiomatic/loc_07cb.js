// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07cb — a timed animation sub-state step: run a per-frame screen animation while a
 * countdown timer ticks, then advance the game sub-state.
 *
 * Dispatched as a sub-state handler while GAME_SUBSTATE selects it. It owns a two-byte
 * animation register pair in engine scratch — a countdown timer and a rotating pattern byte —
 * and does one of three things per frame:
 *
 *   1. ARM (timer 0 at entry): load the timer with 96 frames and seed the pattern, then fall
 *      into the animation body for this first frame.
 *   2. TICK (timer non-zero): decrement the timer, keep the current pattern, fall into the
 *      body. When the decrement lands on 0 the body takes the finish arm below.
 *   3. FINISH (the tick that reached 0): set SUBSTATE_TIMER to 2 and increment GAME_SUBSTATE
 *      — the "wait two frames, then next sub-state" idiom — clear the timer/pattern pair, and
 *      return. The animation is over.
 *
 * The animation body — an arm or tick frame, while the timer is non-zero — each frame:
 *   - Decodes the top two bits of the pattern into two write-only latch cells, one bit each,
 *     then rotates the pattern left by two and stores it back, so successive frames stream
 *     successive bit-pairs out of the eight-bit pattern, cycling every four frames.
 *   - Stamps one fill tile across every span named by a table of [count, destination]
 *     records, terminated by a zero count.
 *   - Queues two follow-up tasks, reloads the 40-byte sprite-object block from its template,
 *     stamps a fixed pair of tilemap bytes, and shifts the sprite-object block's X column and
 *     Y column by fixed amounts.
 *
 * The skeleton — timed countdown, per-frame repaint, sub-state advance on expiry — is what is
 * established. What the fill tile and the two latch bits render on screen is not interpreted,
 * which is why the name stays neutral.
 *
 * LIVE-OUT: memory-only — the timer/pattern pair, the two latch cells, the tile fills, the
 * two queued tasks, the reloaded sprite-object block and its two shifted columns, the fixed
 * tilemap pair, and on expiry SUBSTATE_TIMER = 2 with GAME_SUBSTATE incremented.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, SPRITE_OBJ_BLOCK } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
// The fixed tilemap pair is stamped through the faithful lift below rather than through a
// direct call, DELIBERATELY: the lift is a pure leaf ending in a guest return, so it consumes
// one guest-stack word that a plain JS return would not. Inside the interrupt subtree that
// word is dead, but the two forms are not stack-neutral with respect to each other, so this
// call site is not interchangeable.
import { loc_3f24 } from "../translated/loc_3f24.js";

const ANIM_TIMER = 0x638a; // frames left in the current animation run
const ANIM_PATTERN = 0x638b; // 8-bit pattern streamed 2 bits/frame into the latches
const ARM_FRAMES = 0x60; // 96 — the timer value a fresh run is armed with
const SEED_PATTERN = 0x5f; // the pattern a fresh run starts from

const LATCH_BIT7 = 0x7d86; // write-only latch cell fed the pattern's bit 7 each frame
const LATCH_BIT6 = 0x7d87; // write-only latch cell fed the pattern's bit 6 each frame

const FILL_TABLE = 0x3d08; // [count, dest_lo, dest_hi] records, zero-count terminated
const FILL_TILE = 0xb0; // the tile code stamped across every fill span

const SPRITE_TEMPLATE = 0x39cf; // source template for the sprite-object block reload

export function loc_07cb(m) {
  const { regs, mem } = m;

  // -- pick this frame's timer/pattern: tick an active run, or arm a fresh one --
  let timer = mem.read8(ANIM_TIMER);
  let pattern;
  if (timer !== 0) {
    pattern = mem.read8(ANIM_PATTERN); // keep streaming the current pattern
    timer = (timer - 1) & 0xff; // count down one frame
    mem.write8(ANIM_TIMER, timer);
  } else {
    timer = ARM_FRAMES; // arm a new 96-frame run
    mem.write8(ANIM_TIMER, ARM_FRAMES);
    pattern = SEED_PATTERN;
  }

  // -- finish: the tick that hit 0 ends the run and advances the sub-state --
  if (timer === 0) {
    mem.write8(SUBSTATE_TIMER, 0x02); // wait 2 frames...
    mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff); // ...then next sub-state
    mem.write8(ANIM_TIMER, 0x00); // clear the animation register pair
    mem.write8(ANIM_PATTERN, 0x00);
    return;
  }

  // -- animation frame --

  // Decode the top two pattern bits into the two latch cells, then rotate the pattern left
  // by two so the next frame streams the next pair.
  mem.write8(LATCH_BIT7, (pattern >> 7) & 1);
  mem.write8(LATCH_BIT6, (pattern >> 6) & 1);
  mem.write8(ANIM_PATTERN, ((pattern << 2) | (pattern >> 6)) & 0xff);

  // Table-driven fill: stamp FILL_TILE across each [count, dest] span until the
  // zero-count terminator. Each record fills `count` bytes forward from `dest`.
  let hl = FILL_TABLE;
  for (;;) {
    const count = mem.read8(hl);
    const lo = mem.read8((hl + 1) & 0xffff);
    const hi = mem.read8((hl + 2) & 0xffff);
    hl = (hl + 3) & 0xffff;
    let dest = ((hi << 8) | lo) & 0xffff;
    let b = count; // a count of 0 would run 256 times; the table never contains one
    do {
      mem.write8(dest, FILL_TILE);
      dest = (dest + 1) & 0xffff;
      b = (b - 1) & 0xff;
    } while (b !== 0);
    if (mem.read8(hl) === 0) break; // peek the next count; zero terminates
  }

  // Queue two follow-up tasks, [opcode 0x03, arg 0x1e] then [0x03, 0x1f].
  regs.de = 0x031e;
  enqueueTask(m);
  regs.de = (regs.de + 1) & 0xffff;
  enqueueTask(m);

  // Reload the sprite-object block from its template, then stamp the fixed tilemap pair.
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m);
  loc_3f24(m);

  // Shift the whole sprite-object row: the X column, then the Y column at offset +3.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = 0x44;
  addToSpriteObjectColumn(m);
  regs.hl = (SPRITE_OBJ_BLOCK + 3) & 0xffff;
  regs.c = 0x78;
  addToSpriteObjectColumn(m);
}
