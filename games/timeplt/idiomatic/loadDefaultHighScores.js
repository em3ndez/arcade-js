import { HIGH_SCORE_TABLE_BASE, loc_4bb1 } from "./names.js";
// SPDX-License-Identifier: GPL-3.0-only
/** loadDefaultHighScores — copy a forty-byte block out of program space into work RAM, byte for byte, nothing
 * skipped and nothing transformed. Both ends and the length are fixed here, so it takes no
 * argument and running it twice changes nothing the first run did not. LIVE-OUT: memory only. */

const BYTES = 40;

export function loadDefaultHighScores(m) {
  const { mem8 } = m;
  for (let i = 0; i < BYTES; i++) mem8[HIGH_SCORE_TABLE_BASE + i] = mem8[loc_4bb1 + i];
}
