// SPDX-License-Identifier: GPL-3.0-only
import { fillScreenRow } from "./fillScreenRow.js";
import { PLAYFIELD_VRAM_BASE } from "./names.js";

// Paint the lit byte down 0xe0 play-field rows via the shared row-fill; live-out HL is the end pointer.
export function loc_01cf(m) {
  return fillScreenRow(m, 0x01, 0xe0, PLAYFIELD_VRAM_BASE);
}
