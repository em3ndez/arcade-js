// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardHomeBayGoal — the shared goal handler body for all five home bays (one param object per bay).
 * Returns when that bay's occupancy gate is already set; hands to the input scan when the frog has not
 * fully reached the home row. Otherwise it awards the bay — bonus points on a pending-slot key match,
 * the shared home-goal fill/reset (stampHomeGoalAndResetFrog), on a latched collision the goal sprite +
 * latch clear, and finally the occupancy gate + this player's home count. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_PLAYER, FROG_Y, COLLISION_SUBFLAG, PENDING_HOME_BAY_SLOT, PLAYER1_SLOT, PLAYER2_SLOT,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY1_OCCUPANCY_ALT,
  HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_ALT,
  HOME_BAY3_OCCUPANCY_PRIMARY, HOME_BAY3_OCCUPANCY_ALT,
  HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_ALT,
  HOME_BAY5_OCCUPANCY_PRIMARY, HOME_BAY5_OCCUPANCY_ALT,
  HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM,
} from "./names.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";
import { armHomeGoalSprite } from "./armHomeGoalSprite.js";
import { awardBonusPoints } from "./awardBonusPoints.js";
import { stampHomeGoalAndResetFrog } from "./stampHomeGoalAndResetFrog.js";

const HOME_ROW_Y = 0x2a;      // a frog Y at or past this has not fully reached the home row

const BAY1 = { doneP1: HOME_BAY1_OCCUPANCY_PRIMARY, doneP2: HOME_BAY1_OCCUPANCY_ALT, bayY: 0x18, key: 0x01, slot: HOME_SLOT1_VRAM };
const BAY2 = { doneP1: HOME_BAY2_OCCUPANCY_PRIMARY, doneP2: HOME_BAY2_OCCUPANCY_ALT, bayY: 0x48, key: 0x02, slot: HOME_SLOT2_VRAM };
const BAY3 = { doneP1: HOME_BAY3_OCCUPANCY_PRIMARY, doneP2: HOME_BAY3_OCCUPANCY_ALT, bayY: 0x78, key: 0x03, slot: HOME_SLOT3_VRAM };
const BAY4 = { doneP1: HOME_BAY4_OCCUPANCY_PRIMARY, doneP2: HOME_BAY4_OCCUPANCY_ALT, bayY: 0xa8, key: 0x04, slot: HOME_SLOT4_VRAM };
const BAY5 = { doneP1: HOME_BAY5_OCCUPANCY_PRIMARY, doneP2: HOME_BAY5_OCCUPANCY_ALT, bayY: 0xd8, key: 0x05, slot: HOME_SLOT5_VRAM };

function awardHomeBayGoal(m, p) {
  const { mem8 } = m;

  if (mem8[mem8[ACTIVE_PLAYER] === 1 ? p.doneP1 : p.doneP2] !== 0) return;
  if (mem8[FROG_Y] >= HOME_ROW_Y) return scanFrogInputAndDispatchHop(m);

  // key match -> award bonus; the hold arm signals us to skip the rest of the goal handler.
  if (((mem8[PENDING_HOME_BAY_SLOT] - p.key) & 0xff) === 0 && awardBonusPoints(m, p.bayY)) return;

  // Stamp the 2x2 home tiles at this bay's slot base + reset the frog.
  stampHomeGoalAndResetFrog(m, p.slot);

  if (mem8[COLLISION_SUBFLAG] !== 0) {
    armHomeGoalSprite(m, p.bayY);
    mem8[COLLISION_SUBFLAG] = 0;
  }

  if (mem8[ACTIVE_PLAYER] === 1) {
    mem8[p.doneP1] = 1;
    mem8[PLAYER1_SLOT] = mem8[PLAYER1_SLOT] + 1;
  } else {
    mem8[p.doneP2] = 1;
    mem8[PLAYER2_SLOT] = mem8[PLAYER2_SLOT] + 1;
  }
}

export function awardHomeBay1Goal(m) { return awardHomeBayGoal(m, BAY1); }
export function awardHomeBay2Goal(m) { return awardHomeBayGoal(m, BAY2); }
export function awardHomeBay3Goal(m) { return awardHomeBayGoal(m, BAY3); }
export function awardHomeBay4Goal(m) { return awardHomeBayGoal(m, BAY4); }
export function awardHomeBay5Goal(m) { return awardHomeBayGoal(m, BAY5); }
