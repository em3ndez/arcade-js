// SPDX-License-Identifier: GPL-3.0-only
/** advanceHitSoakingObjectThenAnimateDeath — advance one object that is still soaking up hits. While HITS_REMAINING is left, spend
 * one, keep the record live and re-request the pair of sounds, then hand off to the ordinary move.
 * Once no hits remain, run the record head down toward retirement, and at the values it crosses
 * reseat the sprite entry from the shape table. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { HITS_REMAINING, DEATH_ANIMATION_SHAPE_TABLE } from "./names.js";
import { requestTwoSounds } from "./requestTwoSounds.js";
import { advanceTwoTileObjectThenTryAimedSpawn } from "./advanceTwoTileObjectThenTryAimedSpawn.js";
import { retireObjectAndHold } from "./retireObjectAndHold.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { postCommand } from "./postCommand.js";
import { fetchTableByte } from "./fetchTableByte.js";

export function advanceHitSoakingObjectThenAnimateDeath(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;
  const entry = regs.iy;
  const head = u8(regs.a - 1);

  if (mem8[HITS_REMAINING] !== 0) {
    mem8[HITS_REMAINING] = mem8[HITS_REMAINING] - 1;
    mem8[record] = 0xff;
    requestTwoSounds(m);
    return advanceTwoTileObjectThenTryAimedSpawn(m);
  }

  if (head >= 0x61) {
    mem8[record] = 0x61;
    requestTwoSounds(m);
    mem8[entry + 0x30] = 0x3d;
    mem8[entry + 0x32] = 0x3d;
  }

  mem8[record] = mem8[record] - 1;
  if (mem8[record] === 0) return retireObjectAndHold(m, record, entry);

  driftWithWorldScroll(m);
  mem8[entry + 0x33] = mem8[entry + 0x31] + 0x10;
  mem8[entry + 0x02] = mem8[entry + 0x00];

  const level = mem8[record];
  if (level === 0x40) {
    postCommand(m, 0x04, 0x0b);
    mem8[entry + 0x03] = 0xfa;
    mem8[entry + 0x01] = 0xfb;
    mem8[entry + 0x30] = 0x6c;
    mem8[entry + 0x32] = 0x6c;
    mem8[record] = mem8[record] - 1;
    return;
  }
  if (level < 0x40) return;
  if (((level - 0x40) & 0x07) !== 0) return;

  regs.hl = DEATH_ANIMATION_SHAPE_TABLE;
  regs.a = ((level - 0x40) >> 3) - 1;
  const shape = fetchTableByte(m);
  mem8[entry + 0x03] = shape;
  mem8[entry + 0x01] = shape + 1;
}
