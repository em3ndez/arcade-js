// SPDX-License-Identifier: GPL-3.0-only
/**
 * settleMarioOnLanding — settle Mario's state the instant he lands from a jump or fall,
 * commit any pending item pickup, then refresh his hardware sprite record.  ROM 0x1C4F.
 *
 * Reached from the mover's landing branch (loc_1c3a, when its object counter hits its
 * terminal value). It runs a fixed sequence of one-shot state resets:
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
 *   - If an item pickup is pending (ITEM_COLLECTED latched to 1), commit it: loc_1d95
 *     stores the cleared flag back and, off 25m, queues the pickup tune.
 *   - Refresh Mario's 4-byte hardware sprite record from his just-settled fields.
 *
 * The caller reaches this by a tail branch and this routine tail-jumps into the sprite
 * refresh, so nothing downstream consumes a returned value.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1c4f.test.js.
 * GATE:     captured + crafted. Real attract dispatches (9 in 6000 frames, all on 25m with
 *           the landing flag 0) cover the no-pickup arm and the pickup arm's 25m no-sound
 *           path; crafted entries pin the nonzero landing-flag store, both MARIO_ACTIVE
 *           arms, the sprite-pose mask, and the off-25m pickup-sound path loc_1d95 takes.
 *           Teeth: a hardcoded landing flag, a skipped pickup commit, a wrong pose mask,
 *           and a dropped MARIO_ACTIVE flip.
 * LIVE-OUT: memory-only — MARIO_AIRBORNE, MARIO_ACTIVE, MARIO_SPRITE_CODE,
 *           MARIO_FREEZE_TIMER, MARIO_AIR_LANDCHECK, the pickup cells loc_1d95 touches,
 *           and the four sprite-record bytes. The caller reaches here by a tail branch and
 *           the routine tail-jumps into the sprite refresh, so no successor reads a leftover
 *           register or flag.
 * NAMES:    MARIO_AIRBORNE (0x6216), MARIO_FATAL_FALL (0x6220), MARIO_ACTIVE (0x6200),
 *           MARIO_SPRITE_CODE (0x6207), MARIO_FREEZE_TIMER (0x621E),
 *           MARIO_AIR_LANDCHECK (0x621F), ITEM_COLLECTED (0x6225) — all from names.js. The
 *           two direct-called callees (loc_1d95, writeMarioSpriteRecord) own the rest.
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
import { loc_1d95 } from "./loc_1d95.js";                     // ROM 0x1D95
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js"; // ROM 0x1DA6

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
  // clears the latch (and, off 25m, queues the pickup tune) inside loc_1d95, which stores
  // the cleared flag value it is handed.
  if (mem.read8(ITEM_COLLECTED) === 1) {
    regs.a = 0; // the cleared latch value loc_1d95 commits back into ITEM_COLLECTED
    loc_1d95(m);
  }

  // Refresh Mario's hardware sprite record from his just-settled position/sprite fields.
  writeMarioSpriteRecord(m);
}
