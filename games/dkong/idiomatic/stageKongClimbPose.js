// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageKongClimbPose — one timer-gated step of the board-cleared interlude: re-init the
 * sprite-object block from a ROM template, then tail into the shared advance tail.
 * ROM 0x168a.
 *
 * A step handler in the board-cleared / advance interlude (GAME_SUBSTATE 0x600A == 0x16),
 * the near-twin of loc_186f: same rst-0x18 pose gate and the same loadSpriteObjectBlock copy,
 * differing only in its body and its tail. dispatchBoardClearedInterlude dispatches this family through the
 * 0x6388 step selector; this is the step whose odd-board table entry (0x1623) is 0x168a.
 *
 * On each frame:
 *   - rst 0x18 (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it counts down the
 *     routine only decrements and returns — the pose is held. On the single expiry frame:
 *   - Copy a 40-byte (10-record × 4) sprite-object template from ROM 0x388C into
 *     SPRITE_OBJ_BLOCK (loadSpriteObjectBlock; HL = the copy source).
 *   - Re-stamp one just-copied byte — SPRITE_OBJ_BLOCK+4 (0x690C) — back to a fixed 0x66,
 *     then clear three bytes to 0: the X of records 7 and 9 (0x6924 / 0x692C, parking those
 *     two sprites for the whole of the next step), and 0x62AF, which the next step uses as
 *     the climb's animation phase counter.
 *   - jp 0x1662 — tail into the shared board-advance tail (advanceInterludeStepAndLiftKongFigure), which advances the
 *     0x6388 step selector, runs the per-board rst-0x30 gate, and (on 25m) subtracts 4 from
 *     field 3 of every sprite-object record. The Z80 `jp` reuses this frame, so advanceInterludeStepAndLiftKongFigure's
 *     `ret` returns to stageKongClimbPose's caller; the direct call models that as a plain tail call.
 *
 * Reached via dispatchGameState's rst-0x28 tail, which discards this handler's return, so
 * nothing downstream reads a register or flag it leaves.
 *
 * NAME: promoted in understanding pass 15 by a proposer plus an independent blind confirmer
 * (docs/reviewer-rules.md R4/R5). Corroboration from OUTSIDE this routine, and the strongest link
 * in this cluster, is the 0x62AF clear: the NEXT step (climbKongFigureAndBreakHeart) increments
 * that byte once per call and the ten-record figure scrolls 4 px on every 8th — grounding observed
 * it run 0 → 104 across one 25m interlude — so the byte this step zeroes IS the climb's phase
 * counter, which corroborates "climb" without appealing to any image. The confirmer, blind, matched
 * ROM against the grounding independently: template 0x388C's record X bytes are
 * 80/0/83/99/0/83/99/107/0/106, and the grounding had reported the step-2 figure "re-anchored to
 * X 80/102/83/99" — 80/83/99 are literally those template bytes, and the 102 is the 0x66 this
 * routine forces into record 1. The template also decodes 43 px wide × 36 px tall, TALLER than
 * either earlier pose. Independently again, the 50m arm reaches the same climb by loading this
 * same 0x388C template in reloadObjectBlockAndAdvanceStep (ROM 0x16EE) with the identical
 * 0x690C/0x6924/0x692C/0x62AF bookkeeping — so the two board groups provably converge on one climb.
 * The confirmer's name was `stageKongClimbPoseWhenPoseHoldExpires`: the promoted name is that name
 * minus the gate clause, and the two derivations agree word-for-word on the part that matters.
 *
 * What the name does NOT claim. The pose's appearance is still a reading — of a MAME snapshot and
 * of the template's dimensions — even though its ROLE as the climb is measured. And the two sprites
 * this step parks (records 7 and 9, restored by the next step on the frame the heart breaks) are
 * NOT identified. What is measured about record 9 is only this: in template 0x388C its attribute
 * byte is 0x0A (colour 10) where the other NINE records are all 0x08, and it carries that same
 * 0x0A in the family's other two templates too (0x385C and 0x3932, where it is a parked blank —
 * X = 0, sprite code 0x70). One record consistently drawn from a different colour is suggestive of
 * a second character and is not evidence of one, so no record here may be called Pauline.
 *
 * CALLEES (all landed idiomatic leaves, called directly — no stack modelling):
 * tickSubstateTimer (0x0018), loadSpriteObjectBlock (0x004e), advanceInterludeStepAndLiftKongFigure (0x1662, the tail).
 *
 * Memory-equivalent to the frozen oracle — equivalence-168a.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not complete a
 *           board), so 0x168a dispatches 0 times; validated on real booted-attract state with
 *           surgical pokes: EXHAUSTIVE sweep of SUBSTATE_TIMER 0..255 (only 0x01 expires) and
 *           EXHAUSTIVE sweep of BOARD 0..255 at expiry (drives advanceInterludeStepAndLiftKongFigure's per-board gate both
 *           ways). Teeth: a dropped 0x690C re-stamp, a dropped 0x62AF clear, an inverted gate.
 * LIVE-OUT: memory-only. Every write lands in work RAM (SUBSTATE_TIMER, the 40-byte
 *           SPRITE_OBJ_BLOCK, 0x690C/0x6924/0x692C, 0x62AF, plus advanceInterludeStepAndLiftKongFigure's 0x6388 and the
 *           strided column) — no 0x7Dxx hardware latch, so there is no bus-positioned write to
 *           preserve. The rst-0x28 dispatch tail reads no register/flag this leaves; the
 *           oracle's residual A/HL/DE/BC/flags are dead ABI, and its SP/pc are the Z80
 *           caller-skip / tail-jump mechanism the boolean gate and direct call replace.
 * NAMES:    SUBSTATE_TIMER (0x6009, inside tickSubstateTimer) and SPRITE_OBJ_BLOCK (0x6908)
 *           from names.js. Hex-kept: ROM template base 0x388C (an immediate); 0x62AF, which
 *           pass 15 deliberately left unnamed because it is multiplexed — the 1-in-8 animation
 *           phase animateSpriteObjectBlock drives during the climb, a 256-frame down-counter
 *           in loc_18c6.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { advanceInterludeStepAndLiftKongFigure } from "./advanceInterludeStepAndLiftKongFigure.js"; // ROM 0x1662 (jp — shared board-advance tail)
