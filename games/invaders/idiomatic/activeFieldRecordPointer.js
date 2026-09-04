// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

/**
 * activeFieldRecordPointer — address the active player's field-save record.
 *
 * WHAT IT IS
 *   A one-line pointer former. It returns HL pointing at the "field-save record" that lives near the top
 *   of the current player's RAM page — the slot where that player's fleet position/state is stashed
 *   between turns so each player keeps their own board across the hand-off.
 *
 * ROLE IN THE MACHINE
 *   Space Invaders gives each player a whole 256-byte work-RAM page: player 1 at 0x21xx, player 2 at
 *   0x22xx. ACTIVE_PLAYER_PAGE (0x2067) holds just the high byte (0x21 or 0x22) of whichever page is
 *   currently live. Shifting that byte left 8 yields the page base; OR-ing in the fixed low byte 0xfc
 *   addresses the field-save record at page:0xfc. loadReferenceAlienState (0x00b1) calls this to read the
 *   saved reference-alien coordinate word back out of the record, and stageActivePlayerFieldSave (0x0878)
 *   tail-jumps here to point HL at the same slot before writing the outgoing player's field back.
 *
 * ROM 0x0886-0x088c.  Grounding: [seen].
 *
 * LIVE-OUT: HL = (mem[ACTIVE_PLAYER_PAGE] << 8) | 0xfc (also the JS return value).
 */
export function activeFieldRecordPointer(m) {
  // Read the active page's high byte (0x21 or 0x22), shift it into the high byte of the address, and pin
  // the low byte to 0xfc so HL lands on the per-player field-save record at page:0xfc.
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] << 8) | 0xfc);
}
