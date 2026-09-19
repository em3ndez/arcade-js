// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectSpriteFrame — advance an object's animation sprite tile on a period-2 timer,
 * flipping bit 1 of the tile code at every sixteenth step. objBase addresses the record.
 *
 * LIVE-OUT: memory-only — the record's animation down-counter and its sprite tile code.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_SPRITE_CODE } from "./names.js";

const OBJ_ANIM_TIMER = 0x15; // object-record field: per-object animation down-counter

export function stepObjectSpriteFrame(m, objBase) {
  const { mem8 } = m;
  const timerAddr = u16(objBase + OBJ_ANIM_TIMER);
  const codeAddr = u16(objBase + OBJ_SPRITE_CODE);

  const timer = mem8[timerAddr];
  if (timer !== 0) {
    mem8[timerAddr] = timer - 1;
    return;
  }

  // Reload to 2 (advance every other call) and step the sprite tile code forward by one.
  mem8[timerAddr] = 0x02;
  mem8[codeAddr] = mem8[codeAddr] + 1;
  const code = mem8[codeAddr];

  // Only act on the step whose low nibble is all-ones (every sixteenth step).
  if ((code & 0x0f) !== 0x0f) return;

  // Low nibble is all-ones here, so bit 1 is set and the toggle clears it.
  mem8[codeAddr] = code ^ 0x02;
}