import { SPRITE_OBJ_BLOCK } from "./names.js";

const COPY_SOURCE = 0x388c; // ROM base of this step's 40-byte sprite-object template
const STAMP_ADDR = SPRITE_OBJ_BLOCK + 0x04; // 0x690C — a copied byte forced back to 0x66
const STAMP_VALUE = 0x66;
const CLEAR_A = SPRITE_OBJ_BLOCK + 0x1c; // 0x6924
const CLEAR_B = SPRITE_OBJ_BLOCK + 0x24; // 0x692C
const BOARD_BOOKKEEPING = 0x62af; // the next step's animation phase; multiplexed, unnamed in names.js

export function stageKongClimbPose(m) {
  const { regs, mem } = m;

  // rst 0x18 — hold this pose until the frame timer expires. While it counts down,
  // decrement and abort to the dispatcher (the oracle's inc-sp caller-skip).
  if (!tickSubstateTimer(m)) return;

  // Timer expired — re-init the sprite-object block: copy the 40-byte (10-record × 4)
  // template from ROM 0x388C into SPRITE_OBJ_BLOCK (HL = the copy source).
  regs.hl = COPY_SOURCE;
  loadSpriteObjectBlock(m);

  // Re-stamp one copied byte back to the fixed 0x66, then clear records 7 and 9's X (parking
  // those two sprites) and the next step's animation phase counter.
  mem.write8(STAMP_ADDR, STAMP_VALUE);
  mem.write8(CLEAR_A, 0);
  mem.write8(CLEAR_B, 0);
  mem.write8(BOARD_BOOKKEEPING, 0);

  // jp 0x1662 — tail into the shared advance tail (advance 0x6388, per-board gate, strided
  // subtract). The Z80 tail-jump reuses this frame; the direct call is the tail call.
  advanceInterludeStepAndLiftKongFigure(m);
}
