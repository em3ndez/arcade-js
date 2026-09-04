// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { u16 } from "../../../core/int.js";
import { SHIELD_TEMPLATE } from "./names.js";

/**
 * initShieldBuffers -- stamp a fresh set of four bunker shields into a player's backup buffer.
 *
 * WHAT IT IS
 *   Each player keeps a private backup of its four bunker shields so bunker damage persists across turns.
 *   A single 0x2c-byte ROM template describes one pristine shield; this routine replicates that template
 *   four times into consecutive 0x2c-byte slots of the destination buffer, producing four undamaged
 *   shields in a row.
 *
 * ROLE IN THE MACHINE
 *   The source is the shield template at SHIELD_TEMPLATE (0x1d20); the destination base arrives in HL, seated by
 *   the two front doors initPlayer1ShieldBuffers (-> PLAYER1_SHIELD_BUFFER 0x2142) and
 *   initPlayer2ShieldBuffers (-> PLAYER2_SHIELD_BUFFER 0x2242), each inside that player's own page. Run at
 *   a player's round setup. The copy itself goes through blockCopy, the plain byte mover. The 0x2c-byte
 *   block size matches the per-shield rectangle that drawOrSaveShields later saves/restores.
 *
 * ROM 0x01f8.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the end pointer (one past the fourth slot), returned for callers.
 */
export function initShieldBuffers(m, hl = m.regs.hl) {
  // Walk a destination cursor across four consecutive shield slots.
  let dst = hl;
  for (let pass = 0; pass < 4; pass++) {
    // Copy one pristine 0x2c-byte shield template into the current slot.
    blockCopy(m, SHIELD_TEMPLATE, dst, 0x2c);
    // Advance to the next 0x2c-byte slot (16-bit wrap-safe).
    dst = u16(dst + 0x2c);
  }
  // Hand back the end pointer (past the last slot) as the live-out HL.
  return (m.regs.hl = dst);
}
