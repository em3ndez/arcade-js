// SPDX-License-Identifier: GPL-3.0-only
/**
 * orchestrateCollisionsAndFrogInput — the master collision/scoring orchestrator. A clear play flag
 * tails straight to the shared exit; set, it runs the collision sub-engines, an interior timing arm
 * gated by its arm cell, the slot-cursor tick, then a scroll-timer stage chosen by a life-count bit —
 * the gator/slot arm or the inline fly/slot arm, each keyed on the scroll counter — and finally the
 * shared exit: a low frog row tails to the goal scan, a clear play flag returns, otherwise the input
 * scan runs. Plain leaves dissolve; the tail-transferring dive driver and goal scan are dispatched by
 * address so the seam keeps a balanced stack. LIVE-OUT: memory-only.
 */
import { PLAY_FLAG, HOME_GOAL_SPRITE_ARM_CELL, LIVES_COUNT, FROG_Y } from "./names.js";
import { mountOrKillFrogOnTwoPairFigure } from "./mountOrKillFrogOnTwoPairFigure.js";
import { animateTwoPairFigure } from "./animateTwoPairFigure.js";
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

const SCROLL_TIMER_COUNTER = 0x8122; // per-frame counter driving the fly/gator/slot arms
const DIVE_DRIVER = 0x27ea, GOAL_SCAN = 0x1cff;

export function orchestrateCollisionsAndFrogInput(m) {
  const { mem8 } = m;

  if (mem8[PLAY_FLAG] === 0) return sharedExit(m);

  mountOrKillFrogOnTwoPairFigure(m);
  animateTwoPairFigure(m);
  m.push16(0x1a64); m.call(DIVE_DRIVER);
  animateFlyEatCollision(m);
  enqueueLaneScrollSyncedCommand(m);

  if (mem8[HOME_GOAL_SPRITE_ARM_CELL] !== 0) interiorTimingArm(m);
  loc_23eb(m);

  if ((mem8[LIVES_COUNT] & 0x01) === 0) return gatorSlotArm(m);

  const v = (mem8[SCROLL_TIMER_COUNTER] + 1) & 0xff;
  mem8[SCROLL_TIMER_COUNTER] = v;
  if (v === 0) stampHomeBayFly(m);
  if (mem8[SCROLL_TIMER_COUNTER] === 0x70) stampHomeBaySlot(m);
  return sharedExit(m);
}

// Tick the arm cell down; only when it reaches 1, clear the counter block and the fly-sprite block.
function interiorTimingArm(m) {
  const mem8 = m.mem8;
  const v = (mem8[HOME_GOAL_SPRITE_ARM_CELL] - 1) & 0xff;
  mem8[HOME_GOAL_SPRITE_ARM_CELL] = v;
  if (v !== 1) return;
  clearFourByteCounterBlock(m);
  clearFlySpriteBlock(m);
}

// Bump the scroll counter; fire the emerging gator on wrap, the full gator at 0x50, the slot at 0xb0.
function gatorSlotArm(m) {
  const mem8 = m.mem8;
  const v = (mem8[SCROLL_TIMER_COUNTER] + 1) & 0xff;
  mem8[SCROLL_TIMER_COUNTER] = v;
  if (v === 0) stampHomeBayGatorEmerging(m);
  if (mem8[SCROLL_TIMER_COUNTER] === 0x50) stampHomeBayGatorFull(m);
  if (mem8[SCROLL_TIMER_COUNTER] === 0xb0) stampHomeBaySlot(m);
  return sharedExit(m);
}

// A low frog row tails to the goal scan, a clear play flag returns, otherwise the input scan runs.
function sharedExit(m) {
  const mem8 = m.mem8;
  if (mem8[FROG_Y] < 0x31) return m.call(GOAL_SCAN);
  if (mem8[PLAY_FLAG] === 0) return;
  return scanFrogInputAndDispatchHop(m);
}
