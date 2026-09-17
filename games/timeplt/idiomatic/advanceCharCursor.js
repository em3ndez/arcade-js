// SPDX-License-Identifier: GPL-3.0-only
/** advanceCharCursor — step the character-cell cursor to the next cell of the line being drawn;
 * one cell is thirty-two addresses back down the tilemap. LIVE-OUT: the cursor, nothing else. */

import { u16 } from "../../../core/int.js";

export function advanceCharCursor(m, cursor = m.regs.de) {
  // the stepped cursor is a register-dispatched live-out read back by the frozen translated caller.
  return (m.regs.de = u16(cursor - 32));
}
