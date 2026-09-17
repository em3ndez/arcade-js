// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampReleasedBarrelKind — preset a freshly-claimed barrel record's sprite-code, sprite-attr
 * and mode fields with one of two presets, chosen by bit 7 of BARREL_CLAIM_MODE, then fall
 * into the frame-gated renderer tick. The record base arrives in regs.ix.
 *   - bit 7 CLEAR -> rolling kind: sprite code 0x15, attribute 0x0B, mode 0x00.
 *   - bit 7 SET   -> dropping kind: sprite code 0x19, attribute 0x0C, mode 0x01.
 *
 * LIVE-OUT: memory-only.
 */

import { BARREL_CLAIM_MODE, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR } from "./names.js";
import { advanceBarrelRelease } from "./advanceBarrelRelease.js";

export function stampReleasedBarrelKind(m) {
  const { regs, mem8 } = m;

  const obj = regs.ix;

  if ((mem8[BARREL_CLAIM_MODE] & 0x80) === 0) {
    mem8[(obj + OBJ_SPRITE_CODE) & 0xffff] = 0x15;
    mem8[(obj + OBJ_SPRITE_ATTR) & 0xffff] = 0x0b;
    mem8[(obj + 0x15) & 0xffff] = 0x00; // mode field (no shared name)
  } else {
    mem8[(obj + OBJ_SPRITE_CODE) & 0xffff] = 0x19;
    mem8[(obj + OBJ_SPRITE_ATTR) & 0xffff] = 0x0c;
    mem8[(obj + 0x15) & 0xffff] = 0x01; // mode field (no shared name)
  }

  return advanceBarrelRelease(m);
}
