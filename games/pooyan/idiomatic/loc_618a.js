// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * loc_618a — clear the active-object type, then signal the caller-skip.
 *
 * Zeroes ACTIVE_OBJECT_TYPE and returns the abort signal: control must unwind one frame
 * past the direct caller, so every caller aborts instead of continuing. The discarded-
 * return plumbing is dropped; the boolean carries the outcome. LIVE-OUT: boolean, always
 * false (the only path is the skip); no register survives the abort.
 */
export function loc_618a(m) {
  m.mem8[ACTIVE_OBJECT_TYPE] = 0x00;
  return false; // skip path: abort the caller's frame
}
