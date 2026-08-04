// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed100mBoardObjects — build the 100m rivet board's object records and their hardware sprite
 * mirror from fixed templates.
 *
 * The board-4 arm of the per-board setup dispatch. Like its three sibling arms it takes NO
 * inputs: every pointer, count and stride below is a fixed constant baked into this board's
 * setup, so it always lays down the same 100m object and sprite state, reading only template
 * data and never pre-existing work RAM. All of its work is memory writes; nothing it computes
 * is read back.
 *
 * Six steps, over the shared setup helpers plus one block copy and two activation marks:
 *
 *   1. Broadcast a four-byte template group into five object records, at a 32-byte record
 *      stride.
 *   2. Seed a sprite-object pair from a fixed position table, and emit their two sprite
 *      records.
 *   3. Block-copy a twelve-byte table into OBJECT_COLLISION_SPRITES — the three collision
 *      sprite records.
 *   4. Scatter a position table into the +3 and +5 fields — X and Y — of two further object
 *      records, at the same 32-byte stride.
 *   5. Broadcast a four-byte group into the +7..+10 fields of those SAME two records: their
 *      shared appearance fields, +7 the sprite code and +8 the attributes.
 *   6. Mark both records active, then gather each one's permuted (+3, +7, +8, +5) fields into
 *      a four-byte hardware sprite record — X from +3, code from +7, attributes from +8, Y
 *      from +5.
 *
 * The two records step 6 activates are FIRES. They are what the 100m collision arm sweeps in
 * addition to the five records step 1 seeds, which is why that arm covers seven records and
 * not five.
 *
 * NOT CLAIMED: per-record identity within the object array, and what the pair seeded in step 2
 * is. Neither is established here.
 *
 * The helpers take their arguments through the machine's register image, so each one's inputs
 * are staged there immediately before its call.
 *
 * LIVE-OUT: memory-only — the seeded object records, the copied collision-sprite bytes and the
 * two hardware sprite records. This routine returns into a call that reloads every register,
 * so nothing it leaves in the register file is read.
 */

import { OBJECT_COLLISION_SPRITES } from "./names.js";
import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";
import { copyBytePairsStrided } from "./copyBytePairsStrided.js";
import { gatherSpriteRecords } from "./gatherSpriteRecords.js";

const LDIR_BYTES = 0x0c; // step 3: twelve bytes into the collision-sprite records

export function seed100mBoardObjects(m) {
  const { regs, mem } = m;

  // Step 1 — broadcast a four-byte template group into five object records (stride 32).
  regs.hl = 0x3df0; // source group, re-read every pass
  regs.de = 0x6407; // destination record base
  regs.bc = 0x051c; // five records; the stride argument is four short of the record stride
  replicateGroupStrided(m);

  // Step 2 — seed a sprite-object pair from a fixed position table. The pair seeder takes
  // only the table address; it sets up everything else itself.
  regs.hl = 0x3e14;
  seedSpriteObjectPair(m);

  // Step 3 — copy a twelve-byte table into OBJECT_COLLISION_SPRITES, the three collision
  // sprite records: a plain forward block copy. Its end pointers are dead — step 4 reloads
  // all of them — so they are not reproduced.
  let src = 0x3e54;
  let dst = OBJECT_COLLISION_SPRITES;
  for (let i = 0; i < LDIR_BYTES; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }

  // Step 4 — scatter a position table into offsets +3/+5 of two further object records
  // (net record stride 32): the objects' X (+3) and Y (+5) position fields.
  regs.hl = 0x1182; // the position table, laid down just after the routine body
  regs.de = 0x64a3; // destination: the first record's +3
  regs.bc = 0x021e; // two records
  copyBytePairsStrided(m);

  // Step 5 — broadcast a four-byte group into offsets +7..+10 of the SAME two records:
  // their shared appearance fields, +7 the sprite code and +8 the attributes.
  regs.hl = 0x117e; // the appearance group
  regs.de = 0x64a7; // destination: the first record's +7
  regs.bc = 0x021c; // two records
  replicateGroupStrided(m);

  // Step 6 — mark both records active (offset +0 = 1), then gather each record's permuted
  // (+3,+7,+8,+5) fields into a four-byte hardware sprite record.
  regs.ix = 0x64a0;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  mem.write8((regs.ix + 0x20) & 0xffff, 0x01); // the second record, one stride on
  regs.hl = 0x6950; // sprite-record destination
  regs.b = 0x02; // two records
  regs.de = 0x0020; // per-record source stride
  gatherSpriteRecords(m);
}
