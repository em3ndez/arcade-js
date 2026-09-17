// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanObjectsAtMarioX — broad phase of the per-frame object-collision check: walk the three
 * contiguous 4-byte collision-object records and, on the first whose X equals Mario's exactly,
 * hand it to the narrow phase and stop. No match touches nothing.
 *
 * LIVE-OUT: memory-only — on a match, whatever the narrow phase writes.
 */
import { MARIO_X, OBJECT_COLLISION_SPRITES } from "./names.js";
import { confirmObjectHit } from "./confirmObjectHit.js";

const RECORD_COUNT = 3;
const RECORD_STRIDE = 4;

export function scanObjectsAtMarioX(m) {
  const { regs, mem8 } = m;
  const marioX = mem8[MARIO_X];

  for (let i = 0; i < RECORD_COUNT; i++) {
    const record = OBJECT_COLLISION_SPRITES + i * RECORD_STRIDE;
    if (marioX === mem8[record]) {
      regs.hl = record;
      confirmObjectHit(m);
      return;
    }
  }
}
