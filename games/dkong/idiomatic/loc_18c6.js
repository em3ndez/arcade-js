// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_18c6 — per-frame pacer for the board-advance / "how high" transition, driven
 * by the 0x62AF down-counter.  ROM 0x18C6.
 *
 * This is entry 5 of the how-high sequence dispatch table (reached from the
 * board-cleared/advance sub-state), and it runs once per frame while that screen is
 * up. Each dispatch first decrements the 0x62AF pacing counter, then forks:
 *
 *   - COUNTER REACHES 0 (the wrap): advance to the next board. Walk the board-order
 *     pointer BOARD_SEQ_PTR to its next entry (on the 0x7F table terminator, wrap
 *     back to the level-5+ group so levels 5+ repeat forever), copy that entry into
 *     BOARD, increment LEVEL, post a deferred task, reset the how-high bookkeeping,
 *     and hand off to GAME_SUBSTATE 8. (The oracle factors this tail out as the
 *     intra-routine fragment loc_18c6_wrap; it is fully decompiled here as
 *     advanceBoardSequence — not delegated.)
 *   - EVERY-8th GATE: most frames the post-dec counter is not a multiple of 8, so the
 *     routine just ticked and returns doing nothing else.
 *   - ON EACH 8th TICK: step the screen's two blink/animation flags — toggle bit 7 of
 *     0x6A25, and set bit 5 of 0x6919 to (a selector from loc_3009 fed A=0, B=0x6919
 *     with bit 5 cleared) | 0x20. Then branch on the counter's exact value:
 *       * == 0xE0: STAGE the transition-screen sprite record (0x694C/0x694D/0x694F);
 *         its X/attr depend on MARIO_X vs 0x80.
 *       * == 0xC0: write the sound cue (SND_PRIORITY = 0x0C on odd LEVEL else 0x05,
 *         SND_PRIORITY_FRAMES = 3) and a 4-byte object record 8F 76 09 40 at 0x6A20;
 *         when MARIO_X < 0x80, patch that record's first byte to 0x6F.
 *       * otherwise: return.
 *
 * NOT a leaf: on the proceed arm it consults loc_3009 (idiomatic ROM 0x3009, a pure
 * bit-field selector — A in / A out, touches no memory) and on the wrap it posts via
 * enqueueTask (idiomatic ROM 0x309F). Address name kept (not promoted to English):
 * the routine is genuinely multi-purpose (pacer + cutscene staging + board advance)
 * and only single-source-understood, so a clean verb would over-claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-18c6.test.js.
 * GATE:     crafted-entry — 0x18C6 is NOT dispatched in plain attract (probed: 0 in
 *           thousands of frames; it runs only during the in-game board-advance
 *           transition). Entries are crafted on a real attract-demo machine: an
 *           exhaustive 0x62AF sweep (all 256 counter values → every counter-driven
 *           arm) plus targeted crafts for the MARIO_X / LEVEL / 0x7F-terminator
 *           sub-branches, each poked identically on both sides.
 * LIVE-OUT: memory-only — the routine is a dispatch-table entry; its caller
 *           (dispatchGameState's rst-0x28 tail) reads no register/flag it leaves, so
 *           the oracle's residual A/B/C/HL/F are dead ABI. It models no stack (the
 *           oracle's push/call/ret become direct JS calls), so pc/SP stay at entry.
 * NAMES:    BOARD_SEQ_PTR (0x622A), BOARD (0x6227), LEVEL (0x6229), HOW_HIGH_INDEX
 *           (0x622E), SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A), MARIO_X
 *           (0x6203), SND_PRIORITY (0x608A), SND_PRIORITY_FRAMES (0x608B) from ram.js.
 *           Hex-kept: 0x62AF (pace counter), 0x6A25 / 0x6919 (blink flags), 0x694C/
 *           0x694D/0x694F (transition-screen sprite record — 0x694C is ram.js's
 *           MARIO_SPRITE_RECORD, but here it stages a cutscene sprite, so asserting
 *           "Mario" would mislead), 0x6A20-0x6A23 (object record), 0x6388 (how-high
 *           sequence step, ram.js-rejected), 0x3A73 (ROM board table, L5+ group).
 */

