// SPDX-License-Identifier: GPL-3.0-only
/**
 * markOnLadderAndCommitSprite — flag Mario as on a ladder, then refresh his sprite record.
 *
 * LIVE-OUT: memory-only — MARIO_ON_LADDER := 1 and the four bytes of Mario's sprite record.
 */

import { MARIO_ON_LADDER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function markOnLadderAndCommitSprite(m) {
  const { mem8 } = m;
  mem8[MARIO_ON_LADDER] = 1;
  writeMarioSpriteRecord(m);
}
