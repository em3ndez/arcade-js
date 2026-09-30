// SPDX-License-Identifier: GPL-3.0-only
/**
 * blankVideoRam -- fill the whole tilemap with the blank tile.
 *
 * WHAT IT IS
 *   Writes the blank tile (16) into all four 256-byte pages of tile VRAM, 0x5000-0x53ff, kicking the
 *   watchdog once per page so the long fill never trips the reset.
 *
 * ROLE IN THE MACHINE
 *   The boot-time screen clear: it leaves the tilemap showing nothing but blank tiles.
 *
 * ROM 0x1b5d.  Grounding: [seen]. Cells: VRAM_BASE (0x5000), WATCHDOG_RESET (0x7800).
 *
 * LIVE-OUT: VRAM 0x5000-0x53ff = 16, four watchdog kicks. No register result.
 */
import { VRAM_BASE, WATCHDOG_RESET } from "./names.js";

const BLANK_TILE = 16;
const VRAM_PAGES = 4;
const PAGE = 0x100;

export function blankVideoRam(m) {
  const { mem8 } = m;
  for (let page = 0; page < VRAM_PAGES; page++) {
    const base = VRAM_BASE + page * PAGE;
    for (let i = 0; i < PAGE; i++) mem8[base + i] = BLANK_TILE;
    void mem8[WATCHDOG_RESET]; // kick the watchdog after each page
  }
}
