// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { dispatchActiveObjectState } from "./dispatchActiveObjectState.js";
import { OBJECT_STATE_RECORD_BASE } from "./names.js";

/**
 * loc_76f4 — sweep the per-object state dispatcher over the six object records.
 *
 * Walks the six records at OBJECT_STATE_RECORD_BASE (stride 0x18) and runs the per-record
 * state handler on each. LIVE-OUT: memory only.
 */
export function loc_76f4(m) {
  let rec = OBJECT_STATE_RECORD_BASE;
  for (let i = 0; i < 6; i++) {
    dispatchActiveObjectState(m, rec);
    rec = u16(rec + 0x18);
  }
}
