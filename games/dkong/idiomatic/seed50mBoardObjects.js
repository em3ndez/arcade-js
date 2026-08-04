// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed50mBoardObjects — build the 50m board's object + hardware-sprite records.
 *
 * The board-2 (50m) arm of the board-object setup dispatch: the dispatcher reads BOARD
 * and, for BOARD == 2, tail-jumps here. A one-shot initialiser with NO inputs of its
 * own: every pointer, count and stride below is a fixed immediate, so it always seeds
 * the same board. It is straight-line — no branches — a sequence of calls to five setup
 * helpers plus four block copies of fixed tables, closing by setting the board-object
 * bookkeeping marker to 1 ("this board is set up"). It reads back the object records the
 * earlier steps seed (the gathers at steps 2 and 4 permute the +3/+5 X/Y fields out of
 * the object blocks), so those record contents are an implicit input.
 *
 * The steps, in order. Each helper takes its inputs in the register file, so the
 * registers are set immediately before each call:
 *
 *   1. Stamp a 4-byte group into 5 records at OBJ_ARRAY_64+7, record stride 0x20.
 *   2. Seed a 10-record object block's shared sprite field from a template, then gather
 *      its 10 hardware sprite records into the actor-sprite area.
 *   3. Stamp a 4-byte group into 6 records at OBJ_ARRAY_65A0+7, record stride 0x10.
 *   4. Gather 6 sprite records (fields +3/+7/+8/+5) from OBJ_ARRAY_65A0 (stride 0x10)
 *      into the sprite shadow buffer. The stride byte carries over from step 3; the
 *      gather ignores it, and only the record count is reloaded.
 *   5. Scatter a 6-byte record into a field record and into a 4-byte array inside the
 *      sprite shadow buffer.
 *   6-8. Three block copies of fixed tables into the sprite shadow buffer: 4, 8 and 24
 *      bytes.
 *   9. Seed an object pair from a fixed position table and emit their two sprite records.
 *   10. Copy the last fixed table into the collision-sprite records, then set the marker.
 *
 * The four block copies are plain forward byte copies, both pointers advancing with
 * 16-bit wrap. What the individual object records ARE is not claimed — only the
 * MECHANISM is established (seed records, permute them into sprite mirrors) — so the
 * name asserts the confident part: this seeds the 50m board's objects.
 *
 * LIVE-OUT: memory-only — the object and hardware-sprite records this arm writes, plus
 * the board-object bookkeeping marker.
 */

import { OBJ_ARRAY_64, OBJ_ARRAY_65A0, OBJECT_COLLISION_SPRITES } from "./names.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedObjectBlockSprites } from "./seedObjectBlockSprites.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

/** Forward byte-for-byte block copy; both pointers advance with 16-bit wrap. */
function copyBlock(mem, src, dst, n) {
  for (let i = 0; i < n; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((src + i) & 0xffff));
  }
}

export function seed50mBoardObjects(m) {
  const { regs, mem } = m;

  // 1. Stamp a 4-byte group into 5 records at OBJ_ARRAY_64+7, record stride 0x20.
  regs.hl = 0x3dec;
  regs.de = OBJ_ARRAY_64 + 0x07; // field +7 of the first of 5 stride-0x20 records
  regs.bc = 0x051c; // 5 records; stride byte 0x1c (record stride = this + 4)
  replicateGroupStrided(m);

  // 2. Seed the 10-record object block and build its 10 sprite records (it sets its own registers).
  seedObjectBlockSprites(m);

  // 3. Stamp a 4-byte group into 6 records at OBJ_ARRAY_65A0+7, record stride 0x10.
  regs.hl = 0x3e18;
  regs.de = OBJ_ARRAY_65A0 + 0x07; // field +7 of the first of 6 stride-0x10 records
  regs.bc = 0x060c; // 6 records; stride byte 0x0c (record stride = this + 4)
  replicateGroupStrided(m);

  // 4. Gather 6 sprite records from OBJ_ARRAY_65A0 (stride 0x10) into the sprite shadow
  //    buffer. Only the record count is reloaded; the stride byte survives step 3, and
  //    the gather ignores it.
  regs.ix = OBJ_ARRAY_65A0;
  regs.hl = 0x69b8;
  regs.de = 0x0010;
  regs.b = 0x06;
  gatherSpriteRecords(m);

  // 5. Scatter a 6-byte record into the field record and the 4-byte sprite-buffer array.
  regs.hl = 0x3dfa;
  loc_11fa(m);

  // 6-8. Copy three fixed tables into the sprite shadow buffer.
  copyBlock(mem, 0x3e04, 0x69fc, 0x0004);
  copyBlock(mem, 0x3e1c, 0x6944, 0x0008);
  copyBlock(mem, 0x3e24, 0x69e4, 0x0018);

  // 9. Seed the object pair from a fixed position table and emit their two sprite records.
  regs.hl = 0x3e10;
  seedSpriteObjectPair(m);

  // 10. Copy the last fixed table into the collision-sprite records, then mark the board set up.
  copyBlock(mem, 0x3e3c, OBJECT_COLLISION_SPRITES, 0x000c); // 3 collision records (stride 4)
  mem.write8(0x62b9, 0x01); // board-object bookkeeping: this board is set up
}
