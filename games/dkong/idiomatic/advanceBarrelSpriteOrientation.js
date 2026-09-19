// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelSpriteOrientation — refresh a barrel's two sprite mirror bits from a packed
 * direction lookup, on a per-barrel countdown: one call in four does the work. The barrel's record
 * base arrives in the index register and a direction code in a byte register.
 *
 * LIVE-OUT: memory-only — the barrel record's countdown, sprite code and sprite attribute.
 */

import { u16 } from "../../../core/int.js";
import { OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR } from "./names.js";
import { nextAnimationStep } from "./nextAnimationStep.js";

const OBJ_ORIENT_COUNTDOWN = 0x0f;

export function advanceBarrelSpriteOrientation(m, objBase = m.regs.ix, dirCode = m.regs.c) {
  const { regs, mem8 } = m;

  const counterAddr = u16(objBase + OBJ_ORIENT_COUNTDOWN);
  const counter = mem8[counterAddr];

  // Not the beat: just step the countdown and leave the orientation alone.
  if (counter !== 1) {
    mem8[counterAddr] = counter - 1;
    return;
  }

  // The beat: pack the current orientation (code bit 7 high, attr bit 7 low) as the selector.
  const codeAddr = u16(objBase + OBJ_SPRITE_CODE);
  const attrAddr = u16(objBase + OBJ_SPRITE_ATTR);
  const code = mem8[codeAddr];
  const attr = mem8[attrAddr];
  const selector = (((code >> 7) & 1) << 1) | ((attr >> 7) & 1);

  // next bit 1 -> code's new top bit, next bit 0 -> attr's; each byte's low seven bits preserved.
  const next = nextAnimationStep(0x03 | dirCode, selector).a;
  mem8[attrAddr] = ((next & 1) << 7) | (attr & 0x7f);
  mem8[codeAddr] = (((next >> 1) & 1) << 7) | (code & 0x7f);

  mem8[counterAddr] = 0x04;
}
