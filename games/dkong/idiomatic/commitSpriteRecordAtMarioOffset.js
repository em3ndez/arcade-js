// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitSpriteRecordAtMarioOffset — commit an object's on-screen sprite record,
 * positioned at a fixed offset from Mario, and mirror that position back into the
 * object record.
 *
 * This is the convergence point of the hammer/object sprite updater: every build arm
 * tails here to write the finished record. It receives a destination sprite-record
 * address, the object-record base it belongs to, and the tile-code and attribute bytes
 * to store, then lays down the 4-byte record and updates the object's own position
 * copy:
 *
 *   - X = Mario's X plus the object's X-displacement field. Stored into the sprite
 *     record's X byte and mirrored into the object record's X field, so the sprite
 *     tracks Mario at a constant horizontal offset.
 *   - the caller's tile code into the record's code byte and the caller's attribute
 *     into the record's attribute byte.
 *   - Y = Mario's Y plus the object's Y-displacement field. Stored into the sprite
 *     record's Y byte and mirrored into the object record's Y field.
 *
 * The record layout is the shared sprite-record shape (X, code, attribute, Y); the
 * object mirror uses the object record's own X and Y fields. The writes stay in the
 * order given above; every cell is disjoint in every real invocation, so the order is
 * exact rather than load-bearing.
 *
 * INPUTS ARRIVE IN REGISTERS. The destination record address, the object base, and the
 * two sprite bytes come in through the register file because every caller tail-jumps
 * here rather than calling with arguments.
 *
 * NOT NAMED FOR THE HAMMER, deliberately: this is the generic record writer that the
 * hammer arms happen to be the current callers of. Nothing it does is hammer-specific.
 *
 * A LEAF: calls nothing. Its position sum is taken at the store, which truncates, so
 * no explicit byte-width wrap is needed.
 *
 * LIVE-OUT: memory-only. Every caller tail-calls this record write and discards its
 * result; the register live-ins are inputs, not outputs.
 */

import { MARIO_X, MARIO_Y, SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_X, OBJ_Y } from "./names.js";

// The per-object horizontal and vertical displacements added to Mario's position to
// place this sprite.
const OBJ_X_DISPLACEMENT = 0x0e;
const OBJ_Y_DISPLACEMENT = 0x0f;

export function commitSpriteRecordAtMarioOffset(m) {
  const { regs, mem } = m;

  // Inputs supplied by the caller through the register file.
  const recordAddr = regs.de; // destination sprite record (the caller's swapped pointer)
  const objBase = regs.ix;    // the object record this sprite belongs to
  const spriteCode = regs.b;  // tile code byte to store
  const spriteAttr = regs.c;  // attribute byte to store

  // X = Mario's X plus the object's horizontal displacement; into the record's X
  // byte and mirrored into the object record.
  const x = mem.read8(MARIO_X) + mem.read8((objBase + OBJ_X_DISPLACEMENT) & 0xffff);
  mem.write8((recordAddr + SPRITE_X) & 0xffff, x);
  mem.write8((objBase + OBJ_X) & 0xffff, x);

  // The caller's tile code and attribute bytes.
  mem.write8((recordAddr + SPRITE_CODE) & 0xffff, spriteCode);
  mem.write8((recordAddr + SPRITE_ATTR) & 0xffff, spriteAttr);

  // Y = Mario's Y plus the object's vertical displacement; into the record's Y byte
  // and mirrored into the object record.
  const y = mem.read8(MARIO_Y) + mem.read8((objBase + OBJ_Y_DISPLACEMENT) & 0xffff);
  mem.write8((recordAddr + SPRITE_Y) & 0xffff, y);
  mem.write8((objBase + OBJ_Y) & 0xffff, y);
}
