// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed25mBoardObjects — stamp the 25m board's initial object records and sprite shadows from fixed
 * templates. Straight-line initialisation of block copies and strided group replications; each
 * callee reads its source/dest/count from the register file staged before the call.
 *
 * LIVE-OUT: memory-only.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js";
import { loc_11fa } from "./loc_11fa.js";
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js";

function blockCopy(mem8, src, dst, len) {
  for (let i = 0; i < len; i++) {
    mem8[(dst + i) & 0xffff] = mem8[(src + i) & 0xffff];
  }
}

export function seed25mBoardObjects(m) {
  const { regs, mem8 } = m;

  blockCopy(mem8, 0x3ddc, 0x69a8, 0x10);

  // first group: 5 records, stride 0x1c
  replicateGroupStrided(m, 0x3dec, 0x1c, 0x6400, 0x05, 0x07);

  loc_11fa(m, 0x3df4);

  blockCopy(mem8, 0x3e00, 0x69fc, 0x04);

  regs.hl = 0x3e0c; // seedSpriteObjectPair reads its position-table pointer from hl
  seedSpriteObjectPair(m);

  // second group: 8 records, stride 0x1c
  replicateGroupStrided(m, 0x101b, 0x1c, 0x6700, 0x08, 0x07);

  // same src/stride, next dest page; 2 records
  replicateGroupStrided(m, 0x101b, 0x1c, 0x6800, 0x02, 0x07);
}
