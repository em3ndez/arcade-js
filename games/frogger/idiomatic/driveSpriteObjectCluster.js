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
import {
  LIVES_COUNT, ACTIVE_PLAYER, SPRITE_OBJECT_SLOT_B, SPRITE_OBJECT_SLOT_A,
  SPRITE_OBJECT_RECORD_A_P1, SPRITE_OBJECT_RECORD_A_P2, SPRITE_OBJECT_SLOT_A_SECOND,
  SPRITE_OBJECT_RECORD_B_P1, SPRITE_OBJECT_RECORD_B_P2,
} from "./names.js";

const MIN_SLOTS = 3, TWO_SLOTS = 6;
const RECORD_ADVANCE = 0x10;

export function driveSpriteObjectCluster(m) {
  const { mem8 } = m;

  if (mem8[LIVES_COUNT] >= MIN_SLOTS) {
    let recordA = mem8[ACTIVE_PLAYER] === 1 ? SPRITE_OBJECT_RECORD_A_P1 : SPRITE_OBJECT_RECORD_A_P2;
    let slotA = SPRITE_OBJECT_SLOT_A;
    dispatchSpriteObjectArmsA(m, recordA, slotA);
    if (mem8[LIVES_COUNT] >= TWO_SLOTS) {
      recordA = recordA + RECORD_ADVANCE;
      slotA = SPRITE_OBJECT_SLOT_A_SECOND;
    }
    dispatchSpriteObjectArmsA(m, recordA, slotA);
  }

  const recordB = mem8[ACTIVE_PLAYER] === 1 ? SPRITE_OBJECT_RECORD_B_P1 : SPRITE_OBJECT_RECORD_B_P2;
  return updateSpriteObject(m, recordB, SPRITE_OBJECT_SLOT_B);
}
