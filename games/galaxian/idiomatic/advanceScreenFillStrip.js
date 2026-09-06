// SPDX-License-Identifier: GPL-3.0-only
// Head of the tile-strip screen-fill updater. Pets the watchdog, then reads the gate byte: when it is zero
// there is no strip to draw, so restart the outer screen-fill dwell; otherwise load the live VRAM write
// cursor and draw the first half of the strip (16 tile pairs), which flows into the rest of the fill.
import { restartScreenFillOnDwellExpiry } from "./restartScreenFillOnDwellExpiry.js";
import { drawScreenFillStripFirstHalf } from "./drawScreenFillStripFirstHalf.js";
import { SOUND_PITCH_W, loc_4008, VRAM_WRITE_PTR } from "./names.js";

const FIRST_HALF_PAIRS = 16;

export function advanceScreenFillStrip(m) {
  const { mem8, mem16 } = m;

  mem8[SOUND_PITCH_W]; // watchdog pet (value discarded)

  if (mem8[loc_4008] === 0) return restartScreenFillOnDwellExpiry(m, loc_4008);

  const cursor = mem16[VRAM_WRITE_PTR];
  return drawScreenFillStripFirstHalf(m, cursor, FIRST_HALF_PAIRS);
}
