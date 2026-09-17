// SPDX-License-Identifier: GPL-3.0-only
/**
 * Commit an object's sprite record at a fixed offset from Mario, mirroring the
 * position back into the object record. The convergence point every hammer/object
 * sprite-build arm tail-jumps to; inputs arrive in registers. Lays down the 4-byte
 * record (X, code, attribute, Y) and updates the object's own X/Y copy.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_X, MARIO_Y, SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_X, OBJ_Y } from "./names.js";

const OBJ_X_DISPLACEMENT = 0x0e;
const OBJ_Y_DISPLACEMENT = 0x0f;

export function commitSpriteRecordAtMarioOffset(m) {
  const { regs, mem8 } = m;

  const recordAddr = regs.de; // destination sprite record (the caller's swapped pointer)
  const objBase = regs.ix;    // the object record this sprite belongs to
  const spriteCode = regs.b;  // tile code byte to store
  const spriteAttr = regs.c;  // attribute byte to store

  const x = mem8[MARIO_X] + mem8[objBase + OBJ_X_DISPLACEMENT];
  mem8[recordAddr + SPRITE_X] = x;
  mem8[objBase + OBJ_X] = x;

  mem8[recordAddr + SPRITE_CODE] = spriteCode;
  mem8[recordAddr + SPRITE_ATTR] = spriteAttr;

  const y = mem8[MARIO_Y] + mem8[objBase + OBJ_Y_DISPLACEMENT];
  mem8[recordAddr + SPRITE_Y] = y;
  mem8[objBase + OBJ_Y] = y;
}
