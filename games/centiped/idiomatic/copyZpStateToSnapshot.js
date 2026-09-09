// SPDX-License-Identifier: GPL-3.0-only
import { loc_c1, loc_c2, loc_02, loc_1a, HIGH_SCORE_TABLE, loc_0181 } from "./names.js";
import { foldHighScoreChecksum } from "./foldHighScoreChecksum.js";

/**
 * copyZpStateToSnapshot — refresh the page-1 state-snapshot buffer that the checksum reads.
 *
 * Marks two flag cells 0xff, copies two nine-byte zero-page blocks up into the snapshot buffer
 * (indexed x = 8..0), then tail-calls foldHighScoreChecksum, which XOR-folds the snapshot into a
 * running checksum and returns the old^new delta in A (dead at the sole caller). RAM only. [code]
 */
export function copyZpStateToSnapshot(m) {
  m.mem8[loc_c1] = 0xff;
  m.mem8[loc_c2] = 0xff;
  for (let x = 8; x >= 0; x--) { // copy both nine-byte blocks, high index first
    m.mem8[HIGH_SCORE_TABLE + x] = m.mem8[(loc_02 + x) & 0xff];
    m.mem8[loc_0181 + x] = m.mem8[(loc_1a + x) & 0xff];
  }
  return foldHighScoreChecksum(m); // tail-call: fold the snapshot into the checksum
}
