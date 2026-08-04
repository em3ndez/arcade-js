// SPDX-License-Identifier: GPL-3.0-only
/**
 * buildPendingHammerSprite — one build arm of the hammer/object sprite updater: when a hammer is
 * pending, stamp the object's state and appearance, then commit its sprite record.
 * ROM 0x2F97.
 *
 * Reached from entry_2ed4 as a tail branch. It first gates on MARIO_HAMMER_PENDING:
 * only its low bit matters, and if that bit is clear the arm does nothing and
 * returns. When the bit is set it prepares the object pointed at by the caller and
 * falls through into the shared record write commitSpriteRecordAtMarioOffset:
 *
 *   - Two object-record state bytes (offsets +0x09 / +0x0A) are set to fixed values.
 *   - The object's sprite tile code is a fixed base tile carrying Mario's current
 *     horizontal-facing bit, so the sprite faces the same way Mario does, with a
 *     fixed attribute byte.
 *   - The current background-tune index (SND_BGM) is saved into a scratch cell, so a
 *     later step can restore the tune once this object's episode ends.
 *
 * The tile code and attribute are then handed to commitSpriteRecordAtMarioOffset, which lays down
 * the 4-byte sprite record at Mario's position plus the object's displacement and
 * mirrors that position back into the object record. The destination record address
 * and object base pass straight through from the caller.
 *
 * A build arm: touches a few player/object/sound cells, then tail-calls the shared
 * record write. Nothing consumes a return value.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): gates on MARIO_HAMMER_PENDING (named
 * 0x6218) — the not-active/pending arm of entry_2ed4, which dispatches on MARIO_HAMMER_ACTIVE; and
 * it saves SND_BGM, matching the documented hammer BGM swap/restore lifecycle. The hammer role is
 * grounded; the tile-0x1E sprite identity is inferential.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f97.test.js.
 * GATE:     captured + crafted. 0x2F97 is dispatched every attract run (966 real
 *           dispatches / 2500 frames), covering BOTH arms — the bit-clear early
 *           return (938) and the pending-hammer build (28) — with both facing bits;
 *           crafted entries then pin both facings explicitly, both object records,
 *           the SND_BGM save, and the 8-bit position wraps in the commitSpriteRecordAtMarioOffset tail.
 *           Full RAM dump compared with NO exclusion: the oracle's returns/tail only
 *           pop the stack, they never write it. Teeth: a wrong state byte, a dropped
 *           facing bit, and an inverted pending gate.
 * LIVE-OUT: memory-only. Every caller tail-calls this and discards the result; the
 *           tile-code / attribute it computes are consumed by commitSpriteRecordAtMarioOffset, not a caller,
 *           and the oracle's residual registers/flags and its returns reach no one.
 * NAMES:    MARIO_HAMMER_PENDING (0x6218), MARIO_SPRITE_CODE (0x6207), SND_BGM
 *           (0x6089), HAMMER_SAVED_BGM (0x6389 — the saved-tune scratch) — from names.js.
 *           The two object-record state offsets +0x09/+0x0A have no names.js name yet and
 *           stay local hex here. commitSpriteRecordAtMarioOffset is direct-called with the tile code and
 *           attribute marshalled into the register slots it reads (the record
 *           destination and object base pass through from the caller).
 */

import { MARIO_HAMMER_PENDING, MARIO_SPRITE_CODE, SND_BGM, HAMMER_SAVED_BGM, OBJ_HIT_EXTENT_X, OBJ_HIT_EXTENT_Y } from "./names.js";
import { commitSpriteRecordAtMarioOffset } from "./commitSpriteRecordAtMarioOffset.js"; // ROM 0x2F7C — the shared object-sprite record write

// Object-record field offsets with no names.js name yet: two per-object state bytes
// this arm stamps to fixed values before the record write.

// Sprite fields this arm produces for the record write.
const SPRITE_TILE = 0x1e;  // base tile code; Mario's facing bit is OR'd on top
const FACING_BIT = 0x80;   // horizontal-flip bit of MARIO_SPRITE_CODE (1 = facing right)
const SPRITE_ATTRIBUTE = 0x07;

export function buildPendingHammerSprite(m) {
  const { regs, mem } = m;
  const objBase = regs.ix; // the object record this arm builds (from the caller)

  // Gate on a pending hammer: only the low bit matters. Clear -> nothing to build.
  if ((mem.read8(MARIO_HAMMER_PENDING) & 0x01) === 0) return;

  // Stamp the object's two state bytes to their fixed values.
  mem.write8((objBase + OBJ_HIT_EXTENT_X) & 0xffff, 0x06);
  mem.write8((objBase + OBJ_HIT_EXTENT_Y) & 0xffff, 0x03);

  // The sprite faces the same way Mario does: the base tile with Mario's facing bit.
  const facing = mem.read8(MARIO_SPRITE_CODE) & FACING_BIT;
  regs.b = SPRITE_TILE | facing; // tile code commitSpriteRecordAtMarioOffset will store
  regs.c = SPRITE_ATTRIBUTE;     // attribute byte commitSpriteRecordAtMarioOffset will store

  // Save the current background tune so it can be restored when this episode ends.
  mem.write8(HAMMER_SAVED_BGM, mem.read8(SND_BGM));

  // Commit the sprite record (Mario's position + the object's displacement) and
  // mirror the position back into the object record.
  commitSpriteRecordAtMarioOffset(m);
}
