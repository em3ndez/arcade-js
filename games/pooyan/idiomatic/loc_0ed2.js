// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0ed2 — queue display command 0x01.
 *
 * Loads the fixed command code and appends it to the command ring through the shared append
 * helper, returning the helper's result unchanged.
 *
 * LIVE-OUT: A = the append helper's advanced ring cursor (0 when the gates are closed); AF is
 * not restored across the tail call, so the caller reads it back.
 */

const COMMAND = 0x01;

export function loc_0ed2(m) {
  return loc_0ea2(m, COMMAND);
}
