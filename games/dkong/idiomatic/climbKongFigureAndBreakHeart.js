// SPDX-License-Identifier: GPL-3.0-only
/**
 * climbKongFigureAndBreakHeart — an animation-gated step of the board-cleared interlude.
 * ROM 0x1732.
 *
 * A step handler in the board-cleared / advance interlude (GAME_SUBSTATE 0x600A == 0x16).
 * dispatchBoardClearedInterlude dispatches this family through the 0x6388 step selector; for the odd boards
 * (BOARD bit0 set → 25m / 75m) the table at 0x1623 is [1654, 1670, 168a, 1732, 1757, 178e],
 * so this is step index 3. Where its siblings hold a pose on the substate timer, this step
 * holds on an animation position instead:
 *
 *   1. Tick the sprite-object-block animation one frame (animateSpriteObjectBlock, ROM
 *      0x306f): a private 1-in-8 phase counter (0x62AF) advances every call, and on the
 *      eighth call the whole ten-record group scrolls up 4px and its code bytes animate.
 *   2. `ld a,(0x6913) / cp 0x2c / ret nc` — read sprite-object record 2's Y (0x6913) and
 *      HOLD this step (return) while it is still 0x2c or lower on the screen. The block
 *      only climbs on the eighth call, so most frames just tick the phase counter and hold.
 *   3. Once that record has scrolled ABOVE the top threshold (Y < 0x2c), finish the step:
 *      park records 0, 1 and object-record 1 at X = 0, restore object-records 7 and 9 to the
 *      X = 0x6B / 0x6A their template gives them (stageKongClimbPose parked them for the whole
 *      climb), BREAK THE HEART by incrementing the sprite code at 0x6A21 from 0x76 to 0x77, and
 *      advance the step selector so dispatchBoardClearedInterlude moves on to step 4 (0x1757).
 *
 * The only callee is the already-decompiled idiomatic animateSpriteObjectBlock; it is
 * called directly (no stack modelling). The rest is plain shadow-buffer / selector writes.
 *
 * NAME: promoted in understanding pass 15 by a proposer plus an independent blind confirmer
 * (docs/reviewer-rules.md R4/R5); the heart half is the most precisely attributed event in the
 * pass. Corroboration from OUTSIDE this routine: the 0x6A21 increment is PC-attributed
 * (`WHEART f=1716 addr=0x6a21 val=0x77 pc=0x1752 sub=0x16 board=1 step=3`) and fires 6/6
 * completions, always from pc 0x1752, always on the last frame of this step; 0x6A21 is field +1
 * (the sprite code) of the very record spawnInterludeHeart seeded with 0x76, and the confirmer
 * decoded both codes straight out of gfx2.bin — 0x76 is a lobed, symmetric, pointed shape, 0x77
 * the same shape with a jagged split through it. So "break the heart" rests on ROM graphics plus a
 * write tap, not on a screenshot. The confirmer also showed that record (index 72) is the one
 * record clearSpriteColumns deliberately declines to park, and that the 0x6B / 0x6A restored here
 * are exactly ROM template 0x388C's own record-7 and record-9 X bytes (verified in maincpu.bin)
 * that the previous step zeroed. The climb half: animateSpriteObjectBlock is an already-named
 * callee that scrolls the ten-record figure up 4 px on every 8th call — grounding measured 25m
 * Y 56 → 40 with the gate flipping at exactly Y = 0x28 < 0x2C, which is this routine's
 * SCROLL_PROBE / SCROLL_TOP. 0x38 → 0x28 is 16 px, i.e. FOUR scrolls of −4, and since the
 * previous step clears the phase counter 0x62AF to 0 those four scrolls land on calls 8, 16, 24
 * and 32 — so the climb is 32 frames long — and the
 * writer table attributes 6 BOARD_ADVANCE_STEP
 * writes to pc 0x1756. Blind, the confirmer named this `climbKongAndBreakHeartAtTop`: it puts the
 * threshold in the name where the promoted name puts the figure, and both derivations state the
 * same two effects in the same order.
 *
 * What the name does NOT claim. It deliberately does not say "…as Kong lifts Pauline": asserting
 * that would require separating Pauline's record from the ten-record block, and that separation was
 * never made — so neither the two records restored here nor any other record in the block may be
 * described as Pauline. "Kong" itself is the cluster-wide snapshot reading (see
 * beginKongRecaptureInterlude); what is byte-measured is that ONE figure scrolls up and the heart
 * breaks on the frame it clears the top.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1732.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not complete a
 *           board), so 0x1732 dispatches 0 times; validated on real booted-attract state with
 *           surgical pokes. EXHAUSTIVE sweep of the 0x6913 gate byte 0..255 (partition at
 *           0x2c: < 0x2c resets + advances the step, >= 0x2c holds) and EXHAUSTIVE sweep of
 *           the 0x62AF phase byte 0..255 (the 32 values that step the animation scroll the
 *           probe by -4 and flip the branch, exercising the animateSpriteObjectBlock
 *           composition). Compared on RAM (−STACK_SCRATCH). Teeth: a wrong-threshold twin and
 *           a wrong-reset-value twin.
 * LIVE-OUT: memory-only — the phase counter (0x62AF), the scrolled sprite-object block, and
 *           on reset the parked X bytes + 0x6A21 + the step selector 0x6388. Reached via the
 *           rst-0x28 dispatch tail, which discards this handler's return; the oracle's residual
 *           A/flags (the `cp 0x2c` result) are dead ABI. SP/pc are not compared: the oracle
 *           models the call's push/pop in STACK_SCRATCH, this routine needs no stack at all.
 * NAMES:    SPRITE_BUFFER (0x6900), SPRITE_OBJ_BLOCK (0x6908), BOARD_ADVANCE_STEP (0x6388 — the
 *           board-cleared interlude's step, the same one advanceInterludeStepAndLiftKongFigure
 *           and stageNextKongPoseWhenHoldExpires advance) from ram.js — records are 4 bytes
 *           (+0 X, +1 code, +2 attr, +3 Y). Hex-kept: the scroll probe 0x6913 (= record 2's
 *           Y = SPRITE_OBJ_BLOCK + 0x0B).
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js"; // ROM 0x306f
import { SPRITE_BUFFER, SPRITE_OBJ_BLOCK, BOARD_ADVANCE_STEP } from "./ram.js";

const SCROLL_PROBE = SPRITE_OBJ_BLOCK + 0x0b; // 0x6913 — sprite-object record 2's Y (field 3)
const SCROLL_TOP = 0x2c; // reset once the probed record's Y has scrolled ABOVE this (Y < 0x2c)

export function climbKongFigureAndBreakHeart(m) {
  const { mem } = m;

  // 1. Advance the sprite-object-block animation one frame (1-in-8 phase; on the eighth
  //    call it scrolls the ten-record group up 4px and animates the code bytes).
  animateSpriteObjectBlock(m);

  // 2. `ld a,(0x6913) / cp 0x2c / ret nc` — hold this step until record 2's Y has climbed
  //    above the top threshold. Y still at row 0x2c or LOWER ON SCREEN (numerically >= 0x2c,
  //    larger Y being lower) → nothing more this frame.
  if (mem.read8(SCROLL_PROBE) >= SCROLL_TOP) return;

  // 3. Reached the top — finish the step. `xor a` supplies the 0 stored to three X bytes.
  mem.write8(SPRITE_BUFFER + 0x00, 0x00); // 0x6900 — record 0 field 0 (X)
  mem.write8(SPRITE_BUFFER + 0x04, 0x00); // 0x6904 — record 1 field 0 (X)
  mem.write8(SPRITE_OBJ_BLOCK + 0x04, 0x00); // 0x690c — object-record 1 field 0 (X)
  mem.write8(SPRITE_OBJ_BLOCK + 0x1c, 0x6b); // 0x6924 — object-record 7 field 0 (X), template value
  mem.write8(SPRITE_OBJ_BLOCK + 0x24, 0x6a); // 0x692c — object-record 9 field 0 (X), template value

  // `ld hl,0x6a21 / inc (hl)` — BREAK THE HEART: field 1 (code) of the record spawnInterludeHeart
  // seeded, 0x76 (whole heart) -> 0x77 (the same heart, cracked). Attributed to pc 0x1752, 6/6.
  const codeByte = SPRITE_BUFFER + 0x121; // 0x6a21 — the heart record's sprite code
  mem.write8(codeByte, (mem.read8(codeByte) + 1) & 0xff);

  // `ld hl,0x6388 / inc (hl)` — advance the interlude's step selector (→ step 4, 0x1757).
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
