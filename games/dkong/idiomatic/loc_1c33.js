// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c33 — the airborne handler's exit tail: on the one arrival value whose bump wraps the byte
 * to zero, run the hammer-touch latch; then, always, refresh Mario's sprite record and return.
 *
 * Two paths in the airborne handler arrive here, and both occur in ordinary play:
 *
 *   - THE COUNTER PATH, the overwhelmingly common one. The handler has just measured how far
 *     MARIO_AIR_FRAMES is from the land-check trigger of 20 and branched here because the two
 *     differ — the arc is still in flight. The arrival value is therefore MARIO_AIR_FRAMES minus
 *     20, so the bump wraps to zero on exactly ONE airborne frame: the frame where MARIO_AIR_FRAMES
 *     is 19, immediately before the handler arms the fall-height check. That is the frame the
 *     hammer-touch latch runs on, which is why the latch fires roughly once per JUMP rather than
 *     once per frame — one hammer test per airborne arc.
 *
 *   - THE COLLISION FALL-THROUGH, rare. The handler's object-overlap block ran and reported a hit,
 *     and that block leaves the arrival value at 1 on its way out, having just latched the
 *     item-collected flag and the hit-effect state. A bump of 1 cannot wrap, so the latch can never
 *     run from this path — a collision frame never tests for a hammer touch here.
 *
 * The sprite-record refresh is unconditional and is the movement machine's universal tail: every
 * path through the mover ends there. This routine reaches it by a jump rather than a call, so that
 * tail's return is this routine's return — one net caller-return on both arms.
 *
 * Order between the two callees is not load-bearing: the latch and the sprite refresh share no cell
 * (the latch writes the hammer-pending flag, the item/score sound trigger and the touched hammer's
 * record; the refresh reads Mario's live fields and writes his sprite record), so swapping them
 * would be invisible — the hardware's order is kept anyway.
 *
 * The arrival value is a genuine register live-in: its only setter is the airborne handler, which
 * reaches here with no arguments, so it is read out of the register file at entry rather than taken
 * as a parameter.
 *
 * LIVE-OUT: memory-only. The bumped value is consumed only by the wrap test here and nothing
 * downstream reads it.
 */

import { u8 } from "../../../core/int.js";
import { latchHammerTouch } from "./latchHammerTouch.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

/**
 * @param {object} m  the machine. Live-in: the airborne handler's arrival value, in the register
 *   file (see the header). Live-out: memory only.
 */
export function loc_1c33(m) {
  const { regs } = m;

  // Bump the handler's arrival value. The wrap to zero is the whole selector: on the counter
  // path it means the airborne frame counter sits one frame short of the land-check trigger.
  const bumped = u8(regs.a + 1);
  if (bumped === 0) latchHammerTouch(m);

  // The mover's universal tail — Mario's freshly-computed state into his sprite record.
  writeMarioSpriteRecord(m);
}
