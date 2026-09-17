// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2766 — raise the one-shot MARIO_START_FALL trigger and clear EDGE_REPOSITION_FLAG so the
 * just-finished reposition is not worked a second time.
 *
 * LIVE-OUT: memory-only — MARIO_START_FALL and EDGE_REPOSITION_FLAG.
 */
import { EDGE_REPOSITION_FLAG, MARIO_START_FALL } from "./names.js";

export function loc_2766(m) {
  const { mem8 } = m;
  mem8[EDGE_REPOSITION_FLAG] = 0;
  mem8[MARIO_START_FALL] = 1;
}
