// SPDX-License-Identifier: GPL-3.0-only
import { activePlayerPageBase } from "./activePlayerPageBase.js";

/**
 * readActivePlayerPageTopByte — read the byte at the very top of the active player's page.
 *
 * WHAT IT IS
 *   Forms the active player's page base (page<<8, via activePlayerPageBase), forces the low byte to
 *   0xff to address the very top of that 256-byte page (page:0xff), and reads the byte there into A,
 *   leaving the address in HL. For player one that is 0x21ff; for player two, 0x22ff.
 *
 * ROLE IN THE MACHINE
 *   The third of three sibling page-pointer helpers built on ACTIVE_PLAYER_PAGE (0x2067): sibling
 *   activePlayerPageBase (0x1611) gives page<<8, activeFieldRecordPointer (0x0886) forces 0xfc for the
 *   field-save record, and this one forces 0xff for the page-top byte. That top byte holds the active
 *   player's reserve-ship count: decrementShipsAndDrawReadout (0x1a7f) reads it here, and when nonzero
 *   stores count-1 back (a ship enters play) and repaints the reserve-life readout.
 *
 * ROM 0x092e.  Grounding: [seen].
 *
 * LIVE-OUT: HL = the page-top address (page:0xff); A = the byte read there.
 */
export function readActivePlayerPageTopByte(m) {
  // Form the active page base (0x2100 / 0x2200) and force the low byte to 0xff -> the page-top address.
  const ptr = activePlayerPageBase(m) | 0xff;
  // Leave that address in HL and read its byte into A (the live-out contract).
  return [(m.regs.hl = ptr), (m.regs.a = m.mem8[ptr])];
}
