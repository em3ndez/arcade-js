// SPDX-License-Identifier: GPL-3.0-only
import { loc_db88 } from "./loc_db88.js";

// Run the vector-block clear with its value/index pair primed. The primed value
// is always nonzero, so the alternate self-seeding entry is never reached.
export function loc_db7e(m) {
  return loc_db88(m, 0x32, 0xb6);
}
