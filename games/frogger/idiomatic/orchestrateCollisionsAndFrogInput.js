// SPDX-License-Identifier: GPL-3.0-only
/**
 * orchestrateCollisionsAndFrogInput  —  ROM 0x1a55  ·  grounding: [code] (MAME-grounding pending)
 *
 * WHAT IT IS
 *   The per-frame conductor for everything that happens to the frog while a game is actually being
 *   played: the collision tests, the river-diver and fly animations, the home-bay creature timers,
 *   and finally the frog's own input. Once per displayed frame it (1) runs the collision/animation
 *   sub-engines in a fixed order, (2) ticks the goal-sprite timing arm and the home-bay slot cursor,
 *   (3) advances one of two home-bay creature timers — the crocodile arm or the fly arm, chosen by a
 *   bit of the level count — and (4) routes to either the home-bay goal scan or the joystick input
 *   scan through the shared exit.
 *
 * WHERE IT SITS
 *   Called once per frame from the in-play branch of the NMI cascade (see mechanisms.md "In-play
 *   cascade"): all forward motion of Frogger happens in the vblank NMI, and this routine is the arm
 *   of it that owns the frog. It runs ONLY in play — a clear play flag (PLAY_FLAG 0x83fe) short-
 *   circuits everything and tails straight to the shared exit, so none of the collision or creature
 *   machinery below touches memory during attract/demo.
 *
 * LIVE-OUT
 *   Memory only. It writes the two free-running counters (SCROLL_TIMER_COUNTER 0x8122, and the
 *   goal-sprite arm cell HOME_GOAL_SPRITE_ARM_CELL 0x8340), and everything else it changes it changes
 *   through the sub-engines it calls. It returns nothing and leaves no register the caller reads.
 */
import { PLAY_FLAG, HOME_GOAL_SPRITE_ARM_CELL, LIVES_COUNT, FROG_Y, SCROLL_TIMER_COUNTER } from "./names.js";
import { mountOrKillFrogOnTwoPairFigure } from "./mountOrKillFrogOnTwoPairFigure.js";
import { animateTwoPairFigure } from "./animateTwoPairFigure.js";
import { loc_27ea } from "./loc_27ea.js";
import { animateFlyEatCollision } from "./animateFlyEatCollision.js";
import { enqueueLaneScrollSyncedCommand } from "./enqueueLaneScrollSyncedCommand.js";
import { clearFourByteCounterBlock } from "./clearFourByteCounterBlock.js";
import { loc_23eb } from "./loc_23eb.js";
import { stampHomeBayFly } from "./stampHomeBayFly.js";
import { stampHomeBaySlot } from "./stampHomeBaySlot.js";
import { stampHomeBayGatorEmerging } from "./stampHomeBayGatorEmerging.js";
import { stampHomeBayGatorFull } from "./stampHomeBayGatorFull.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";
import { clearFlySpriteBlock } from "./clearFlySpriteBlock.js";
import { selectHomeBayGoalHandler } from "./selectHomeBayGoalHandler.js";

// The fly home-bay creature runs on a full 8-bit wrap: stamp the fly the frame the counter rolls
// 0xff -> 0x00, erase it again at counter value 0x70. (The crocodile path in gatorSlotArm has its own
// phase marks; see there.)
const FLY_ERASE_MARK = 0x70;

// Crocodile home-bay creature phase marks on SCROLL_TIMER_COUNTER (0x8122): stamp the emerging gator
// on the wrap to 0, promote it to the fully-surfaced gator at 0x50, erase it back to the empty home
// tile at 0xb0.
const GATOR_FULL_MARK = 0x50;
const GATOR_ERASE_MARK = 0xb0;

// The goal-sprite timing arm counts DOWN from 0xa0 (160), the value armHomeGoalSprite (0x27cb) seeds
// into HOME_GOAL_SPRITE_ARM_CELL (0x8340) when the frog reaches a bay. The moment it reaches 1 — one
// frame before it would hit 0 — the celebration record and its sprite block are cleared.
const GOAL_ARM_FIRE = 1;

// The shared exit sends a frog on the top home row to the goal scan; anything at or below this Y stays
// in ordinary lane play. FROG_Y (0x8047) < 0x31 means the frog has climbed into the home-bay region.
const HOME_ROW_Y_LIMIT = 0x31;

