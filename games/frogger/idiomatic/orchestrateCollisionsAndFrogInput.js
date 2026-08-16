// SPDX-License-Identifier: GPL-3.0-only
/**
 * orchestrateCollisionsAndFrogInput — the master collision/scoring orchestrator. A clear play flag
 * tails straight to the shared exit; set, it runs the collision sub-engines, an interior timing arm
 * gated by its arm cell, the slot-cursor tick, then a scroll-timer stage chosen by a life-count bit —
 * the gator/slot arm or the inline fly/slot arm, each keyed on the scroll counter — and finally the
 * shared exit: a low frog row tails to the goal scan, a clear play flag returns, otherwise the input
 * scan runs. Plain leaves dissolve; the tail-transferring dive driver, goal scan, and dive-counter
 * arm are dispatched by address so the seam keeps a balanced stack. LIVE-OUT: memory-only.
 */
import { PLAY_FLAG, loc_8340, loc_83b7, FROG_Y } from "./names.js";
import { mountOrKillFrogOnTwoPairFigure } from "./mountOrKillFrogOnTwoPairFigure.js";
import { animateTwoPairFigure } from "./animateTwoPairFigure.js";
import { animateFlyEatCollision } from "./animateFlyEatCollision.js";
import { queueFrogOnLogEdgeBlit } from "./queueFrogOnLogEdgeBlit.js";
import { clearFourByteCounterBlock } from "./clearFourByteCounterBlock.js";
import { loc_23eb } from "./loc_23eb.js";
import { stampHomeBayFly } from "./stampHomeBayFly.js";
import { stampHomeBaySlot } from "./stampHomeBaySlot.js";
import { stampHomeBayGatorEmerging } from "./stampHomeBayGatorEmerging.js";
import { stampHomeBayGatorFull } from "./stampHomeBayGatorFull.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";

const SCROLL_TIMER_COUNTER = 0x8122; // per-frame counter driving the fly/gator/slot arms
const DIVE_DRIVER = 0x27ea, GOAL_SCAN = 0x1cff, DIVE_COUNTER_ARM = 0x27de;

export function orchestrateCollisionsAndFrogInput(m) {
  const { mem8 } = m;

  if (mem8[PLAY_FLAG] === 0) return sharedExit(m);

  mountOrKillFrogOnTwoPairFigure(m);
  animateTwoPairFigure(m);
  m.push16(0x1a64); m.call(DIVE_DRIVER);
  animateFlyEatCollision(m);
  queueFrogOnLogEdgeBlit(m);

  if (mem8[loc_8340] !== 0) interiorTimingArm(m);
  loc_23eb(m);

  if ((mem8[loc_83b7] & 0x01) === 0) return gatorSlotArm(m);

  const v = (mem8[SCROLL_TIMER_COUNTER] + 1) & 0xff;
  mem8[SCROLL_TIMER_COUNTER] = v;
  if (v === 0) stampHomeBayFly(m);
  if (mem8[SCROLL_TIMER_COUNTER] === 0x70) stampHomeBaySlot(m);
  return sharedExit(m);
}

// Tick the arm cell down; only when it reaches 1, clear the counter block and run the dive-counter arm.
function interiorTimingArm(m) {
  const mem8 = m.mem8;
  const v = (mem8[loc_8340] - 1) & 0xff;
  mem8[loc_8340] = v;
  if (v !== 1) return;
  clearFourByteCounterBlock(m);
  m.push16(0x1aac); m.call(DIVE_COUNTER_ARM);
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
