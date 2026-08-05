// SPDX-License-Identifier: GPL-3.0-only
/** loc_0020 — step the character-cell cursor to the next cell of the line being drawn;
 * one cell is thirty-two addresses back down the tilemap. LIVE-OUT: the cursor, nothing else. */

import { u16 } from "../../../core/int.js";

export function loc_0020(m) {
  const { regs } = m;
  regs.de = u16(regs.de - 32);
}
