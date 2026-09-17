// SPDX-License-Identifier: GPL-3.0-only
/**
 * settleMarioOnLanding — settle Mario's state the instant he lands from a jump or fall, commit any
 * pending item pickup, then refresh his hardware sprite record. Reached from the mover's landing
 * branch. Marks him grounded, sets MARIO_ACTIVE alive-unless-fatal-fall, snaps the sprite to the
 * standing pose (keeping facing), arms the post-landing freeze lock, clears the land-check flag,
 * commits a pending pickup if latched, and tail-jumps into the sprite refresh.
 *
 * LIVE-OUT: memory-only — MARIO_AIRBORNE, MARIO_ACTIVE, MARIO_SPRITE_CODE, MARIO_FREEZE_TIMER,
 * MARIO_AIR_LANDCHECK, the pickup cells, and the four sprite-record bytes.
 */

import {
  MARIO_AIRBORNE,
  MARIO_FATAL_FALL,
  MARIO_ACTIVE,
  MARIO_SPRITE_CODE,
  MARIO_FREEZE_TIMER,
  MARIO_AIR_LANDCHECK,
  ITEM_COLLECTED,
} from "./names.js";
import { loc_1d95 } from "./loc_1d95.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function settleMarioOnLanding(m) {
  const { regs, mem8 } = m;

  // Caller passes the landing flag (0 in play) in a register.
  mem8[MARIO_AIRBORNE] = regs.a;

  // Alive unless this landing was a fatal fall: MARIO_ACTIVE is the fatal-fall flag flipped.
  mem8[MARIO_ACTIVE] = mem8[MARIO_FATAL_FALL] ^ 1;

  // Standing pose, keeping facing: preserve the facing-flip bit (0x80), force pose bits to 0x0f.
  mem8[MARIO_SPRITE_CODE] = (mem8[MARIO_SPRITE_CODE] & 0x80) | 0x0f;

  mem8[MARIO_FREEZE_TIMER] = 4;
  mem8[MARIO_AIR_LANDCHECK] = 0;

  // Pending pickup latched to 1 -> commit it (the commit clears the latch, storing the value here).
  if (mem8[ITEM_COLLECTED] === 1) {
    regs.a = 0;
    loc_1d95(m);
  }

  writeMarioSpriteRecord(m);
}
