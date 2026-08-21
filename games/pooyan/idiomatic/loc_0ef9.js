// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0ef9 — append the fixed byte into the command ring.
 *
 * Loads the constant append value and hands it to the ring appender, which stashes it, appends
 * it only while a game is active or the play-mode latch is set, and advances the ring cursor.
 *
 * LIVE-OUT: A = the advanced ring cursor (0 on the gates-closed path). The appender sets it via
 * its own return-assignment and this tail hands that straight back for a caller that reads it.
 */
const APPEND_TILE = 0x07;

export function loc_0ef9(m) {
  return loc_0ea2(m, APPEND_TILE);
}
