// SPDX-License-Identifier: GPL-3.0-only
import { loc_19dc } from "./loc_19dc.js";

// Clear the low sound-latch bit (mask 0xfe) through the shared port-3 helper. Value-out: A.
export function loc_0707(m) {
  return loc_19dc(m, 0xfe);
}
