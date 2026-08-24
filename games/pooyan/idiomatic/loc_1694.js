// SPDX-License-Identifier: GPL-3.0-only
import { DISPLAY_MSG_BUF, ROUND_INIT_MSG_TABLE } from "./names.js";
import { loc_0010 } from "./loc_0010.js";
import { loc_16b7 } from "./loc_16b7.js";
/**
 * loc_1694 — compare the terminated pattern against the display message buffer.
 *
 * Walks the compare pattern against the message buffer. On the first byte mismatch it
 * tail-branches into the idx1 state handler, reusing the frame. If the whole pattern matches
 * (terminator byte reached) it clears the seven-cell buffer to zero and returns.
 *
 * LIVE-OUT: memory only — no register survives for a caller.
 */

const FIELD_LEN = 0x07; // cells cleared on a full match

export function loc_1694(m) {
  const { mem8 } = m;

  let src = ROUND_INIT_MSG_TABLE;
  let dst = DISPLAY_MSG_BUF;
  for (;;) {
    const a = mem8[src];
    if (a === 0xff) break; // terminator: full match
    if (a !== mem8[dst]) return loc_16b7(m); // mismatch: tail into the state handler
    src++;
    dst++;
  }

  loc_0010(m, DISPLAY_MSG_BUF, 0x00, FIELD_LEN);
}
