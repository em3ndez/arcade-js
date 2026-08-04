// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginKongRecaptureInterlude — step 0 of the board-cleared interlude: put the heart on screen,
 * stage the first sprite-object animation frame, arm the pose-hold timer, then the shared
 * tail.  ROM 0x1654.
 *
 * The first (index-0) step handler of the odd-board interlude family
 * (GAME_SUBSTATE 0x600A == 0x16), sibling to stageNextKongPoseWhenHoldExpires. dispatchBoardClearedInterlude dispatches the family
 * through the 0x6388 step selector: on the odd boards (BOARD bit0 set → 25m / 75m) the
 * table at 0x1623 is [1654, 1670, 168a, 1732, 1757, 178e], so this is step 0. It runs
 * once when the interlude begins:
 *
 *   1. spawnInterludeHeart (ROM 0x1708) — the interlude's opening tableau: silence sound, seed
 *      the whole-heart sprite record (code 0x76) + the blink-sprite code, blank three tilemap
 *      cells, set the sound-priority pair. Input-independent. Grounding: it fires 6
 *      times in a whole progression run, ALL of them sub 0x16 step 0 — it has no board-load
 *      caller and no intro-cutscene caller (0 fires in the 769-frame cutscene, 0 in 24,243
 *      attract frames), so the "intro/board spawn" reading this header used to carry is wrong.
 *   2. loadSpriteObjectBlock (ROM 0x004e) with HL = 0x385C — copy that 40-byte
 *      (10-record × 4) sprite-object template from ROM 0x385C into SPRITE_OBJ_BLOCK,
 *      staging the family's first animation frame. (Destination + length are fixed
 *      inside the leaf; the source is the caller-supplied HL.)
 *   3. Arm SUBSTATE_TIMER (0x6009) to 0x20 — hold this pose 32 frames until step 1
 *      (stageNextKongPoseWhenHoldExpires) swaps the next frame in. Same pose-hold value every sibling re-arms.
 *   4. Fall through into the shared tail advanceInterludeStepAndLiftKongFigure (ROM 0x1662):
 *      advance the 0x6388 step selector, and — only on 25m (the rst-0x30 board gate,
 *      A = 1 = bit0) — subtract 4 from field 3 (the Y column) of all ten sprite-object records.
 *
 * Reached via dispatchBoardClearedInterlude → rst 0x28, whose dispatchGameState tail discards this handler's
 * return.
 *
 * NAME: promoted in understanding pass 15, and the strongest case in its cluster — the proposer
 * and the blind confirmer, working independently, produced the SAME string,
 * `beginKongRecaptureInterlude` (docs/reviewer-rules.md R4/R5). Corroboration from OUTSIDE this
 * routine: its first callee's four heart writes are PC-attributed 6/6 completions
 * (`WHEART f=1612 addr=0x6a20 val=0x80 pc=0x1710 sub=0x16 board=1 step=0`, then 0x6a21 := 0x76),
 * and the confirmer settled what 0x76 IS by decoding gfx2.bin against the board's own sprite
 * layout: code 0x76 is a lobed, symmetric, pointed shape and 0x77 the same shape with a jagged
 * split — the heart identity is in the ROM, not in a screenshot. The `[seen]` cell SUBSTATE_TIMER
 * (0x6009) is armed to 0x20 here, and the pass-14 grounding measured the resulting hold as
 * exactly 32 frames on boards 1 and 3; the shared tail accounts for 10 BOARD_ADVANCE_STEP writes
 * at pc 0x1666 (6 on board 1, 4 on board 3), i.e. once per odd-board completion. The confirmer
 * independently decoded the ROM 0x385C template this step stages: ten 4-byte records of which
 * FOUR are parked at X = 0 carrying the blank sprite code 0x70 (records 3, 6, 8 and 9), and the
 * six that actually draw sit in one contiguous ~40 × 32 px block — ONE large character, not a row
 * of props — and the 50m opening re-stamps that identical template. Their attribute bytes
 * (field +2, low nibble = colour) read 08 08 08 08 07 08 08 08 08 0a in ROM: EIGHT records at
 * colour 8, record 4 at colour 7, and record 9 at colour 0x0A. Record 9 carries that same
 * odd-one-out 0x0A in all three of this family's templates (0x385C, 0x3932, 0x388C) — which is
 * the attribute stageKongClimbPose.js discusses; here in 0x385C it is one of the parked blanks.
 *
 * What the name does NOT claim. "Kong" is a reading of frame-exact MAME snapshots
 * (p14crop/dense25m.png, board1.png) plus that shared-template argument; it is not a byte
 * measurement, and both derivations flagged it. Nothing here says WHOSE figure is carried away:
 * Pauline's sprite record was never separated from the ten-record block, so no record in this
 * block may be described as Pauline. "Recapture" names the scene position (the step that opens the
 * post-completion interlude), which is byte-measured, not the pixels.
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
 *           + the heart spawn land verbatim on both sides. Teeth: a wrong-board gate (subtracts
 *           on a non-25m board) and a dropped step inc.
 * LIVE-OUT: memory-only — the heart-spawn writes (sound RAM 0x6080-0x608B, the 0x6A20
 *           record, 0x6905, tilemap RAM 0x75C4…), the 40-byte copy at SPRITE_OBJ_BLOCK,
 *           SUBSTATE_TIMER = 0x20, the 0x6388 inc and (on 25m) the Y column. The rst-0x28
 *           dispatch tail reads no register or flag this leaves; the oracle just `ret`s with
 *           no result convention. SP/pc are not compared — direct calls replace the oracle's
 *           push16/ret stack + PC bookkeeping with the JS call stack.
 * NAMES:    SUBSTATE_TIMER (0x6009) from names.js. Hex-kept: the ROM template source 0x385C
 *           (an immediate, no names.js symbol); the callees carry their own named memory
 *           (SPRITE_OBJ_BLOCK, BOARD, BOARD_ADVANCE_STEP at 0x6388).
 */

import { spawnInterludeHeart } from "./spawnInterludeHeart.js"; // ROM 0x1708 — opening tableau
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js"; // ROM 0x1662 — shared board-setup tail
import { SUBSTATE_TIMER } from "./names.js";

const ANIM_FRAME_SRC = 0x385c; // ROM base of this step's 40-byte sprite-object template
const POSE_HOLD_FRAMES = 0x20; // frames to hold the staged pose before step 1 (stageNextKongPoseWhenHoldExpires)

export function beginKongRecaptureInterlude(m) {
  const { regs, mem } = m;

  // 1. The interlude's opening tableau (input-independent constant writes: sound off, the
  //    whole heart, the blink sprite, three blanked tilemap cells, the sound-priority pair).
  spawnInterludeHeart(m); // ROM 0x1708

  // 2. Stage this step's sprite-object animation frame: copy the 40-byte (10-record × 4)
  //    template from ROM 0x385C into SPRITE_OBJ_BLOCK. HL is the copy source.
  regs.hl = ANIM_FRAME_SRC;
  loadSpriteObjectBlock(m); // ROM 0x004e

  // 3. Arm the pose-hold timer (held 32 frames until step 1 swaps the next frame in).
  //    The oracle stages A = 0x20 first; A is dead into the tail (advanceInterludeStepAndLiftKongFigure sets A = 1).
  mem.write8(SUBSTATE_TIMER, POSE_HOLD_FRAMES);

  // 4. Shared tail (the oracle falls through into ROM 0x1662): advance the 0x6388 step
  //    selector and, on 25m only, shift the ten records' Y column by -4.
  advanceInterludeStepAndLiftKongFigure(m); // ROM 0x1662
}
