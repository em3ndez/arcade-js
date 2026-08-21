// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f19 — append the fixed byte 0x0e into the command ring: load a constant byte and
 * hand it to the ring-append helper, whose gate, cursor advance and returned cursor are
 * this entry's whole effect and result.
 *
 * LIVE-OUT: A = the helper's advanced ring cursor (0 when the append gates are closed),
 * set through the helper's own return-assignment for a caller that reads A back.
 */

const RING_BYTE = 0x0e; // the byte this entry appends

export function loc_0f19(m) {
  return loc_0ea2(m, RING_BYTE);
}
