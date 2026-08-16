// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardHomeBayGoal — the goal handler for two home bays (bay 2 and bay 4, sharing this body). Returns
 * when that bay's occupancy gate is already set; hands to the input scan when the frog has not fully
 * reached the home row. Otherwise it awards the bay — bonus points on a pending-slot key match, the
 * shared home-goal fill/reset, on a latched collision the goal sprite + latch clear, and finally the
 * occupancy gate + this player's home count. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_PLAYER, FROG_Y, COLLISION_SUBFLAG, PENDING_HOME_BAY_SLOT, PLAYER1_SLOT,
  HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_ALT,
} from "./names.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";
import { armHomeGoalSprite } from "./armHomeGoalSprite.js";
import { awardBonusPoints } from "./awardBonusPoints.js";

const PLAYER2_SLOT = 0x825d;  // player-2 home count (sibling of the player-1 slot cell)
const HOME_ROW_Y = 0x2a;      // a frog Y at or past this has not fully reached the home row

const HOME_GOAL_FILL = 0x1f1c; // shared home-goal fill/reset, a cluster sibling (kept dispatch)

const BAY2 = { doneP1: HOME_BAY2_OCCUPANCY_PRIMARY, doneP2: HOME_BAY2_OCCUPANCY_ALT, bayY: 0x48, key: 0x02, slot: 0xaaa4, r1: 0x1df5, r2: 0x1dfb };
const BAY4 = { doneP1: HOME_BAY4_OCCUPANCY_PRIMARY, doneP2: HOME_BAY4_OCCUPANCY_ALT, bayY: 0xa8, key: 0x04, slot: 0xa924, r1: 0x1e97, r2: 0x1e9d };

function awardHomeBayGoal(m, p) {
  const { regs, mem8 } = m;

  if (mem8[mem8[ACTIVE_PLAYER] === 1 ? p.doneP1 : p.doneP2] !== 0) return;
  if (mem8[FROG_Y] >= HOME_ROW_Y) return scanFrogInputAndDispatchHop(m);

  // key match -> award bonus; the hold arm signals us to skip the rest of the goal handler.
  if (((mem8[PENDING_HOME_BAY_SLOT] - p.key) & 0xff) === 0 && awardBonusPoints(m, p.bayY)) return;

  regs.hl = p.slot;
  m.push16(p.r2); m.call(HOME_GOAL_FILL);

  if (mem8[COLLISION_SUBFLAG] !== 0) {
    regs.b = p.bayY;
    armHomeGoalSprite(m);
    mem8[COLLISION_SUBFLAG] = 0;
  }

  if (mem8[ACTIVE_PLAYER] === 1) {
    mem8[p.doneP1] = 1;
    mem8[PLAYER1_SLOT] = (mem8[PLAYER1_SLOT] + 1) & 0xff;
  } else {
    mem8[p.doneP2] = 1;
    mem8[PLAYER2_SLOT] = (mem8[PLAYER2_SLOT] + 1) & 0xff;
  }
}

export function awardHomeBay2Goal(m) { return awardHomeBayGoal(m, BAY2); }
export function awardHomeBay4Goal(m) { return awardHomeBayGoal(m, BAY4); }
