// SPDX-License-Identifier: GPL-3.0-only
/**
 * markOnLadderAndCommitSprite — flag Mario as on a ladder, then refresh his sprite record.
 *
 * The tail of the ladder/climb-step path in the movement machine. A climb step arrives
 * here — from the arm that has just rewritten Mario's facing/climb sprite code, and from
 * the climb-sound arm — to do two things, in order:
 *
 *   1. set MARIO_ON_LADDER := 1 — re-assert the on-ladder flag on every climb step. The
 *      ladder-end handler is what later clears it back to 0.
 *   2. copy Mario's just-computed position and sprite code into his four-byte hardware
 *      sprite record.
 *
 * Step 2 is a tail hand-off: its return is this routine's return. Nothing arrives in a
 * register — the flag value is a constant and the record write reloads everything it needs
 * from memory — so this takes only the machine and returns nothing.
 *
 * LIVE-OUT: memory-only — MARIO_ON_LADDER := 1 and the four bytes of Mario's sprite record.
 */

import { MARIO_ON_LADDER } from "./names.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function markOnLadderAndCommitSprite(m) {
  m.mem.write8(MARIO_ON_LADDER, 1); // re-assert on-ladder on every climb step
  writeMarioSpriteRecord(m);        // tail hand-off: refresh the 4-byte sprite record
}
