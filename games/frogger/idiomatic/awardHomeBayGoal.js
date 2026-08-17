// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardHomeBayGoal — the goal handler for two home bays (bay 2 and bay 4, sharing this body). Returns
 * when that bay's occupancy gate is already set; hands to the input scan when the frog has not fully
 * reached the home row. Otherwise it awards the bay — bonus points on a pending-slot key match, the
 * shared home-goal fill/reset (stampHomeGoalAndResetFrog), on a latched collision the goal sprite +
 * latch clear, and finally the occupancy gate + this player's home count. LIVE-OUT: memory-only.
 */
import {
  ACTIVE_PLAYER, FROG_Y, COLLISION_SUBFLAG, PENDING_HOME_BAY_SLOT, PLAYER1_SLOT, PLAYER2_SLOT,
  HOME_BAY2_OCCUPANCY_PRIMARY, HOME_BAY2_OCCUPANCY_ALT, HOME_BAY4_OCCUPANCY_PRIMARY, HOME_BAY4_OCCUPANCY_ALT,
  HOME_SLOT2_VRAM, HOME_SLOT4_VRAM,
} from "./names.js";
import { scanFrogInputAndDispatchHop } from "./scanFrogInputAndDispatchHop.js";
import { armHomeGoalSprite } from "./armHomeGoalSprite.js";
import { awardBonusPoints } from "./awardBonusPoints.js";
import { stampHomeGoalAndResetFrog } from "./stampHomeGoalAndResetFrog.js";

const HOME_ROW_Y = 0x2a;      // a frog Y at or past this has not fully reached the home row

const BAY2 = { doneP1: HOME_BAY2_OCCUPANCY_PRIMARY, doneP2: HOME_BAY2_OCCUPANCY_ALT, bayY: 0x48, key: 0x02, slot: HOME_SLOT2_VRAM };
const BAY4 = { doneP1: HOME_BAY4_OCCUPANCY_PRIMARY, doneP2: HOME_BAY4_OCCUPANCY_ALT, bayY: 0xa8, key: 0x04, slot: HOME_SLOT4_VRAM };

function awardHomeBayGoal(m, p) {
  const { regs, mem8 } = m;

  if (mem8[mem8[ACTIVE_PLAYER] === 1 ? p.doneP1 : p.doneP2] !== 0) return;
  if (mem8[FROG_Y] >= HOME_ROW_Y) return scanFrogInputAndDispatchHop(m);

  // key match -> award bonus; the hold arm signals us to skip the rest of the goal handler.
  if (((mem8[PENDING_HOME_BAY_SLOT] - p.key) & 0xff) === 0 && awardBonusPoints(m, p.bayY)) return;

  // Stamp the 2x2 home tiles at this bay's slot base + reset the frog. The slot base is handed over in
  // HL: a bridge into stampHomeGoalAndResetFrog, which still reads HL directly (its own CPU-cruft
  // burn-down is pending). Once that module takes an HL param this write dissolves to a direct argument.
  regs.hl = p.slot;
  stampHomeGoalAndResetFrog(m);

  if (mem8[COLLISION_SUBFLAG] !== 0) {
    armHomeGoalSprite(m, p.bayY);
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
