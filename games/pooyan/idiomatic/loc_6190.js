// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6166 } from "./loc_6166.js";
/**
 * loc_6190 — mark the matched target record engaged, then reset the actor record.
 *
 * Seats the two "engaged" fields on the record IX points at (state 0x01 at +8, parameter
 * 0xd0 at +0xa), then continues into the actor-record reset, whose chain clears the object
 * type and aborts the caller's frame.
 *
 * LIVE-OUT: none of its own; propagates the reset chain's boolean (always false).
 */
export function loc_6190(m, ix = m.regs.ix) {
  const { mem8 } = m;
  mem8[u16(ix + 0x08)] = 0x01; // engaged state
  mem8[u16(ix + 0x0a)] = 0xd0; // engaged parameter
  return loc_6166(m); // reset the actor record (tail into the skip chain)
}
