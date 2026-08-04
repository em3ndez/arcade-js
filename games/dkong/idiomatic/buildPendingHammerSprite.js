// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildPendingHammerSprite — put an un-taken hammer on screen: size its pickup box, give it its
 * look, remember the tune, and commit its sprite.
 *
 * The routine gates on the pending-hammer flag, of which only the low bit matters. Clear, and it
 * does nothing at all. Set, and it prepares the object record the caller points at and falls
 * through into the shared record write:
 *
 *   - The object's collision half-extents on X and Y are set to fixed values, which is what gives
 *     the hammer the box Mario has to walk into to pick it up.
 *   - Its sprite is a fixed base tile carrying MARIO's current horizontal-facing bit, plus a fixed
 *     attribute byte — so the waiting hammer is drawn facing the same way Mario is.
 *   - The current background tune is copied into a scratch cell, so whatever swaps the tune for the
 *     hammer theme can put the old one back afterwards.
 *
 * The tile code and attribute then go to the shared record write, which lays the 4-byte sprite
 * record down at Mario's position plus the object's displacement and mirrors that position back
 * into the object record. The destination record address and the object base pass straight through
 * from the caller in registers.
 *
 * NOT CLAIMED: what the base tile draws. The hammer role rests on the flag this gates on and on the
 * tune save; the specific artwork was not decoded.
 *
 * LIVE-OUT: memory-only — the object's collision extents, the saved tune, and everything the shared
 * record write lays down.
 */

import { MARIO_HAMMER_PENDING, MARIO_SPRITE_CODE, SND_BGM, HAMMER_SAVED_BGM, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js";

// Sprite fields this arm produces for the record write.
const SPRITE_TILE = 0x1e;  // base tile code; Mario's facing bit is OR'd on top
const FACING_BIT = 0x80;   // Mario's horizontal-facing bit (1 = facing right)
const SPRITE_ATTRIBUTE = 0x07;

export function buildPendingHammerSprite(m) {
  const { regs, mem } = m;
  const objBase = regs.ix; // the object record this arm builds, supplied by the caller

  // Gate on a pending hammer: only the low bit matters. Clear -> nothing to build.
  if ((mem.read8(MARIO_HAMMER_PENDING) & 0x01) === 0) return;

  // Size the hammer's pickup box.
  mem.write8((objBase + OBJ_HIT_EXTENT_X) & 0xffff, 0x06);
  mem.write8((objBase + OBJ_HIT_EXTENT_Y) & 0xffff, 0x03);

  // The sprite faces the same way Mario does: the base tile with Mario's facing bit.
  const facing = mem.read8(MARIO_SPRITE_CODE) & FACING_BIT;
  regs.b = SPRITE_TILE | facing; // the tile code the record write will store
  regs.c = SPRITE_ATTRIBUTE;     // the attribute byte the record write will store

  // Save the current background tune so it can be restored when this episode ends.
  mem.write8(HAMMER_SAVED_BGM, mem.read8(SND_BGM));

  // Commit the sprite record (Mario's position + the object's displacement) and
  // mirror the position back into the object record.
  commitSpriteRecordAtMarioOffset(m);
}
