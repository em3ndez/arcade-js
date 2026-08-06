// SPDX-License-Identifier: GPL-3.0-only
/** retreatCharCursor — step the character-cell cursor back one place along the line being drawn; one
 * place back is thirty-two addresses on down the tilemap. LIVE-OUT: the cursor, nothing else. */

import { u16 } from "../../../core/int.js";

export function retreatCharCursor(m) {
  const { regs } = m;
  regs.de = u16(regs.de + 32);
}
