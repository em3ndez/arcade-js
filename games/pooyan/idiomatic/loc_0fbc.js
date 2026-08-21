// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0fbc — append a fixed four-tile sequence into the text ring, one tile at a time. The
 * final append is a tail call whose result becomes this routine's own.
 *
 * LIVE-OUT: A = the advanced text-ring cursor from the last append (0 when the append gates are
 * shut), propagated through the tail return to stay faithful to the append's exit; this routine's
 * own caller reloads A before use.
 */

const TILE_FIRST = 0x28;
const TILE_SECOND = 0x15;
const TILE_THIRD = 0x16;
const TILE_FOURTH = 0x17;

export function loc_0fbc(m) {
  loc_0ea2(m, TILE_FIRST);
  loc_0ea2(m, TILE_SECOND);
  loc_0ea2(m, TILE_THIRD);
  return loc_0ea2(m, TILE_FOURTH); // tail: its advanced-cursor result and A write are ours
}
