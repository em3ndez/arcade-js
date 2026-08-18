// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearCollisionSpriteBlock  —  ROM 0x27bc  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The teardown for the bonus-fly / home-goal sprite. Frogger builds that celebration sprite on its own
 *   four-cell descriptor block based at FLY_SPRITE_X (0x8040) — X, tile code, color, Y — separate from the
 *   frog and from the river's diver figure. This routine wipes that whole block back to zero AND clears the
 *   collision latch COLLISION_LATCH (0x8135) that marks the fly as armed/out, retiring the sprite and its
 *   "a hit is pending" state in one pass.
 *
 * WHERE IT SITS
 *   Two entries reach it, both on the "the fly episode is over" side of play:
 *     • clearLatchedCollision (ROM 0x27b3) FALLS THROUGH into it — that guard returns early when nothing is
 *       latched, and otherwise clears the collision sub-flag COLLISION_SUBFLAG (0x8134) before dropping
 *       straight into this body to zero the block and the latch together (the death/hop reset path).
 *     • stampHomeGoalAndResetFrog (ROM 0x1f1c) DISPATCHES it after a latched fly-hit has been scored on the
 *       way into a home bay, tearing the sprite down once its bonus is banked.
 *   Its near-twin clearFlySpriteBlock (ROM 0x27de) zeroes the same four bytes but leaves the latch alone;
 *   the extra latch write here is the only difference.
 *
 * LIVE-OUT
 *   Memory only. Five zero writes, no return value, no register the caller reads.
 */
import { FLY_SPRITE_X, COLLISION_LATCH } from "./names.js";

export function clearCollisionSpriteBlock(m) {
  const { mem8 } = m;

  // ── Zero the four-byte fly/goal sprite descriptor (0x8040..0x8043) ────────────────────
  // The bonus-fly / home-goal sprite is a contiguous four-cell block based at FLY_SPRITE_X (0x8040):
  //   +0  FLY_SPRITE_X    (0x8040)  sprite X position
  //   +1  FLY_SPRITE_CODE (0x8041)  sprite tile/code
  //   +2  color           (0x8042)  sprite color attribute
  //   +3  FLY_SPRITE_Y    (0x8043)  sprite Y position
  // Zeroing all four parks the sprite off (X=0, code=0) so the sprite-DMA shadow blit copies an empty
  // descriptor to OBJRAM_FLY_SPRITE_BASE (0xb040) next frame and the fly/goal image disappears.
  mem8[FLY_SPRITE_X] = 0;
  mem8[FLY_SPRITE_X + 1] = 0;
  mem8[FLY_SPRITE_X + 2] = 0;
  mem8[FLY_SPRITE_X + 3] = 0;

  // ── Clear the collision latch (0x8135) ───────────────────────────────────────────────
  // COLLISION_LATCH (0x8135) is the "fly is armed / tongue is out" flag that animateFlyEatCollision
  // (0x26a6) sets when it arms the tongue and box-tests it against the frog. Clearing it here — the write
  // that clearFlySpriteBlock omits — disarms the fly so the eat state machine starts fresh next time the
  // drift counter cues a new fly, rather than re-testing a hit against a sprite that no longer exists.
  mem8[COLLISION_LATCH] = 0;
}
