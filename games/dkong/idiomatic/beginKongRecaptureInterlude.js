// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginKongRecaptureInterlude — step 0 of the board-advance render sequence: run the intro/board spawn
 * init, stage the first sprite-object animation frame, arm the pose-hold timer, then
 * the shared tail.  ROM 0x1654.
 *
 * The first (index-0) step handler of the 0x1644-index board-advance family
 * (GAME_SUBSTATE 0x600A == 0x16), sibling to stageNextKongPoseWhenHoldExpires. dispatchBoardClearedInterlude dispatches the family
 * through the 0x6388 step selector: on the odd boards (BOARD bit0 set → 25m / 75m) the
 * table at 0x1623 is [1654, 1670, 168a, 1732, 1757, 178e], so this is step 0. It runs
 * once when the interlude begins:
 *
 *   1. spawnInterludeHeart (ROM 0x1708) — the intro/board spawn init: silence sound, seed a fixed
 *      4-byte sprite record + the blink-sprite code, paint the 3-cell colour column, set
 *      the sound-priority pair. Input-independent; both its callers label it "spawn".
 *   2. loadSpriteObjectBlock (ROM 0x004e) with HL = 0x385C — copy that 40-byte
 *      (10-record × 4) sprite-object template from ROM 0x385C into SPRITE_OBJ_BLOCK,
 *      staging the family's first animation frame. (Destination + length are fixed
 *      inside the leaf; the source is the caller-supplied HL.)
 *   3. Arm SUBSTATE_TIMER (0x6009) to 0x20 — hold this pose 32 frames until step 1
 *      (stageNextKongPoseWhenHoldExpires) swaps the next frame in. Same pose-hold value every sibling re-arms.
 *   4. Fall through into the shared tail advanceInterludeStepAndLiftKongFigure (advanceInterludeStepAndLiftKongFigure): advance the 0x6388 step
 *      selector, and — only on 25m (the rst-0x30 board gate, A = 1 = bit0) — subtract 4
 *      from field 3 (the Y column) of all ten sprite-object records.
 *
 * Reached via dispatchBoardClearedInterlude → rst 0x28, whose dispatchGameState tail discards this handler's
 * return. NAME: kept as beginKongRecaptureInterlude — the whole sibling family (stageNextKongPoseWhenHoldExpires/168a/1732/… and
 * the tail advanceInterludeStepAndLiftKongFigure) stayed address-named because the exact visual the animation depicts
 * is not independently confirmed; the mechanics are understood but the single unifying
 * role is not earned, so a neutral loc_ name is the honest choice (docs/decompiler-pipeline: a wrong
 * English name misleads worse than a neutral one).
 *
 * CALLEES (all landed idiomatic — called directly, no stack modelling):
 * spawnInterludeHeart (0x1708), loadSpriteObjectBlock (0x004e), advanceInterludeStepAndLiftKongFigure (0x1662, the shared tail).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1654.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it never completes
 *           a board), so 0x1654 dispatches 0 times; validated on real booted-attract state
 *           with surgical pokes. The routine's ONLY input-dependent branch is the tail's
 *           rst-0x30 board gate, so the crafted sweep is EXHAUSTIVE over BOARD (0..255);
 *           plus the 0x6388 step-inc wrap (0xFF→0x00) and confirmation the ROM 0x385C copy
 *           + spawn init land verbatim on both sides. Teeth: a wrong-board gate (subtracts
 *           on a non-25m board) and a dropped step inc.
 * LIVE-OUT: memory-only — the spawn-init writes (sound RAM 0x6080-0x608B, the 0x6A20
 *           record, 0x6905, colour RAM 0x75C4…), the 40-byte copy at SPRITE_OBJ_BLOCK,
 *           SUBSTATE_TIMER = 0x20, the 0x6388 inc and (on 25m) the Y column. The rst-0x28
 *           dispatch tail reads no register or flag this leaves; the oracle just `ret`s with
 *           no result convention. SP/pc are not compared — direct calls replace the oracle's
 *           push16/ret stack + PC bookkeeping with the JS call stack.
 * NAMES:    SUBSTATE_TIMER (0x6009) from ram.js. Hex-kept: the ROM template source 0x385C
 *           (an immediate, no ram.js symbol); the callees carry their own named memory
 *           (SPRITE_OBJ_BLOCK, BOARD, BOARD_ADVANCE_STEP at 0x6388).
 */

import { spawnInterludeHeart } from "./spawnInterludeHeart.js"; // ROM 0x1708 — intro/board spawn init
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js"; // ROM 0x1662 — shared board-setup tail
import { SUBSTATE_TIMER } from "./ram.js";

const ANIM_FRAME_SRC = 0x385c; // ROM base of this step's 40-byte sprite-object template
const POSE_HOLD_FRAMES = 0x20; // frames to hold the staged pose before step 1 (stageNextKongPoseWhenHoldExpires)

export function beginKongRecaptureInterlude(m) {
  const { regs, mem } = m;

  // 1. Intro/board spawn init (input-independent constant writes).
  spawnInterludeHeart(m); // ROM 0x1708

  // 2. Stage this step's sprite-object animation frame: copy the 40-byte (10-record × 4)
  //    template from ROM 0x385C into SPRITE_OBJ_BLOCK. HL is the copy source.
  regs.hl = ANIM_FRAME_SRC;
  loadSpriteObjectBlock(m); // ROM 0x004e

  // 3. Arm the pose-hold timer (held 32 frames until step 1 swaps the next frame in).
  //    The oracle stages A = 0x20 first; A is dead into the tail (advanceInterludeStepAndLiftKongFigure sets A = 1).
  mem.write8(SUBSTATE_TIMER, POSE_HOLD_FRAMES);

  // 4. Shared tail (the oracle falls through into advanceInterludeStepAndLiftKongFigure): advance the 0x6388 step
  //    selector and, on 25m only, shift the ten records' Y column by -4.
  advanceInterludeStepAndLiftKongFigure(m); // ROM 0x1662
}
