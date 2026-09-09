// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { HIGH_SCORE_TABLE, HIGH_SCORE_CHECKSUM } from "./names.js";

/**
 * foldHighScoreChecksum -- XOR-fold the high-score table into a one-byte checksum,
 * publish it, and return whether it changed since the last fold.
 *
 * Seed 0xff, XOR the 61 table bytes into an accumulator, read the previously stored
 * checksum, overwrite it with the fresh fold, and return (old ^ new) -- the delta,
 * zero exactly when the table folds to the same value as last time.
 *
 * Live-out rides the return: A = the old^new delta (with N/Z set for the caller's
 * branch) and Y = the OLD checksum byte.
 */
export function foldHighScoreChecksum(m) {
  const { mem8 } = m;
  let acc = 0xff;
  for (let i = 0x3c; i >= 0; i--) {
    acc = u8(acc ^ mem8[HIGH_SCORE_TABLE + i]);
  }
  const oldChecksum = mem8[HIGH_SCORE_CHECKSUM];
  mem8[HIGH_SCORE_CHECKSUM] = acc;                       // publish the fresh fold
  const delta = u8(oldChecksum ^ acc);
  return [(m.regs.a = delta), (m.regs.y = oldChecksum), (m.regs.fZ = delta === 0), (m.regs.fN = (delta & 0x80) !== 0)];
}
