// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0ef5 — enqueue the fixed command byte 0x06 into the command ring.
 * Supplies the constant command code and tail-calls the ring-append helper, whose effect
 * (and result) become this stub's.
 * LIVE-OUT: A = the helper's advanced ring cursor (0 when both append gates are closed);
 * The ring appender sets A through its own return-assignment and callers read it, so it flows straight back.
 */
const COMMAND_BYTE = 0x06; // the fixed command code this stub appends

export function loc_0ef5(m) {
  return loc_0ea2(m, COMMAND_BYTE);
}
