// SPDX-License-Identifier: GPL-3.0-only
/**
 * deriveTileWriteCursors — turn a tile's tilemap offset into its colour-RAM and video-RAM write cursors.  ROM 0x3dc9.
 *
 * The tile-plotter has already reduced a (row, column) cell to a single linear
 * tilemap offset. The same offset addresses the same cell in both maps, since the
 * colour map and the tilemap share one layout: the cell's colour byte sits at the
 * colour-RAM base plus that offset, and its character byte at the video-RAM base
 * plus the same offset. This forms both absolute addresses and stores them as the
 * two write cursors the follow-on column fill starts from — 0x805e for colour,
 * 0x8060 for video.
 *
 * The offset is small enough that neither base-plus-offset leaves the map region,
 * so both are a plain add — no wrap to model.
 *
 * Runs immediately after the offset is computed, as the second half of the address
 * setup for every panel / record / HUD plotter (loc_47e1, loc_4816, loc_483a,
 * loc_4894, loc_3a6f, loc_4df8); each then re-reads the two cursors from memory to
 * stamp a run of cells.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3dc9.test.js.
 * GATE:     exhaustive over the input domain — all 65,536 tilemap-offset words poked
 *           on a real captured entry, both output addresses vs the oracle — plus every
 *           real attract dispatch checked on the full contract (only 0x805e / 0x8060
 *           written). Teeth: a twin that skips the colour-to-video bump. Reached
 *           throughout attract's draws.
 * LIVE-OUT: memory-only — the colour-RAM cursor at 0x805e and the video-RAM cursor at
 *           0x8060. The leftover pointer / flag registers are dead: each caller's next
 *           act overwrites its scratch register and re-reads the cursors from memory,
 *           never from a leftover register.
 * NAMES:    none from ram.js — 0x805a (tilemap-offset input) and 0x805e / 0x8060 (the
 *           colour and video write-cursor output cells) are unnamed there and kept hex;
 *           the two RAM-region bases are named locally.
 */

const COLOUR_RAM_BASE = 0x8800; // per-tile colour map base
const VIDEO_RAM_BASE = 0x9000; // tilemap (character) map base

export function deriveTileWriteCursors(m) {
  const { mem } = m;

  const offset = mem.read16(0x805a);

  // Same cell in both maps at the same offset: colour cursor, then video cursor.
  mem.write16(0x805e, COLOUR_RAM_BASE + offset);
  mem.write16(0x8060, VIDEO_RAM_BASE + offset);
}
