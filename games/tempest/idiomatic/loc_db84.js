// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_60c1, loc_60d1 } from "./names.js";
import { loc_df39 } from "./loc_df39.js";

// Emit one framing record, then clear four even-indexed slots in each of two register banks.
export function loc_db84(m) {
  const { mem8 } = m;

  loc_df39(m, 0x33, 0x0a);

  for (let x = 0x06; x >= 0; x -= 2) {
    mem8[u16(loc_60c1 + x)] = 0x00;
    mem8[u16(loc_60d1 + x)] = 0x00;
  }
}
