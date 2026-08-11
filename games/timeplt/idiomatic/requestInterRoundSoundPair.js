// SPDX-License-Identifier: GPL-3.0-only
/** requestInterRoundSoundPair — request two particular sounds in turn, and only while the cabinet may make them.
 * Neither code is an immediate: each is fetched from a byte of the program image, and choosing
 * that pair is the whole of this entry — whatever a caller held is discarded. Both go through the
 * same permission test, so both can be refused together. LIVE-OUT: memory. */

import { loc_5617 } from "./loc_5617.js";

const FIRST_CODE_CELL = 0x27cb;
const SECOND_CODE_CELL = 0x33a0;

export function requestInterRoundSoundPair(m) {
  const { mem8 } = m;
  loc_5617(m, mem8[FIRST_CODE_CELL]);
  loc_5617(m, mem8[SECOND_CODE_CELL]);
}