import {
  MARIO_X,
  LEVEL,
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  BOARD,
  BOARD_SEQ_PTR,
  HOW_HIGH_INDEX,
  SUBSTATE_TIMER,
  GAME_SUBSTATE,
} from "../optimized/ram.js";
import { loc_3009 } from "./loc_3009.js"; // ROM 0x3009 — pure bit-field selector
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F — post a task on the ring

export function loc_18c6(m) {
  const { mem } = m;

  // Tick the 0x62AF pacing counter. On its 0-crossing, advance to the next board.
  const counter = (mem.read8(0x62af) - 1) & 0xff;
  mem.write8(0x62af, counter);
  if (counter === 0) {
    advanceBoardSequence(m);
    return;
  }

  // Every-8th gate: most frames just tick and return.
  if ((counter & 0x07) !== 0) return;

  // Proceed (once every 8 ticks): step the two blink/animation flags.
  mem.write8(0x6a25, mem.read8(0x6a25) ^ 0x80); // toggle bit 7 of the 0x6A25 flag
  const b6919 = mem.read8(0x6919) & 0xdf; // res 5,b — clear bit 5 for the selector input
  const sel = loc_3009(0x00, b6919); // ROM 0x3009: A=0 in, selector out; touches no memory
  mem.write8(0x6919, (sel.a | 0x20) & 0xff); // 0x6919 = selector | 0x20

  // Branch on the counter's exact value.
  if (counter === 0xe0) {
    // STAGE @0xE0: seed the transition-screen sprite record; X/attr from MARIO_X.
    mem.write8(0x694f, 0x50);
    if (mem.read8(MARIO_X) < 0x80) {
      mem.write8(0x694d, 0x80);
      mem.write8(0x694c, 0x5f);
    } else {
      mem.write8(0x694d, 0x00);
      mem.write8(0x694c, 0x9f);
    }
    return;
  }
  if (counter !== 0xc0) return;

  // RECORD @0xC0: sound cue + a 4-byte object record at 0x6A20.
  mem.write8(SND_PRIORITY, mem.read8(LEVEL) & 0x01 ? 0x0c : 0x05); // odd LEVEL -> 0x0C, even -> 0x05
  mem.write8(SND_PRIORITY_FRAMES, 0x03);
  mem.write8(0x6a20, 0x8f); // object record 8F 76 09 40 at 0x6A20-0x6A23
  mem.write8(0x6a21, 0x76);
  mem.write8(0x6a22, 0x09);
  mem.write8(0x6a23, 0x40);
  if (mem.read8(MARIO_X) < 0x80) mem.write8(0x6a20, 0x6f); // left half of screen: patch first byte
}

/**
 * The counter's 0-crossing tail (ROM 0x193D, the oracle's loc_18c6_wrap): step the
 * board-order pointer to the next board and hand off to the how-high sub-state.
 */
function advanceBoardSequence(m) {
  const { regs, mem } = m;

  // Walk BOARD_SEQ_PTR to the next entry; on the 0x7F terminator, restart the
  // level-5+ group (so levels 5+ repeat forever).
  let ptr = (mem.read16(BOARD_SEQ_PTR) + 1) & 0xffff;
  let nextBoard = mem.read8(ptr);
  if (nextBoard === 0x7f) {
    ptr = 0x3a73; // start of the L5+ group in the ROM board table
    nextBoard = mem.read8(ptr);
  }
  mem.write16(BOARD_SEQ_PTR, ptr);
  mem.write8(BOARD, nextBoard);
  mem.write8(LEVEL, (mem.read8(LEVEL) + 1) & 0xff); // one completed level

  // Post the deferred task [opcode 0x05, arg 0x00] onto the task ring.
  regs.de = 0x0500;
  enqueueTask(m); // ROM 0x309F

  // Reset the how-high bookkeeping and hand off to sub-state 8.
  mem.write8(HOW_HIGH_INDEX, 0x00);
  mem.write8(0x6388, 0x00); // reset the how-high sequence step
  mem.write8(SUBSTATE_TIMER, 0xe0); // wait 0xE0 frames…
  mem.write8(GAME_SUBSTATE, 0x08); // …then advance to sub-state 8
}
