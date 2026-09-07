// SPDX-License-Identifier: GPL-3.0-only
//
// advanceScreenFillStrip (ROM 0x1d28, [seen]) -- head of the per-frame tile-strip screen fill.
//
// WHAT IT IS
//   The entry point of the screen-fill animation that wipes the playfield a strip at a time during the
//   boot self-test and attract phases. It is reached via the alternate per-frame path: when the mode
//   byte loc_401a selects value 2, dispatchSelfTestMode (ROM 0x1bcd) routes the frame here instead of
//   the full gameplay frame, so one call paints one strip of the fill. (mechanisms.md, "The alternate
//   per-frame path".)
//
// ROLE IN THE MACHINE
//   First it pets the watchdog by reading SOUND_PITCH_W (0x7800) -- that address doubles as the
//   watchdog-kick port on read, promising the hardware the program is still alive. Then loc_4008 is the
//   strip gate: zero means no strip is pending, so restart the outer screen-fill dwell via
//   restartScreenFillOnDwellExpiry (ROM 0x1d51); nonzero means load the live VRAM write cursor
//   VRAM_WRITE_PTR (0x400b) and draw the strip's first half (16 tile pairs) via
//   drawScreenFillStripFirstHalf, which flows on into the second half and the rest of the fill.
//
// LIVE-OUT: delegated -- VRAM tiles + dwell cells written by the tail routines.
import { restartScreenFillOnDwellExpiry } from "./restartScreenFillOnDwellExpiry.js";
import { drawScreenFillStripFirstHalf } from "./drawScreenFillStripFirstHalf.js";
import { SOUND_PITCH_W, loc_4008, VRAM_WRITE_PTR } from "./names.js";

// The first half of a strip is 16 tile pairs; drawScreenFillStripFirstHalf stamps them then falls
// through into the second half.
const FIRST_HALF_PAIRS = 16;

export function advanceScreenFillStrip(m) {
  const { mem8, mem16 } = m;

  // Read the watchdog port (0x7800) to pet the watchdog; the value itself is unused.
  mem8[SOUND_PITCH_W]; // watchdog pet (value discarded)

  // Strip gate clear: no strip to draw this frame, so tick/restart the outer fill dwell instead.
  if (mem8[loc_4008] === 0) return restartScreenFillOnDwellExpiry(m, loc_4008);

  // Strip pending: load the live VRAM write cursor and draw the strip's first half from there.
  const cursor = mem16[VRAM_WRITE_PTR];
  return drawScreenFillStripFirstHalf(m, cursor, FIRST_HALF_PAIRS);
}
