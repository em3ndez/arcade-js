// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSpriteObjectCluster — sprite-object cluster entry, run once per frame. The slot count gates how
 * many passes run: below 3 it skips straight to dispatcher B; otherwise it runs dispatcher A on the
 * active player's record/slot, then a second dispatcher-A pass (advancing to the next record/slot only
 * when the count reaches 6), and finally dispatcher B. The active player selects the record pair.
 * Dispatcher A and dispatcher B are both lifted, called inline. LIVE-OUT: memory-only.
 */
import { updateSpriteObject } from "./updateSpriteObject.js";
import { dispatchSpriteObjectArmsA } from "./dispatchSpriteObjectArmsA.js";
import { LIVES_COUNT, ACTIVE_PLAYER } from "./names.js";

const MIN_SLOTS = 3, TWO_SLOTS = 6;
const RECORD_A_P1 = 0x8440, RECORD_A_P2 = 0x8460, RECORD_ADVANCE = 0x0010;
const SLOT_A_FIRST = 0x8048, SLOT_A_SECOND = 0x8050;
const RECORD_B_P1 = 0x8480, RECORD_B_P2 = 0x8490, SLOT_B = 0x8058;

export function driveSpriteObjectCluster(m) {
  const { regs, mem8 } = m;

  if (mem8[LIVES_COUNT] >= MIN_SLOTS) {
    regs.ix = mem8[ACTIVE_PLAYER] === 1 ? RECORD_A_P1 : RECORD_A_P2;
    regs.iy = SLOT_A_FIRST;
    dispatchSpriteObjectArmsA(m);
    if (mem8[LIVES_COUNT] >= TWO_SLOTS) {
      regs.ix = (regs.ix + RECORD_ADVANCE) & 0xffff;
      regs.iy = SLOT_A_SECOND;
    }
    dispatchSpriteObjectArmsA(m);
  }

  regs.ix = mem8[ACTIVE_PLAYER] === 1 ? RECORD_B_P1 : RECORD_B_P2;
  regs.iy = SLOT_B;
  return updateSpriteObject(m);
}
