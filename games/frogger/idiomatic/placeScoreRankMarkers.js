// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeScoreRankMarkers — stamp a value-to-position marker for each of the two rank codes in the field:
 * for each nonzero code, write the constant marker tile into work-RAM page 0x80 at offset (48 - code),
 * via the row helper twice (low code then high). A zero code stamps nothing — the value is encoded as a
 * position, not a rendered numeral. LIVE-OUT: memory-only.
 */
import { loc_83fb } from "./names.js";
import { loc_0c4a } from "./loc_0c4a.js";

const RAM_PAGE = 0x80;
const ROW_BASE = 48;
const MARKER_TILE = 4;

export function placeScoreRankMarkers(m) {
  const { regs, mem16 } = m;
  regs.h = RAM_PAGE;
  regs.bc = mem16[loc_83fb];
  regs.d = ROW_BASE;
  regs.e = MARKER_TILE;

  loc_0c4a(m);

  regs.c = regs.b;
  return loc_0c4a(m);
}
