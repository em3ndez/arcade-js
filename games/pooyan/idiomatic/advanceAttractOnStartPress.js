// SPDX-License-Identifier: GPL-3.0-only
import { IN0_PORT, ATTRACT_SUBSTATE, VIDEO_RAM_BASE } from "./names.js";
/**
 * advanceAttractOnStartPress — IN0 start-button poll during attract.
 *
 * While the start bit (IN0 bit3) is still set nothing happens. On a press it jumps the attract
 * sequence to sub-state 9 and wipes the tile video RAM to the blank tile, one cell short of the
 * full tile page.
 *
 * LIVE-OUT: memory only — a void poll; the caller reads nothing back.
 */
const FILL_CELLS = 0x03ff; // 1023 cells — leaves the final page cell untouched
const BLANK_TILE = 0x10;

export function advanceAttractOnStartPress(m) {
  const { mem8 } = m;
  if ((mem8[IN0_PORT] & 0x08) !== 0) return; // start bit still set -> not pressed
  mem8[ATTRACT_SUBSTATE] = 0x09;
  for (let i = 0; i < FILL_CELLS; i++) mem8[VIDEO_RAM_BASE + i] = BLANK_TILE;
}
