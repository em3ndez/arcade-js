// SPDX-License-Identifier: GPL-3.0-only
import { loc_c1, loc_c2, loc_02, loc_1a, HIGH_SCORE_TABLE, loc_0181 } from "./names.js";
import { foldHighScoreChecksum } from "./foldHighScoreChecksum.js";

/**
 * copyZpStateToSnapshot -- refresh the page-1 state-snapshot buffer that the
 * high-score checksum reads, then fold the checksum.
 *
 * ROLE IN THE MACHINE. Centipede protects its high-score / state data with a running
 * checksum. The checksum is computed over a SNAPSHOT buffer in page 1, not directly
 * over the live zero-page cells, so those cells must first be copied up into the
 * snapshot before each fold. This routine does that copy and then tail-calls the
 * fold. RAM only -- no hardware, no branches beyond the copy loop.
 *
 * WHAT IT COPIES. It first marks two flag cells ($c1/$c2) with 0xff, then copies two
 * nine-byte zero-page blocks up into the snapshot buffer: $02..$0a into the
 * HIGH_SCORE_TABLE mirror ($0178+x) and $1a..$22 into $0181+x. The loop runs the
 * index x from 8 down to 0 (high index first), matching the ROM's descending copy.
 * The source reads are masked to a byte ($ff) so the zero-page address never carries.
 *
 * THE TAIL CALL. foldHighScoreChecksum XOR-folds the freshened snapshot into the
 * running checksum and returns the old^new delta in A. That delta is DEAD at the
 * sole caller (the value is thrown away); the tail-call form is kept so the return
 * threads through exactly as the ROM's did.
 *
 * GROUNDING: [code]. LIVE-OUT: $c1,$c2, the two snapshot blocks ($0178+x, $0181+x),
 * plus whatever foldHighScoreChecksum updates. Returns foldHighScoreChecksum(m).
 */
export function copyZpStateToSnapshot(m) {
  // Mark the two snapshot flag cells so the checksum sees a "populated" buffer.
  m.mem8[loc_c1] = 0xff;
  m.mem8[loc_c2] = 0xff;
  // Copy both nine-byte zero-page blocks up into the page-1 snapshot, high index
  // first (x = 8..0). Source addresses are byte-masked so they never leave zero page.
  for (let x = 8; x >= 0; x--) { // copy both nine-byte blocks, high index first
    m.mem8[HIGH_SCORE_TABLE + x] = m.mem8[(loc_02 + x) & 0xff];
    m.mem8[loc_0181 + x] = m.mem8[(loc_1a + x) & 0xff];
  }
  // Tail-call the fold: XOR the fresh snapshot into the running checksum. The
  // returned old^new delta is dead at the caller; the tail form preserves the ROM flow.
  return foldHighScoreChecksum(m); // tail-call: fold the snapshot into the checksum
}
