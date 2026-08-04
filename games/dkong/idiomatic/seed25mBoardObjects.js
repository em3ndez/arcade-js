// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed25mBoardObjects — build the 25m board's initial object records and their sprite shadows from
 * fixed templates.
 *
 * The 25m case of the per-board setup dispatch. Its job is to stamp a handful of templates into
 * the work-RAM object records and into the sprite shadow buffer, which the DMA blits to sprite RAM
 * every vblank. It runs after the board-setup head has cleared that whole region, so it is pure
 * INITIALISATION — every byte it touches comes from a fixed template, and none of its inputs come
 * from prior work RAM.
 *
 * Straight-line, seven steps, no branches:
 *
 *   1. Copy a 16-byte sprite-buffer record block.
 *   2. Stamp a 4-byte group into 5 strided object records on the first record page.
 *   3. Scatter a 6-byte template into one object record and a 4-byte array inside the sprite
 *      buffer.
 *   4. Copy a 4-byte sprite-buffer record.
 *   5. Seed an object PAIR from a position table and emit their two sprite records.
 *   6. Stamp a 4-byte group — the data bytes 00 00 02 02 that sit immediately after this routine's
 *      own code — into 8 strided records on the barrel record page.
 *   7. Stamp that SAME group again into 2 records on the next record page, with only the
 *      destination and the record count reloaded. That reuse is the routine's one subtlety: the
 *      group-replicator preserves the source pointer and the stride across a call for exactly this
 *      purpose, so step 7 does not reload them.
 *
 * Each callee reads its inputs out of the register file, so this routine stages the source,
 * destination and count registers before every call. The two inline block copies are plain moves.
 *
 * LIVE-OUT: memory-only. Control returns into the board build, which reads no register this
 * routine leaves behind.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

/** Copy `len` bytes src -> dst, both 16-bit-wrapped. */
function blockCopy(mem, src, dst, len) {
  for (let i = 0; i < len; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((src + i) & 0xffff));
  }
}

export function seed25mBoardObjects(m) {
  const { regs, mem } = m;

  // 1. Copy a 16-byte sprite-buffer record block.
  blockCopy(mem, 0x3ddc, 0x69a8, 0x10);

  // 2. Stamp a 4-byte group into 5 strided records on the first object-record page.
  regs.hl = 0x3dec; // source group
  regs.de = 0x6407; // destination base
  regs.bc = 0x051c; // B = 5 records, C = the stride gap (record size 0x20)
  replicateGroupStrided(m);

  // 3. Scatter a 6-byte template into one object record and a 4-byte array inside the sprite
  //    buffer. The scatter reads its source pointer out of a register.
  regs.hl = 0x3df4;
  loc_11fa(m);

  // 4. Copy a 4-byte sprite-buffer record.
  blockCopy(mem, 0x3e00, 0x69fc, 0x04);

  // 5. Seed the object pair from a position table and emit their two sprite records. The seeder
  //    reads the table pointer out of a register.
  regs.hl = 0x3e0c;
  seedSpriteObjectPair(m);

  // 6. Stamp the 4-byte group that sits immediately after this routine's own code into 8 strided
  //    records on the barrel record page.
  regs.hl = 0x101b; // source group
  regs.de = 0x6707; // destination base
  regs.bc = 0x081c; // B = 8 records, C = the stride gap
  replicateGroupStrided(m);

  // 7. The same group again into 2 records on the next page. Only the destination and the count
  //    are set: the replicator preserves the source pointer and the stride from step 6, so both
  //    carry over — and this routine relies on that.
  regs.de = 0x6807; // destination base
  regs.b = 0x02; // 2 records; source and stride unchanged from step 6
  replicateGroupStrided(m);
}
