// SPDX-License-Identifier: GPL-3.0-only
/**
 * reloadObjectBlockAndAdvanceStep — reload the board's sprite-object block from its stored
 * template, patch three record fields, and advance the board-advance step index.
 *
 * One phase of the board-advance sequence, run once the board has been cleared. The
 * board-cleared interlude steps through BOARD_ADVANCE_STEP as its index into the per-board
 * sub-dispatch tables and reaches this handler on one of those steps. Its whole job is to
 * (re)stage the scene's sprite-object records and then bump that index so the next frame
 * dispatches the following phase:
 *
 *   - Reload the 40-byte (10-record x 4) sprite-object block from the stored template into
 *     SPRITE_OBJ_BLOCK, with HL as the copy source. It is the same template the opening
 *     climb cutscene loads.
 *   - Patch three record field-0 bytes AFTER the copy — record 1 <- 0x66, record 7 <- 0,
 *     record 9 <- 0. Each target sits inside the block the copy just filled, so the copy
 *     MUST run first or the patch is lost: WRITE ORDER matters, and none of the three
 *     template bytes at those offsets already holds the patched value.
 *   - Clear the board-object bookkeeping byte.
 *   - Advance BOARD_ADVANCE_STEP to the next board-advance dispatch step.
 *
 * A sibling handler does the identical reload + patch under a timer gate and a different
 * tail; this variant skips the gate and instead advances the step counter. Every store lands
 * in work RAM — nothing here writes a hardware register.
 *
 * Meaning confidence: the two observable actions — reload+patch the object block and
 * increment the step index — are read directly off the code and the named cells; the
 * surrounding "which board-advance phase" framing is inferred from the dispatch context. The
 * name claims only the actions, not the phase.
 *
 * LIVE-OUT: memory-only.
 */

import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

const OBJECT_RECORDS_SRC = 0x388c; // stored template of 10 sprite-object records (shared with the intro climb phase)
const BOARD_OBJECT_SCRATCH = 0x62af; // board-object bookkeeping byte, cleared here

export function reloadObjectBlockAndAdvanceStep(m) {
  const { regs, mem } = m;

  // Reload the 40-byte sprite-object block from the stored template (HL is the source).
  regs.hl = OBJECT_RECORDS_SRC;
  loadSpriteObjectBlock(m);

  // Patch three record field-0 bytes AFTER the copy — each is inside the block the copy
  // just filled, so it overwrites the template value (write order is load-bearing).
  mem.write8(SPRITE_OBJ_BLOCK + 0x04, 0x66); // record 1, field 0
  mem.write8(SPRITE_OBJ_BLOCK + 0x1c, 0x00); // record 7, field 0
  mem.write8(SPRITE_OBJ_BLOCK + 0x24, 0x00); // record 9, field 0

  // Clear the board-object bookkeeping byte.
  mem.write8(BOARD_OBJECT_SCRATCH, 0x00);

  // Advance to the next board-advance dispatch step.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
