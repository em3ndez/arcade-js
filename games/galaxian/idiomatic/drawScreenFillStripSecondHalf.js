// SPDX-License-Identifier: GPL-3.0-only
//
// drawScreenFillStripSecondHalf -- second slice of the attract-mode animated screen fill, and its frame tail.
//
// WHAT IT IS
//   The companion to drawScreenFillStripFirstHalf. From the cursor the first half left, it stamps `count`
//   more two-tile pairs (tiles 52 and 54, the bottom-row tiles of the strip), then does the per-frame
//   bookkeeping: it commits the advanced cursor back to VRAM_WRITE_PTR and decrements the strip dwell so
//   the fill knows when to stop drawing strips.
//
// ROLE IN THE MACHINE
//   Entered by falling through from drawScreenFillStripFirstHalf (ROM 0x1d39), which sets B=0x10 (=16
//   pairs). loc_4008 is the fast sub-timer / prescaler at the bottom of the dwell-timer cascade
//   (loc_4008 -> loc_4009 -> SEQUENCE_STATE): here it doubles as the strip gate. While it is still
//   nonzero the frame is finished (more strips to come). On its zero-crossing the outer fill dwell is
//   restarted via restartScreenFillOnDwellExpiry (ROM 0x1d51), which ticks the high tier loc_4009 and,
//   when that drains, re-seeds the whole fill through resetScreenFillState.
//
//   ROM 0x1d43.  Grounding: [seen].
//
// LIVE-OUT: VRAM_WRITE_PTR (0x400b) := advanced cursor; loc_4008 decremented; on its zero-cross the outer
//           dwell is restarted. (The byte reloaded past the Z80 bank swap is always this strip dwell timer.)
import { u16 } from "../../../core/int.js";
import { VRAM_WRITE_PTR, loc_4008 } from "./names.js";
import { restartScreenFillOnDwellExpiry } from "./restartScreenFillOnDwellExpiry.js";

// The bottom-row tile pair for the strip (the first half laid 48/50 above these two rows).
const STRIP_TILE_A = 52;
const STRIP_TILE_B = 54;

export function drawScreenFillStripSecondHalf(m, cursor = m.regs.hl, count = m.regs.b) {
  const { mem8, mem16 } = m;

  // Stamp the pair (A,B) at the cursor, advancing two cells each time; count 0 wraps to 256 pairs.
  // `remaining` mirrors the Z80 B register: pre-decremented and masked to 8 bits, so 0 means a full page.
  let ptr = cursor;
  let remaining = count;
  do {
    mem8[ptr] = STRIP_TILE_A;
    ptr = u16(ptr + 1);
    mem8[ptr] = STRIP_TILE_B;
    ptr = u16(ptr + 1);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);

  // Stash the advanced cursor back, then tick the redraw countdown.
  // Committing VRAM_WRITE_PTR is what lets the next frame's strip continue where this one stopped;
  // decrementing loc_4008 (the strip gate / prescaler) counts down the strips remaining in the fill.
  mem16[VRAM_WRITE_PTR] = ptr;
  mem8[loc_4008] = mem8[loc_4008] - 1;
  // Strip gate still running -> nothing more to do this frame; the fill resumes next tick.
  if (mem8[loc_4008] !== 0) return;

  // Gate hit zero -> the strip pass is spent; restart the outer dwell (which may re-seed the whole fill).
  return restartScreenFillOnDwellExpiry(m, loc_4008);
}
