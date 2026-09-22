// SPDX-License-Identifier: GPL-3.0-only
/**
 * update75mActorObjects — on 75m, while Mario is alive, walk all ten actor-object
 * records, seeding the object and paired-sprite cursors and handing each object to
 * the per-object updater, which advances the cursors in its own tail.
 * LIVE-OUT: memory-only.
 */

import { OBJ_ARRAY_65, ACTOR_SPRITES } from "./names.js";
import { boardBitGate } from "./boardBitGate.js";
import { marioActiveGuard } from "./marioActiveGuard.js";
import { advanceSpring } from "./advanceSpring.js";

const BOARD_MASK = 0x04; // current-board bit is set only on board 3 (75m)
const ACTOR_COUNT = 10;

export function update75mActorObjects(m) {
  if (!boardBitGate(m, BOARD_MASK)) return;

  if (!marioActiveGuard(m)) return;

  // The sweep owns both scan cursors as plain JS values, stepping the object record 16 bytes and
  // the paired sprite record 4 each pass; advanceSpring seeds them into the register file its tail
  // reads back from.
  for (let i = 0, record = OBJ_ARRAY_65, spriteRecord = ACTOR_SPRITES;
       i < ACTOR_COUNT;
       i++, record += 16, spriteRecord += 4) {
    advanceSpring(m, record, spriteRecord);
  }
}
