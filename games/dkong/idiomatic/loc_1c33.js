// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c33 — the airborne handler's exit tail: on the one arrival value whose bump wraps to zero,
 * run the hammer-touch latch, then always refresh Mario's sprite record and return.
 *
 * LIVE-OUT: memory-only.
 */

import { u8 } from "../../../core/int.js";
import { latchHammerTouch } from "./latchHammerTouch.js";
import { writeMarioSpriteRecord } from "./writeMarioSpriteRecord.js";

export function loc_1c33(m, a = m.regs.a) {
  const bumped = u8(a + 1);
  if (bumped === 0) latchHammerTouch(m);

  writeMarioSpriteRecord(m);
}
