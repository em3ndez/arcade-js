// SPDX-License-Identifier: GPL-3.0-only
/** loc_15b6 — sweep every sprite off the picture at once. Each of the 24 slots the display
 * scans carries a vertical position, and this zeros all of them; zero puts a slot above the
 * FIRST drawn line, clear of the picture entirely, so nothing of it appears. Every other byte of a slot stands, so none is
 * retired. LIVE-OUT: memory only — 24 bytes, evenly spaced and all inside one page. */

const SLOT_COUNT = 24;
const FIRST_VERTICAL = 0xaa41;
const SLOT_STRIDE = 2;

export function loc_15b6(m) {
  const { mem8 } = m;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    mem8[FIRST_VERTICAL + slot * SLOT_STRIDE] = 0;
  }
}
