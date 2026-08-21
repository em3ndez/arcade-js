// SPDX-License-Identifier: GPL-3.0-only
/**
 * foldTargetPresenceBits — rotate-fold the presence bit of the two I-parity enemy-target
 * records into an accumulator.
 *
 * Walks the two records (0x18 stride) and, for each whose byte-0 bit-0 (presence) is set,
 * rotates the accumulator left one place. A pure leaf: reads two bytes, writes nothing.
 *
 * LIVE-OUT: the folded accumulator, returned (A). It is seeded 0 and only ever rotated, so
 * the fold resolves to 0, but the rotate is reproduced faithfully for any seed.
 */
import { ENEMY_TARGET_REC0 } from "./names.js";

const RECORD_STRIDE = 0x18;
const TARGET_COUNT = 2;

export function foldTargetPresenceBits(m) {
  const { mem8 } = m;

  let acc = 0;
  let rec = ENEMY_TARGET_REC0;
  for (let i = 0; i < TARGET_COUNT; i++) {
    if (mem8[rec] & 0x01) acc = ((acc << 1) | (acc >> 7)) & 0xff; // rotate-left on a present target
    rec += RECORD_STRIDE;
  }
  return acc;
}