export function orchestrateCollisionsAndFrogInput(m) {
  const { mem8 } = m;

  // ── In-play gate ─────────────────────────────────────────────────────────────────────
  // PLAY_FLAG (0x83fe) is 0 during attract/demo and 1/2 during a live 1- or 2-player game. When it is
  // clear there is no frog to collide, animate, or read input for, so skip the entire body and drop to
  // the shared exit (which itself no-ops without an in-play frog). This is why none of the collision or
  // creature machinery ever runs in attract mode.
  if (mem8[PLAY_FLAG] === 0) return sharedExit(m);

  // ── Collision / animation sub-engines, run in a fixed order every in-play frame ────────
  // The first three are the river diver in its ROM-fixed order (see mechanisms.md "The river diver"):
  //   mountOrKillFrogOnTwoPairFigure (0x28bb) — frog-vs-diver box test: ride the surfacing diver or die.
  //   animateTwoPairFigure           (0x291d) — advance the diver figure's 2x2 tile animation.
  //   loc_27ea                       (0x27ea) — the dive-animation driver (paints the descending column).
  // Then the fly-bonus and lane-scroll arms:
  //   animateFlyEatCollision         (0x26a6) — the tongue/fly-eat state machine.
  //   enqueueLaneScrollSyncedCommand (0x2906) — queues the log/turtle scroll sound when the lane wraps.
  mountOrKillFrogOnTwoPairFigure(m);
  animateTwoPairFigure(m);
  loc_27ea(m);
  animateFlyEatCollision(m);
  enqueueLaneScrollSyncedCommand(m);

  // ── Goal-sprite timing arm ─────────────────────────────────────────────────────────────
  // Only tick the goal-celebration sprite timer while it is armed (non-zero). armHomeGoalSprite set it
  // to 0xa0 when the frog last reached a bay; interiorTimingArm counts it down and, at the fire mark,
  // tears down the celebration bookkeeping. Left at 0 (disarmed) this frame does nothing here.
  if (mem8[HOME_GOAL_SPRITE_ARM_CELL] !== 0) interiorTimingArm(m);

  // ── Home-bay slot cursor step ──────────────────────────────────────────────────────────
  // loc_23eb (0x23eb) advances HOME_BAY_SLOT_CURSOR (0x8123) by one, wrapping to 0 at 6. Values 1..5
  // name the bay the empty-bay creature is currently drawn in; 0 is a rest phase. The creature stampers
  // below read this cursor to know which bay to draw into.
  loc_23eb(m);

  // ── Empty-bay creature timer: crocodile path OR fly path ───────────────────────────────
  // The low bit of the level/life count LIVES_COUNT (0x83b7) selects which creature cycles through the
  // still-empty home bays. Bit clear -> crocodile (its arm lives in gatorSlotArm, which also runs the
  // shared exit and returns). Bit set -> the fly path, inlined here.
  if ((mem8[LIVES_COUNT] & 0x01) === 0) return gatorSlotArm(m);

  // Fly path: bump the free-running frame counter SCROLL_TIMER_COUNTER (0x8122). On its wrap to 0 stamp
  // the fly-bonus tiles into the cursor's bay (stampHomeBayFly 0x23fa); at 0x70 erase them back to the
  // empty home tile (stampHomeBaySlot 0x25ce). The second test re-reads the cell — faithful to the ROM,
  // and equal to `scrollTimer` here because nothing between the two writes 0x8122.
  const scrollTimer = (mem8[SCROLL_TIMER_COUNTER] + 1) & 0xff;
  mem8[SCROLL_TIMER_COUNTER] = scrollTimer;
  if (scrollTimer === 0) stampHomeBayFly(m);
  if (mem8[SCROLL_TIMER_COUNTER] === FLY_ERASE_MARK) stampHomeBaySlot(m);
  return sharedExit(m);
}

// ── Goal-sprite timing arm ───────────────────────────────────────────────────────────────
// Tick HOME_GOAL_SPRITE_ARM_CELL (0x8340) down by one each armed frame. When it reaches exactly 1
// (GOAL_ARM_FIRE) — the frame before it would disarm at 0 — tear down the finished goal celebration:
// clearFourByteCounterBlock (0x269a) zeros the floating-score record GOAL_AWARD_RECORD (0x805c-0x805f),
// and clearFlySpriteBlock (0x27de) zeros the fly/goal sprite descriptor FLY_SPRITE_X..+3 (0x8040-0x8043).
function interiorTimingArm(m) {
  const { mem8 } = m;
  const armRemaining = (mem8[HOME_GOAL_SPRITE_ARM_CELL] - 1) & 0xff;
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = armRemaining;
  if (armRemaining !== GOAL_ARM_FIRE) return;
  clearFourByteCounterBlock(m);
  clearFlySpriteBlock(m);
}

// ── Crocodile empty-bay creature timer (LIVES_COUNT bit0 clear) ─────────────────────────────
// Bump the same free-running counter SCROLL_TIMER_COUNTER (0x8122) and drive the three-phase crocodile
// animation in the cursor's bay: on the wrap to 0 the just-surfacing gator (stampHomeBayGatorEmerging
// 0x2496), at 0x50 the fully-surfaced gator (stampHomeBayGatorFull 0x2532), at 0xb0 erase it back to the
// empty home tile (stampHomeBaySlot 0x25ce). Each mark re-reads the cell, matching the ROM. Falls through
// to the shared exit and returns — this branch is the whole tail of the frame when the fly path is off.
function gatorSlotArm(m) {
  const { mem8 } = m;
  const scrollTimer = (mem8[SCROLL_TIMER_COUNTER] + 1) & 0xff;
  mem8[SCROLL_TIMER_COUNTER] = scrollTimer;
  if (scrollTimer === 0) stampHomeBayGatorEmerging(m);
  if (mem8[SCROLL_TIMER_COUNTER] === GATOR_FULL_MARK) stampHomeBayGatorFull(m);
  if (mem8[SCROLL_TIMER_COUNTER] === GATOR_ERASE_MARK) stampHomeBaySlot(m);
  return sharedExit(m);
}

// ── Shared exit: goal scan, quiet return, or input scan ─────────────────────────────────────
// The common tail every path funnels through.
//  - Frog on the top home row (FROG_Y 0x8047 < 0x31): route to selectHomeBayGoalHandler (0x1cff), the
//    column dispatcher that awards / rejects a home bay by the frog's X.
//  - Otherwise, if the play flag went clear mid-frame, return quietly (nothing to scan).
//  - Otherwise scan the joystick and dispatch a hop via scanFrogInputAndDispatchHop (0x1acb).
function sharedExit(m) {
  const { mem8 } = m;
  if (mem8[FROG_Y] < HOME_ROW_Y_LIMIT) return selectHomeBayGoalHandler(m);
  if (mem8[PLAY_FLAG] === 0) return;
  return scanFrogInputAndDispatchHop(m);
}
