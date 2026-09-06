// SPDX-License-Identifier: GPL-3.0-only
// Second half of the tile-strip fill: stamp `count` two-tile pairs from the cursor forward, save the
// advanced cursor, then tick the strip-redraw countdown. While it is still running, done; on its expiry
// restart the screen-fill outer dwell. (The counter restored past the bank swap is always the dwell timer.)
import { u16 } from "../../../core/int.js";
import { VRAM_WRITE_PTR, loc_4008 } from "./names.js";
import { restartScreenFillOnDwellExpiry } from "./restartScreenFillOnDwellExpiry.js";

const STRIP_TILE_A = 52;
const STRIP_TILE_B = 54;

export function loc_1d43(m, cursor = m.regs.hl, count = m.regs.b) {
  const { mem8, mem16 } = m;

  // Stamp the pair (A,B) at the cursor, advancing two cells each time; count 0 wraps to 256 pairs.
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
  mem16[VRAM_WRITE_PTR] = ptr;
  mem8[loc_4008] = mem8[loc_4008] - 1;
  if (mem8[loc_4008] !== 0) return;

  return restartScreenFillOnDwellExpiry(m, loc_4008);
}
