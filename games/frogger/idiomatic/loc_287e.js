// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_287e — arm the frame-cell block once. When the busy latch is clear, raise the arm flag, seed the
 * two frame cells from the low nibble of the shared source cell (times 8), then set the busy latch so a
 * later pass does not re-seed. LIVE-OUT: memory-only (the sole caller reloads from memory).
 */
import { loc_814f, loc_8150, loc_819b, loc_8146, loc_8147 } from "./names.js";

const LOW_NIBBLE = 0x0f;
const SEED_SCALE = 8;

export function loc_287e(m) {
  const { mem8 } = m;
  if (mem8[loc_814f] !== 0) return; // busy latch already set -> seeded this cycle
  mem8[loc_8150] = 1;
  seedFrameCells(m);
}

// seed the two frame cells from the shared source cell's low nibble, then raise the busy latch.
function seedFrameCells(m) {
  const { mem8 } = m;
  const seed = (mem8[loc_819b] & LOW_NIBBLE) * SEED_SCALE;
  mem8[loc_8146] = seed;
  mem8[loc_8147] = seed;
  mem8[loc_814f] = 1;
}
