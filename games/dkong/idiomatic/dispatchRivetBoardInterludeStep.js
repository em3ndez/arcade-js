// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchRivetBoardInterludeStep — vector the rivet-board interlude to the handler for its
 * current step, read from an inline jump table of little-endian target addresses.
 *
 * LIVE-OUT: memory-only — the dispatched arm's writes.
 */

import { loc_00ca } from "../translated/loc_00ca.js";
import { BOARD_ADVANCE_STEP } from "./names.js";

const STEP_TABLE = 0x1648;
const DISPATCH_TABLE_1648 = "0x1648 (0x6388 sequence)";

export function dispatchRivetBoardInterludeStep(m) {
  const { mem8 } = m;

  const step = mem8[BOARD_ADVANCE_STEP];

  // Doubling into the table offset is an 8-bit result: base + (2*step & 0xff), not base + 2*step.
  const entry = (STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem8[entry] | (mem8[(entry + 1) & 0xffff] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_1648);
}
