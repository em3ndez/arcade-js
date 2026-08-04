// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageNextKongPoseWhenHoldExpires — a timer-gated step of the board-cleared
 * interlude: hold the current pose for a fixed number of frames, then stage the next
 * one and step the sequence on.
 *
 * One step of the short sequence that plays once a board is cleared, on the odd boards
 * (25m and 75m). Every sibling step has the same shape — hold a pose for a fixed
 * number of frames, then on expiry swap in the next sprite-object animation frame and
 * advance the step selector.
 *
 * On each frame:
 *   - Tick SUBSTATE_TIMER. Until it expires the routine only decrements and returns —
 *     the pose is held. On the single expiry frame:
 *   - Copy this step's 40-byte (10 records x 4) sprite-object animation frame from its
 *     fixed template into SPRITE_OBJ_BLOCK, replacing the pose the previous step
 *     staged.
 *   - Re-arm SUBSTATE_TIMER to 0x20 (hold the new pose 32 frames) and advance
 *     BOARD_ADVANCE_STEP.
 *   - Run the per-board gate with mask bit2 — 75m only. On every other board the gate
 *     closes and the routine returns here.
 *   - 75m only: add +4 to the Y column of all ten sprite-object records, so the whole
 *     ten-record figure shifts down 4 px.
 *
 * WHAT THE NAME CLAIMS AND WHAT IT DOES NOT. What is byte-measured is that on the
 * expiry frame a DIFFERENT 40-byte template replaces the one the previous step staged.
 * The new template's silhouette is WIDER — 48 px across against the previous 40 — and
 * the same 32 px tall, and its drawing records sit 4 px HIGHER on screen (the vertical
 * field is larger = lower, the same convention the interlude's other steps use). The
 * name does NOT claim the new pose is a crouch: "crouched on all fours" is a reading
 * of a screenshot, and a wider, slightly higher silhouette is consistent with it
 * without proving it. Nor does it claim which character the figure is beyond the
 * interlude-wide "Kong" reading.
 *
 * LIVE-OUT: memory-only. The dispatch tail that reaches this step reads no register or
 * flag it leaves.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { boardBitGate } from "./boardBitGate.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { SUBSTATE_TIMER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./names.js";

const ANIM_FRAME_SRC = 0x3932; // base of the interlude's sprite-object animation templates
const POSE_HOLD_FRAMES = 0x20; // frames to hold the newly-staged pose before the next step
const BOARD_MASK_75M = 0x04; // per-board applicability mask: bit2 = 75m only
const Y_COLUMN = SPRITE_OBJ_BLOCK + 3; // field 3 (the Y byte) of sprite-object record 0
const Y_NUDGE = 0x04; // +4 into every record's Y column (75m only)

export function stageNextKongPoseWhenHoldExpires(m) {
  const { regs, mem } = m;

  // Hold this pose until the frame timer expires. While it counts down, decrement and
  // abort back to the dispatcher.
  if (!tickSubstateTimer(m)) return;

  // Timer expired — swap in this step's sprite-object animation frame: copy the
  // 40-byte (10-record x 4) template into SPRITE_OBJ_BLOCK. The copy takes its source
  // address in the register pair.
  regs.hl = ANIM_FRAME_SRC;
  loadSpriteObjectBlock(m);

  // Re-arm the pose-hold timer and advance the interlude's step selector.
  mem.write8(SUBSTATE_TIMER, POSE_HOLD_FRAMES);
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);

  // Per-board gate: only 75m (mask bit2) applies the Y nudge below. Closed on every
  // other board -> return here.
  regs.a = BOARD_MASK_75M;
  if (!boardBitGate(m)) return;

  // 75m only: add +4 to field 3 (the Y column) of all ten sprite-object records,
  // nudging the whole ten-record figure down 4 px. The base and the addend come in
  // registers; the stride of 4 and the count of 10 are fixed by the callee.
  regs.hl = Y_COLUMN;
  regs.c = Y_NUDGE;
  addToSpriteObjectColumn(m);
}
