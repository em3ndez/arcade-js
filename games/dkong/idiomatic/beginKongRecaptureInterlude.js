// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginKongRecaptureInterlude — the opening step of the interlude that plays once a board is
 * cleared: put the heart on screen, stage the first pose of the figure, and hold it.
 *
 * The board-cleared interlude is the short scene after the player completes a board, and it runs
 * as a numbered sequence of step handlers. This is step 0 on the odd boards, so it runs exactly
 * once, when the interlude begins. In order:
 *
 *   1. The opening tableau is spawned: the sound is silenced, the whole-heart sprite record and
 *      its companion blink code are seeded, three tilemap cells are blanked, and the
 *      sound-priority pair is set. None of that depends on any input.
 *   2. The scene's first animation frame is staged, by block-copying a fixed 40-byte template —
 *      ten 4-byte sprite records — into the sprite-object block. Only the source of the copy is
 *      chosen here; where it goes and how long it is are fixed inside the copy itself.
 *   3. The pose-hold countdown is armed to 32 frames. That is how long this pose stays on screen
 *      before the next step swaps the following frame in, and every step of the scene re-arms
 *      the same hold.
 *   4. Control falls into the shared tail, which steps the sequence on and, on the 25m board
 *      only, raises all ten staged records by 4 pixels.
 *
 * The template staged here is one large figure, not a row of props: four of its ten records are
 * parked off to the side carrying the blank sprite code, and the six that actually draw sit in a
 * single contiguous block roughly 40 by 32 pixels.
 *
 * WHAT THE NAME DOES NOT CLAIM. "Kong" is read off the drawn figure, not measured from bytes.
 * And nothing here identifies WHOSE figure is being carried away — the sprite records of the
 * scene's other character were never separated out of this same ten-record block, so no record
 * in it may be described as hers. What IS measured is the scene position the name gives: this is
 * the step that opens the interlude after a completed board.
 *
 * LIVE-OUT: memory-only — the tableau's sound, sprite and tilemap writes, the 40-byte template
 * copy, the armed pose-hold countdown, the stepped sequence counter, and on 25m the raised Y
 * column. Nothing reads a result back.
 */

import { spawnInterludeHeart } from "./spawnInterludeHeart.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js";
import { SUBSTATE_TIMER } from "./names.js";

/** Where this step's 40-byte sprite-object template is read from; it lives in program memory. */
const ANIM_FRAME_SRC = 0x385c;
/** Frames the staged pose is held for before the next step of the scene replaces it. */
const POSE_HOLD_FRAMES = 0x20;

export function beginKongRecaptureInterlude(m) {
  const { regs, mem } = m;

  // 1. The opening tableau: sound off, the whole heart and its blink companion, three
  //    blanked tilemap cells, the sound-priority pair. None of it depends on any input.
  spawnInterludeHeart(m);

  // 2. Stage the scene's first animation frame — the ten-record template copied in whole.
  //    Only the source is chosen here.
  regs.hl = ANIM_FRAME_SRC;
  loadSpriteObjectBlock(m);

  // 3. Hold this pose for 32 frames, until the next step swaps the following frame in.
  mem.write8(SUBSTATE_TIMER, POSE_HOLD_FRAMES);

  // 4. The shared tail: step the sequence on and, on 25m only, raise the ten records by 4.
  advanceInterludeStepAndLiftKongFigure(m);
}
