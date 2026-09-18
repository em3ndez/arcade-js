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
  const { regs } = m;

  if (!boardBitGate(m, BOARD_MASK)) return;

  if (!marioActiveGuard(m)) return;

  regs.ix = OBJ_ARRAY_65;
  regs.iy = ACTOR_SPRITES;
  for (let i = 0; i < ACTOR_COUNT; i++) {
    advanceSpring(m);
  }
}
