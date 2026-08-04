// SPDX-License-Identifier: GPL-3.0-only
/**
 * settleMarioOnLanding — settle Mario's state the instant he lands from a jump or fall,
 * commit any pending item pickup, then refresh his hardware sprite record.
 *
 * Reached from the mover's landing branch, on the frame its object counter hits its
 * terminal value. It runs a fixed sequence of one-shot state resets:
 *
 *   - Mark Mario grounded: store the caller-supplied landing flag (0 in play) into
 *     MARIO_AIRBORNE, so the airborne handler stops driving him.
 *   - Set MARIO_ACTIVE alive-unless-this-was-a-fatal-fall: it becomes MARIO_FATAL_FALL
 *     flipped, so a clean landing (fatal-fall flag clear) makes him alive, a lethal one
 *     leaves him inert for the death sequence.
 *   - Snap the sprite tile to the standing/landing pose while keeping his facing: preserve
 *     the facing-flip bit and force the pose bits to their reset value.
 *   - Arm the post-landing freeze lock to 4 frames (a countdown another routine ticks down,
 *     holding him briefly still on touchdown) and clear the airborne land-check flag.
 *   - If an item pickup is pending (ITEM_COLLECTED latched to 1), commit it: the pickup
 *     commit stores the cleared flag back and, off 25m, queues the pickup tune.
 *   - Refresh Mario's 4-byte hardware sprite record from his just-settled fields.
 *
 * The caller reaches this by a tail branch and this routine tail-jumps into the sprite
 * refresh, so nothing downstream consumes a returned value.
 *
 * LIVE-OUT: memory-only — MARIO_AIRBORNE, MARIO_ACTIVE, MARIO_SPRITE_CODE,
 * MARIO_FREEZE_TIMER, MARIO_AIR_LANDCHECK, the pickup cells, and the four sprite-record
 * bytes.
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
  const { regs, mem } = m;

  // Mark Mario grounded — the caller passes the landing flag (0 in play) in a register.
  mem.write8(MARIO_AIRBORNE, regs.a);

  // Alive unless this landing was a fatal fall: MARIO_ACTIVE is the fatal-fall flag flipped.
  mem.write8(MARIO_ACTIVE, mem.read8(MARIO_FATAL_FALL) ^ 1);

  // Reset the sprite tile to the standing pose, keeping his facing: preserve the facing-flip
  // bit (0x80) and force the pose bits to 0x0f.
  mem.write8(MARIO_SPRITE_CODE, (mem.read8(MARIO_SPRITE_CODE) & 0x80) | 0x0f);

  // Arm the post-landing freeze lock (4 frames) and clear the airborne land-check flag.
  mem.write8(MARIO_FREEZE_TIMER, 4);
  mem.write8(MARIO_AIR_LANDCHECK, 0);

  // Pending item pickup? The latch reads 1 exactly when a pickup is queued; committing it
  // clears the latch (and, off 25m, queues the pickup tune) inside the pickup commit, which
  // stores the cleared flag value it is handed.
  if (mem.read8(ITEM_COLLECTED) === 1) {
    regs.a = 0; // the cleared latch value the pickup commit writes back into ITEM_COLLECTED
    loc_1d95(m);
  }

  // Refresh Mario's hardware sprite record from his just-settled position/sprite fields.
  writeMarioSpriteRecord(m);
}
