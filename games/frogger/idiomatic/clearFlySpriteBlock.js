// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearFlySpriteBlock  —  ROM 0x27de  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The "erase the goal-celebration sprite" teardown. Frogger builds the little bonus fly / home-goal
 *   creature as a four-byte sprite descriptor based at FLY_SPRITE_X (0x8040): X at +0, sprite code at
 *   FLY_SPRITE_CODE (0x8041, +1), color at 0x8042 (+2), and Y at FLY_SPRITE_Y (0x8043, +3). This routine
 *   wipes all four cells back to zero, which is what makes that sprite vanish from the screen.
 *
 * WHERE IT SITS
 *   It is the drain handler for the goal-sprite countdown. When the frog reaches a home bay,
 *   armHomeGoalSprite (0x27cb) stamps the bay Y plus a fixed tail into this same block and arms the
 *   celebration counter HOME_GOAL_SPRITE_ARM_CELL (0x8340) to 160. The collision orchestrator's timing
 *   arm ticks that counter down each frame; when it drains to zero it runs this routine to tear the
 *   sprite down again. It is the sibling of clearCollisionSpriteBlock (0x27bc) — same four-cell wipe —
 *   but deliberately WITHOUT that routine's extra write to the collision latch COLLISION_LATCH (0x8135),
 *   because a timed goal-sprite teardown must not disturb the fly-eat collision state.
 *
 * LIVE-OUT
 *   Memory only: the four descriptor bytes at 0x8040-0x8043 go to zero and nothing else changes. In the
 *   ROM a single pointer (HL) walks the block and is left pointing one past the end (0x8044); that
 *   leftover pointer is dead at every call site, so this returns nothing.
 */
import { FLY_SPRITE_X } from "./names.js";

export function clearFlySpriteBlock(m) {
  const { mem8 } = m;

  // ── Zero the four-byte fly/goal sprite descriptor ─────────────────────────────────────
  // Walk the block based at FLY_SPRITE_X (0x8040) and clear all four cells: +0 X, +1 sprite
  // code (0x8041), +2 color (0x8042), +3 Y (0x8043). A sprite whose descriptor reads all zero
  // is drawn nowhere, so this is what removes the goal-celebration creature from the display.
  // NOTE: unlike clearCollisionSpriteBlock, the collision latch COLLISION_LATCH (0x8135) is left
  // untouched here — only the visible descriptor is erased.
  mem8[FLY_SPRITE_X] = 0;
  mem8[FLY_SPRITE_X + 1] = 0;
  mem8[FLY_SPRITE_X + 2] = 0;
  mem8[FLY_SPRITE_X + 3] = 0;
}
