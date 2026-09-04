// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

/**
 * activePlayerPageBase — form the base address of the active player's work-RAM page.
 *
 * WHAT IT IS
 *   Space Invaders gives each of the two players an entire 256-byte page of work RAM (player one at
 *   0x21xx, player two at 0x22xx) holding that player's alien field and per-player state. A single
 *   byte, ACTIVE_PLAYER_PAGE (0x2067), names which page is currently in play: its value IS the page
 *   number (0x21 or 0x22). This routine turns that page number into the page's base address by
 *   shifting it left eight bits — HL := mem[0x2067] << 8 (0x21 -> 0x2100, 0x22 -> 0x2200).
 *
 * ROLE IN THE MACHINE
 *   The first of three sibling page-pointer helpers. activeFieldRecordPointer (0x0886) does the same
 *   shift but forces the low byte to 0xfc to address the field-save record near the top of the page;
 *   readActivePlayerPageTopByte (0x092e) forces 0xff and reads the byte at the very top. Because the
 *   same code just reads the page byte and forms page<<8, one body walks whichever player is live.
 *   Reads only ACTIVE_PLAYER_PAGE (0x2067); touches no other state.
 *
 * ROM 0x1611.  Grounding: [seen] (ACTIVE_PLAYER_PAGE is [seen]).
 *
 * LIVE-OUT: HL = the page base address (also the returned value). The seam completes the ret.
 */
export function activePlayerPageBase(m) {
  // Read the page-number byte (0x21 or 0x22) and shift it into the high byte, so HL points at the
  // first byte (base) of the active player's page. The low byte is left at 0x00.
  return (m.regs.hl = m.mem8[ACTIVE_PLAYER_PAGE] << 8);
}
