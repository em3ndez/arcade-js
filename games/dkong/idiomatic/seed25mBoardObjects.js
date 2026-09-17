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

  regs.hl = 0x3dec; // source group
  regs.de = 0x6407; // destination base
  regs.bc = 0x051c; // B = 5 records, C = the stride gap (record size 0x20)
  replicateGroupStrided(m);

  regs.hl = 0x3df4;
  loc_11fa(m);

  blockCopy(mem8, 0x3e00, 0x69fc, 0x04);

  regs.hl = 0x3e0c;
  seedSpriteObjectPair(m);

  regs.hl = 0x101b; // source group
  regs.de = 0x6707; // destination base
  regs.bc = 0x081c; // B = 8 records, C = the stride gap
  replicateGroupStrided(m);

  regs.de = 0x6807; // destination base
  regs.b = 0x02; // 2 records; source and stride unchanged from step 6
  replicateGroupStrided(m);
}
