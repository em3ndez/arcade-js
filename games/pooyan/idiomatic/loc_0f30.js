// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0f30 — append three fixed command bytes (0x95, 0x03, 0x11) into the command ring.
 *
 * Each byte is handed to the ring-append helper; the third is a tail call, so this routine's
 * result is the helper's result from that last append.
 *
 * LIVE-OUT: A = the ring cursor the final append leaves (0 when the append gates are closed),
 * set through the helper's return-assignment bridge and read the same way any append site reads it.
 */

const CMD_A = 0x95;
const CMD_B = 0x03;
const CMD_C = 0x11;

export function loc_0f30(m) {
  loc_0ea2(m, CMD_A);
  loc_0ea2(m, CMD_B);
  return loc_0ea2(m, CMD_C);
}
