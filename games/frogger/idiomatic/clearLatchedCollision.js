// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearLatchedCollision  —  ROM 0x27b3  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The guarded teardown for the bonus-fly collision state. Frogger tracks the fly the frog can eat
 *   for points with two flags: COLLISION_SUBFLAG (0x8134), raised while an eat is in progress, and
 *   COLLISION_LATCH (0x8135), raised while the fly is armed / the tongue is out. When anything is
 *   latched, this routine clears the sub-flag and then falls through into clearCollisionSpriteBlock
 *   to wipe the fly's sprite descriptor and the latch — retiring the whole "a fly hit is pending"
 *   state in one pass. When nothing is latched it does nothing at all.
 *
 * WHERE IT SITS
 *   Two callers reach it, both on the "the fly episode is ending" side of play, and both discard its
 *   (absent) return value:
 *     • driveFrogDeathAnimation (ROM 0x16f8) runs it once per death/hop frame while it resets state.
 *       That driver is gated on HOLD_FLAG (0x8004), so an idle frog never reaches this reset.
 *     • animateFlyEatCollision (ROM 0x26a6) tail-calls it on the frame the tongue retracts — when the
 *       retract bit of FLY_EAT_PHASE (0x813d) is set — tearing down the eat it just finished.
 *   Because of the latch gate below it is inert whenever no fly is armed, so most calls fall straight
 *   through the first `return` without touching memory.
 *
 * LIVE-OUT
 *   Memory only. One flag write here, plus the sprite-block and latch writes in the helper it falls
 *   into. It returns nothing and leaves no register the callers read.
 */
import { COLLISION_SUBFLAG, COLLISION_LATCH } from "./names.js";
import { clearCollisionSpriteBlock } from "./clearCollisionSpriteBlock.js";

export function clearLatchedCollision(m) {
  const { mem8 } = m;

  // ── Gate: is a fly collision actually latched? ───────────────────────────────────────
  // COLLISION_LATCH (0x8135) is the "fly is armed / tongue is out" flag that animateFlyEatCollision
  // (0x26a6) raises when it arms the tongue and box-tests it against the frog. If it is clear there is
  // no fly episode to tear down, so return at once and leave memory untouched. This is the common case
  // — the fly is armed only briefly, and this routine is called every death/hop frame regardless.
  if (mem8[COLLISION_LATCH] === 0) return;

  // ── Clear the in-progress eat sub-flag (0x8134) ──────────────────────────────────────
  // COLLISION_SUBFLAG (0x8134) marks "an eat is in progress"; animateFlyEatCollision sets it when its
  // box-test scores a hit. Zero it before tearing the sprite down so the eat state machine no longer
  // believes a bite is underway. This is the one write that clearCollisionSpriteBlock does NOT do — the
  // extra step that makes this the full collision reset rather than just the sprite teardown.
  mem8[COLLISION_SUBFLAG] = 0;

  // ── Fall through: wipe the sprite block and the latch ────────────────────────────────
  // Drop straight into clearCollisionSpriteBlock (ROM 0x27bc), which zeroes the four-byte fly/goal
  // sprite descriptor at FLY_SPRITE_X (0x8040..0x8043) and clears COLLISION_LATCH (0x8135) itself — so
  // the sprite blanks on the next sprite-DMA blit and the eat state machine restarts fresh the next
  // time a fly drifts in. In the ROM this is a plain fall-through into the adjacent body; here it is a
  // tail-call whose (undefined) result the callers ignore.
  return clearCollisionSpriteBlock(m);
}
