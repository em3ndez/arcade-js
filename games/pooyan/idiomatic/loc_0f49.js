// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f49 — append the fixed command byte 0x14 into the command ring (a tail call to the
 * ring-append helper).
 *
 * LIVE-OUT: A = the ring cursor the append leaves (0 when the append gates are closed), set
 * through the helper's return-assignment bridge and read the same way any append site reads it.
 */

const CMD = 0x14;

export function loc_0f49(m) {
  return loc_0ea2(m, CMD);
}
