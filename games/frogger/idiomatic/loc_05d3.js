// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05d3 — set the 2-player / demo start flags to their fixed initial constants.
 * LIVE-OUT: memory-only.
 */
import { loc_826d, loc_825a, loc_83cd, loc_825b, loc_83ea, loc_8297, loc_8298 } from "./names.js";

export function loc_05d3(m) {
  const { mem8 } = m;
  mem8[loc_826d] = 1;
  mem8[loc_825a] = 1;
  mem8[loc_83cd] = 1;
  mem8[loc_825b] = 0;
  mem8[loc_83ea] = 0;
  mem8[loc_8297] = 255;
  mem8[loc_8298] = 64;
}
