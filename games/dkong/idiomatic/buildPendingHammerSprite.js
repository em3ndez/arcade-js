// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildPendingHammerSprite — put an un-taken hammer on screen when the pending-hammer flag's low
 * bit is set: set its collision half-extents, give its sprite Mario's current facing, save the
 * background tune for later restore, then fall through to the shared sprite-record write. Clear
 * flag -> nothing built. The destination record and object base pass through in registers.
 *
 * LIVE-OUT: memory-only — the object's collision extents, the saved tune, and everything the
 * shared record write lays down.
 */

import { u16 } from "../../../core/int.js";
import { MARIO_HAMMER_PENDING, MARIO_SPRITE_CODE, SND_BGM, HAMMER_SAVED_BGM, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js";

const SPRITE_TILE = 0x1e;
const FACING_BIT = 0x80; // Mario's horizontal-facing bit (1 = facing right)
const SPRITE_ATTRIBUTE = 0x07;

export function buildPendingHammerSprite(m, objBase = m.regs.ix, de = m.regs.de) {
  const { mem8 } = m;

  if ((mem8[MARIO_HAMMER_PENDING] & 0x01) === 0) return;

  mem8[u16(objBase + OBJ_HIT_EXTENT_X)] = 0x06;
  mem8[u16(objBase + OBJ_HIT_EXTENT_Y)] = 0x03;

  const facing = mem8[MARIO_SPRITE_CODE] & FACING_BIT;
  const spriteCode = SPRITE_TILE | facing;
  const spriteAttr = SPRITE_ATTRIBUTE;

  mem8[HAMMER_SAVED_BGM] = mem8[SND_BGM];

  commitSpriteRecordAtMarioOffset(m, de, objBase, spriteCode, spriteAttr);
}
