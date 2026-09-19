// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchCreditedSubstate — run the current step of the credited game (the stretch after a
 * coin is accepted, before play begins), vectoring through a 2-entry table of code addresses
 * indexed by the sub-state.
 *
 * LIVE-OUT: memory-only — whatever the dispatched step writes.
 */

import { u16 } from "../../../core/int.js";
import {
  CREDITED_SUBSTATE_TABLE,
  GAME_SUBSTATE,
} from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

const DISPATCH_TABLE_08B6 = "0x08B6 (0x600A, 2-entry)";

export function dispatchCreditedSubstate(m) {
  const { mem8 } = m;

  const substate = mem8[GAME_SUBSTATE];

  // 8-bit offset double: index 0x80 wraps back to 0, matching the guest.
  const entry = u16(CREDITED_SUBSTATE_TABLE + ((substate * 2) & 0xff));
  const target = mem8[entry] | (mem8[u16(entry + 1)] << 8);

  loc_00ca(m, target, DISPATCH_TABLE_08B6);
}
