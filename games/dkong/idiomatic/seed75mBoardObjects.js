// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed75mBoardObjects — lay down the 75m board's object records and their hardware sprite mirror
 * from fixed templates.
 *
 * This is the setup the elevator board starts from. It takes NO inputs: every source pointer,
 * count and constant is a fixed immediate, so it always writes the same 75m object and sprite
 * state. It seeds three object-record arrays in work RAM — the fires, the actors, and the board's
 * own six-record array — builds their hardware sprite records inside the sprite buffer, and copies
 * two fixed templates in. All of its work is memory writes; nothing it computes is read back.
 *
 * The ten steps, over four shared setup helpers plus in-line fills and block copies:
 *
 *   1. Broadcast a 4-byte template group into the +7 field of 5 records of the fire array
 *      (stride 0x20).
 *   2. Seed the actor array's shared sprite field from a fixed template and build its 10 sprite
 *      records in the sprite buffer.
 *   3. Fill the +0 active flag of 6 records of the board array (stride 0x10) with 1.
 *   4. Fill the state field of the first 3 of those records with 8, the spawn state. Repeating
 *      this fill over the same three cells would change nothing, so it is written once.
 *   5. Scatter 6 byte-pairs from a contiguous table into the +3 and +5 fields (the X and Y pair)
 *      of those 6 records.
 *   6. Broadcast a 4-byte template group into the +7 field of the same 6 records.
 *   7. Build 6 hardware sprite records in the sprite buffer by gathering each board record's
 *      +3/+7/+8/+5 into a sprite's X / code / attribute / Y.
 *   8. Copy a fixed 12-byte sprite template into the object-collision sprite slot.
 *   9. Seed the board's TWO FIRES: write the fire array's two lead records field-by-field —
 *      +0 active, the X pair at +3/+0E, the Y pair at +5/+0F, both to fixed start coordinates.
 *  10. Copy a 16-byte data table, which sits immediately after this routine's own code, into an
 *      unnamed sprite-buffer slot.
 *
 * NOT CLAIMED: what the actor array and the board array draw as on this board. They are seeded
 * here by structure — the same record layout the shared gather and seed helpers consume — and
 * nothing in this file identifies the objects.
 *
 * LIVE-OUT: memory-only — the three object-record arrays and the sprite records and template
 * copies they produce inside the sprite buffer.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { OBJ_ARRAY_64, OBJ_ARRAY_66, OBJECT_COLLISION_SPRITES, OBJ_STATE } from "./names.js";

/** Forward block-copy of `count` bytes from `src` to `dst`. */
function blockCopy(mem, dst, src, count) {
  for (let i = 0; i < count; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((src + i) & 0xffff));
  }
}

export function seed75mBoardObjects(m) {
  const { regs, mem } = m;

  // 1. Seed field +7 of the fire array's 5 records from a fixed 4-byte template group.
  regs.hl = 0x3dec; // 4-byte source group, re-read for every record — a broadcast
  regs.de = OBJ_ARRAY_64 + 0x07; // dest: +7 of the first fire record
  regs.bc = 0x051c; // 5 records, record stride 0x20
  replicateGroupStrided(m);

  // 2. Seed the actor array's sprite field and build its 10 sprite records in the sprite buffer.
  //    All fixed immediates — this step takes no inputs of its own.
  seedObjectBlockSprites(m);

  // 3. Mark 6 records of the board array active (stride 0x10).
  for (let i = 0; i < 6; i++) mem.write8((OBJ_ARRAY_66 + i * 0x10) & 0xffff, 0x01);

  // 4. Put the first 3 of those records into the spawn state. Repeating this fill over the same
  //    three cells would change nothing, so it is written once.
  for (let i = 0; i < 3; i++) mem.write8((OBJ_ARRAY_66 + OBJ_STATE + i * 0x10) & 0xffff, 0x08);

  // 5. Scatter 6 byte-pairs from a contiguous table into the board records' +3/+5 (X and Y).
  regs.hl = 0x3e64; // contiguous source, 12 bytes
  regs.de = OBJ_ARRAY_66 + 0x03; // dest base — each pair lands at +0 and +2 from here
  regs.bc = 0x060e; // 6 pairs, record stride 0x10
  copyBytePairsStrided(m);

  // 6. Broadcast a fixed 4-byte template group into +7 of the same 6 board records.
  regs.hl = 0x3e60;
  regs.de = OBJ_ARRAY_66 + 0x07;
  regs.bc = 0x060c; // 6 records, record stride 0x10
  replicateGroupStrided(m);

  // 7. Build 6 hardware sprite records from the board array, gathering each record's
  //    +3/+7/+8/+5 into the sprite's X / code / attribute / Y.
  regs.ix = OBJ_ARRAY_66; // object-record base
  regs.hl = 0x6958; // dest — an unnamed slot in the sprite buffer
  regs.b = 0x06; // record count
  regs.de = 0x0010; // per-record source stride
  gatherSpriteRecords(m);

  // 8. Copy the fixed 12-byte sprite template into the object-collision sprite slot.
  blockCopy(mem, OBJECT_COLLISION_SPRITES, 0x3e48, 0x0c);

  // 9. Seed the two fires: write the fire array's two lead records field-by-field (stride 0x20).
  //    +0 = active; +3/+0E = the X pair; +5/+0F = the Y pair.
  const IX = OBJ_ARRAY_64;
  mem.write8((IX + 0x00) & 0xffff, 0x01);
  mem.write8((IX + 0x03) & 0xffff, 0x58);
  mem.write8((IX + 0x0e) & 0xffff, 0x58);
  mem.write8((IX + 0x05) & 0xffff, 0x80);
  mem.write8((IX + 0x0f) & 0xffff, 0x80);
  mem.write8((IX + 0x20) & 0xffff, 0x01);
  mem.write8((IX + 0x23) & 0xffff, 0xeb);
  mem.write8((IX + 0x2e) & 0xffff, 0xeb);
  mem.write8((IX + 0x25) & 0xffff, 0x60);
  mem.write8((IX + 0x2f) & 0xffff, 0x60);

  // 10. Copy the 16-byte data table that sits right after this code into the sprite buffer.
  blockCopy(mem, 0x6970, 0x1121, 0x10);
}
