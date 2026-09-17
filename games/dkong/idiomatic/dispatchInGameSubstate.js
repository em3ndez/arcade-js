// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInGameSubstate — vector the credited game to its current sub-state handler, read from a
 * 29-entry jump table of little-endian target addresses. Null/out-of-range slots surface as a
 * loud unimplemented-target throw in the shared helper rather than a silent reset.
 *
 * LIVE-OUT: memory-only — the sub-state handler's own writes.
 */

import { GAME_SUBSTATE } from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

const SUBSTATE_TABLE = 0x0702;
const DISPATCH_TABLE_0702 = "0x0702 (0x600A game sub-state)";

export function dispatchInGameSubstate(m) {
  const { mem8 } = m;

  const substate = mem8[GAME_SUBSTATE];

  // Doubling into the table offset is an 8-bit result: base + (2*substate & 0xff).
  const entry = (SUBSTATE_TABLE + ((substate * 2) & 0xff)) & 0xffff;
  const target = mem8[entry] | (mem8[(entry + 1) & 0xffff] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_0702);
}
