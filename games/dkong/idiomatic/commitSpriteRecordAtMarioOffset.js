// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitSpriteRecordAtMarioOffset — commit an object's on-screen sprite record, positioned at a
 * fixed offset from Mario, and mirror that position back into the object record.
 * ROM 0x2F7C.
 *
 * This is the convergence point of the hammer/object sprite updater: entry_2ed4 and its build
 * arms (buildPendingHammerSprite / loc_2f43 / blinkHammerSpriteOnFramePhase /
 * selectHammerSpriteBlinkByTimer) all tail here to write the finished record. It receives a destination sprite-record address, the
 * object-record base it belongs to, and the tile-code and attribute bytes to store,
 * then lays down the 4-byte record and updates the object's own position copy:
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
 * object mirror uses the object record's own X and Y fields. Reads and writes are
 * kept in the oracle's order (X record + mirror, code, attribute, then Y record +
 * mirror); every cell is disjoint in every real invocation, so the order is exact
 * rather than load-bearing.
 *
 * INPUTS ARRIVE IN REGISTERS. The destination record address, the object base, and
 * the two sprite bytes come in through the register file because every caller is
 * still the translated oracle and tail-calls here that way (`jp 0x2f7c`). This
 * marshalling dissolves into honest parameters once those callers are decompiled;
 * until then it is the genuine oracle boundary the pipeline permits.
 *
 * A LEAF: calls nothing. Its position sum is taken at the store, which truncates,
 * so no explicit byte-width wrap is needed.
 *
 * GROUNDED (DK understanding pass 4, independent confirmer): the shared convergence write for
 * entry_2ed4's arms; reads named MARIO_X/Y, SPRITE_X/CODE/ATTR/Y and OBJ_X/Y. Mechanism-descriptive
 * — deliberately the generic record-writer, correctly NOT named "hammer".
 *
 * Memory-equivalent to the frozen oracle — equivalence-2f7c.test.js.
 * GATE:     captured + crafted. 0x2F7C is tail-called every serviced attract frame
 *           (314 real dispatches / 2000 frames), so captured dispatches cover the
 *           live object-2 path; crafted entries then pin BOTH object records
 *           (0x6680/0x6690 with their 0x6A18/0x6A1C records), both displacement
 *           signs, the 8-bit position wrap, and distinct code/attribute bytes —
 *           identical registers + cells on both sides. Full RAM dump compared (the
 *           routine writes no stack, so no exclusion). Teeth: a dropped object
 *           mirror, a swapped code/attribute pair, and a dropped Y displacement.
 * LIVE-OUT: memory-only. Every caller tail-calls this record write and discards its
 *           result; the oracle's residual registers/flags and its terminal return
 *           reach no consumer. The register live-ins are inputs, not outputs.
 * NAMES:    MARIO_X (0x6203), MARIO_Y (0x6205), the sprite-record field offsets
 *           SPRITE_X/SPRITE_CODE/SPRITE_ATTR/SPRITE_Y, and the object-record field
 *           offsets OBJ_X/OBJ_Y — all from ram.js. The two per-object displacement
 *           fields at object offsets +0x0E/+0x0F have no ram.js name yet and stay
 *           local hex consts here.
 */

import { MARIO_X, MARIO_Y, SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_X, OBJ_Y } from "./ram.js";

// Object-record field offsets not yet named in ram.js: the per-object horizontal
// and vertical displacements added to Mario's position to place this sprite.
const OBJ_X_DISPLACEMENT = 0x0e;
const OBJ_Y_DISPLACEMENT = 0x0f;

export function commitSpriteRecordAtMarioOffset(m) {
  const { regs, mem } = m;

  // Inputs supplied by the (still-oracle) caller through the register file.
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
