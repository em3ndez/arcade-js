// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageKongClimbPose — one timer-gated step of the board-cleared interlude: re-init the
 * sprite-object block from a fixed template, then tail into the shared advance tail.
 *
 * A step handler in the board-cleared / advance interlude, reached once per frame while that
 * sub-state runs, and the near-twin of the interlude's other template-reload step: same pose gate,
 * same block copy, differing only in its body and its tail. Each frame:
 *
 *   - Tick SUBSTATE_TIMER. While it is still counting the routine only decrements and returns — the
 *     pose is HELD. On the single expiry frame:
 *   - Copy a 40-byte template — ten 4-byte sprite records — over SPRITE_OBJ_BLOCK.
 *   - Re-stamp ONE just-copied byte, record 1's X, back to a fixed 0x66. Then clear three bytes to
 *     zero: the X of records 7 and 9, which parks those two sprites for the whole of the next step,
 *     and the byte the next step uses as the climb's animation phase counter.
 *   - Tail into the shared board-advance tail, which advances the interlude's step selector, runs
 *     the per-board gate, and on 25m subtracts 4 from field 3 of every sprite-object record. The
 *     hardware reuses this frame for that tail, so the tail's return goes to THIS routine's caller;
 *     the direct call models that as a plain tail call.
 *
 * WHAT THE NAME CLAIMS, and how far. Derivable here: the pose is a fixed template stamped on a
 * timer expiry, and the byte this step ZEROES is the one the following step uses as its animation
 * phase counter — which is what makes this the frame that STAGES a climb rather than one that
 * animates it. NOT CLAIMED: the pose's appearance, which is a reading of an image rather than a
 * measurement; and the identity of the two sprites this step parks. The only thing measurable about
 * record 9 here is that its attribute byte in this template is 0x0A where the other nine records are
 * all 0x08, and that it carries the same 0x0A in the family's other templates. One record
 * consistently drawn from a different colour is SUGGESTIVE of a second character and is not evidence
 * of one, so no record here may be given a character's name.
 *
 * Reads: SUBSTATE_TIMER and the template. Writes: SUBSTATE_TIMER, the 40-byte SPRITE_OBJ_BLOCK, the
 * re-stamped byte and the three cleared bytes above, plus everything the shared tail writes.
 * LIVE-OUT: memory-only, and every write lands in work RAM — there is no hardware latch here, so no
 * bus-positioned write to preserve. The dispatch tail that reached this handler reads no register or
 * flag it leaves.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js"; // the shared board-advance tail
import { SPRITE_OBJ_BLOCK } from "./names.js";

const COPY_SOURCE = 0x388c; // base of this step's 40-byte sprite-object template
const STAMP_ADDR = SPRITE_OBJ_BLOCK + 0x04; // record 1's X, forced back to a fixed value
const STAMP_VALUE = 0x66;
const CLEAR_A = SPRITE_OBJ_BLOCK + 0x1c; // record 7's X
const CLEAR_B = SPRITE_OBJ_BLOCK + 0x24; // record 9's X
const BOARD_BOOKKEEPING = 0x62af; // the next step's animation phase; multiplexed, so left unnamed

export function stageKongClimbPose(m) {
  const { regs, mem } = m;

  // Hold this pose until the frame timer expires. While it counts down, decrement and abort
  // back to the dispatcher.
  if (!tickSubstateTimer(m)) return;

  // Timer expired — re-init the sprite-object block: copy the 40-byte template (ten 4-byte
  // records) over SPRITE_OBJ_BLOCK. The copy source is passed in a register.
  regs.hl = COPY_SOURCE;
  loadSpriteObjectBlock(m);

  // Re-stamp record 1's X back to the fixed value, then clear records 7 and 9's X — parking
  // those two sprites — and the next step's animation phase counter.
  mem.write8(STAMP_ADDR, STAMP_VALUE);
  mem.write8(CLEAR_A, 0);
  mem.write8(CLEAR_B, 0);
  mem.write8(BOARD_BOOKKEEPING, 0);

  // Tail into the shared advance tail: advance the step selector, run the per-board gate, apply
  // the strided subtract. The hardware's tail-jump reuses this frame; the direct call models it.
  advanceInterludeStepAndLiftKongFigure(m);
}
