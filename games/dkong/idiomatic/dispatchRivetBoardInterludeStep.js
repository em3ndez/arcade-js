// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchRivetBoardInterludeStep — vector the rivet-board interlude to the handler for its
 * current step, read from an inline jump table of little-endian target addresses.
 *
 * LIVE-OUT: memory-only — the dispatched arm's writes.
 */

import { u16 } from "../../../core/int.js";
import { loc_00ca } from "../translated/loc_00ca.js";
import {
  BOARD_ADVANCE_STEP,
  RIVET_INTERLUDE_STEP_TABLE,
} from "./names.js";

const DISPATCH_TABLE_1648 = "0x1648 (0x6388 sequence)";

export function dispatchRivetBoardInterludeStep(m) {
  const { mem8 } = m;

  const step = mem8[BOARD_ADVANCE_STEP];

  // Doubling into the table offset is an 8-bit result: base + (2*step & 0xff), not base + 2*step.
  const entry = u16(RIVET_INTERLUDE_STEP_TABLE + ((step * 2) & 0xff));
  const target = mem8[entry] | (mem8[u16(entry + 1)] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_1648);
}
