// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_07cb — a timed animation sub-state step: run a per-frame screen animation
 * while a countdown timer ticks, then advance the game sub-state.  ROM 0x07cb.
 *
 * Dispatched as a sub-state handler (dw 0x07cb in the 0x0754 table, the same
 * dispatch family as handler_1977) while GAME_SUBSTATE selects it. It owns a
 * two-byte animation register pair in engine scratch — a countdown timer (0x638a)
 * and a rotating pattern byte (0x638b) — and does one of three things per frame:
 *
 *   1. ARM (timer == 0 at entry): load the timer with 0x60 (96 frames) and seed the
 *      pattern to 0x5f, then fall into the animation body for this first frame.
 *   2. TICK (timer != 0): decrement the timer; keep the current pattern; fall into
 *      the body. When the decrement lands on 0 the body takes the finish arm below.
 *   3. FINISH (timer decremented to 0): set SUBSTATE_TIMER (0x6009) = 2 and
 *      increment GAME_SUBSTATE (0x600a) — the "wait 2 frames, then next sub-state"
 *      idiom — clear the timer/pattern pair, and return. The animation is over.
 *
 * The animation body (arm or tick, while the timer is non-zero) each frame:
 *   - Decodes the top two bits of the pattern into two ls259 latch cells:
 *     0x7d86 := bit 7, 0x7d87 := bit 6 (each written 0 or 1), then rotates the
 *     pattern left by two (rlc twice) and stores it back — so successive frames
 *     stream successive bit-pairs out of the 8-bit pattern, cycling every 4 frames.
 *   - Stamps tile 0xb0 across ~49 VRAM spans driven by the ROM fill table at 0x3d08
 *     (records of [count, dest_lo, dest_hi], terminated by a zero count).
 *   - Queues two follow-up tasks [0x03,0x1e] and [0x03,0x1f] (enqueueTask x2),
 *     reloads the 40-byte sprite-object block from ROM template 0x39cf
 *     (loadSpriteObjectBlock), runs loc_3f24 (two fixed VRAM bytes), and shifts the
 *     sprite-object X column by 0x44 and Y column by 0x78 (addToSpriteObjectColumn).
 *
 * The confirmed skeleton — timed countdown, per-frame repaint, sub-state advance on
 * expiry — is why this keeps the neutral loc_07cb name: what the tile-0xb0 pattern
 * and the two latch bits render is not yet interpreted, so an English name would
 * over-claim. Reached in attract (194 real dispatches / 6000 frames, state-1
 * sub-state 6).
 *
 * Memory-equivalent to the frozen oracle — equivalence-07cb.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (the arm, tick, and
 *           finish arms all occur naturally) + crafted entries that pin the finish
 *           sub-state advance and drive all four top-2-bit pattern combinations
 *           through the two latch decodes, poked identically on both sides. Teeth:
 *           a wrong-latch-bit twin and a wrong-sub-state-advance twin.
 * LIVE-OUT: memory-only — the timer/pattern pair (0x638a/0x638b), the two latch
 *           cells (0x7d86/0x7d87), the tile-0xb0 fills, the two queued tasks, the
 *           reloaded sprite-object block (0x6908) + its two shifted columns,
 *           loc_3f24's two VRAM bytes, and on expiry SUBSTATE_TIMER=2 +
 *           GAME_SUBSTATE++. No live registers/flags (the sub-state dispatch returns
 *           up the NMI path and consumes none); pc/SP dropped — the oracle's `ret`
 *           becomes the JS return.
 * NAMES:    SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600a), SPRITE_OBJ_BLOCK
 *           (0x6908) from ram.js. Kept hex: 0x638a/0x638b (unnamed animation
 *           timer/pattern scratch), 0x7d86/0x7d87 (ls259 latch cells), 0x3d08 (ROM
 *           fill table), 0x39cf (ROM sprite template), 0x031e/0x031f (task payloads).
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, SPRITE_OBJ_BLOCK } from "./ram.js";
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004E
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038
// ROM 0x3F24 — the FROZEN ORACLE deliberately. An idiomatic twin (stampFixedTilePair.js) exists
// and 0x3F24 is in ram.js's ROUTINES, so "no idiomatic yet" is FALSE. The oracle is a pure leaf
// ending in `ret` (zero m.call of its own), so it consumes one guest-stack word the twin's JS
// return does not — the swap is not stack-neutral. Left because no gate can vouch for it: the
// 2-byte delta was injected here and neither this routine's equivalence gate nor the full-flip
// gate caught it (this site is in the NMI subtree, where perFrame's epilogue overwrites SP
// before the frame boundary the flip gate samples).
import { loc_3f24 } from "../translated/loc_3f24.js";

const ANIM_TIMER = 0x638a; // frames left in the current animation run (counts 0x60 -> 0)
const ANIM_PATTERN = 0x638b; // 8-bit pattern streamed 2 bits/frame into the latches
const ARM_FRAMES = 0x60; // 96 — the timer value a fresh run is armed with
const SEED_PATTERN = 0x5f; // the pattern a fresh run starts from

const LATCH_BIT7 = 0x7d86; // ls259 cell fed the pattern's bit 7 each frame
const LATCH_BIT6 = 0x7d87; // ls259 cell fed the pattern's bit 6 each frame

const FILL_TABLE = 0x3d08; // ROM: [count, dest_lo, dest_hi] records, zero-count terminated
const FILL_TILE = 0xb0; // the tile code stamped across every fill span

const SPRITE_TEMPLATE = 0x39cf; // ROM source for the sprite-object block reload

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

  // Decode the top two pattern bits into the two latch cells, then rotate the
  // pattern left by two (two rlc's) so the next frame streams the next pair.
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
    let b = count; // faithful djnz: count==0 would run 256 (the ROM table never does)
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

  // Reload the sprite-object block from its ROM template, then loc_3f24's two
  // fixed VRAM bytes (0x74af=0x9f, 0x748f=0x9e).
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m);
  loc_3f24(m);

  // Shift the whole sprite-object row: X column (+0) by 0x44, Y column (+3) by 0x78.
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = 0x44;
  addToSpriteObjectColumn(m);
  regs.hl = (SPRITE_OBJ_BLOCK + 3) & 0xffff;
  regs.c = 0x78;
  addToSpriteObjectColumn(m);
}
