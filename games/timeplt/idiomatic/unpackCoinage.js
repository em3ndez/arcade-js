// SPDX-License-Identifier: GPL-3.0-only
/** unpackCoinage — turn the two four-bit coinage settings into the byte each coin slot's accept arm
 * works from, and raise the free-play flag when either of them reads free play.
 *
 * ROLE. Run on the boot path, after COINAGE_SETTINGS has been filled with the complement of the
 * DSW0 DIP-switch port (the switches are active-low). That byte holds two settings, one per nibble:
 * the low nibble is MAME's "Coin A", the high nibble "Coin B". Each nibble is looked up in the
 * sixteen-entry COINAGE_VALUE_TABLE (0x4B95) and the byte it lands on -- coins-required-minus-one
 * in its high nibble, credits in its low -- is stored in that nibble's own destination:
 * COIN_SLOT_1_RATIO for the low nibble, COIN_SLOT_2_RATIO for the high one. The coin accept arms
 * that debounce the coin-1 and coin-2 bits then read those bytes. The table turns a setting into
 * a value; this routine only routes it.
 *
 * One setting is special: a nibble of 15 is free play. It raises FREE_PLAY to all-ones BEFORE the
 * lookup, and both nibbles raise the SAME cell, so either one on its own is enough -- and the
 * lookup still happens afterwards. The source byte is re-read for the second nibble rather than
 * kept (ROM 0x4AE1).
 *
 * ROM 0x4ACC-0x4AFA (frozen lift translated/loc_4acc.js). Grounding: [seen] (names.js ROUTINES
 * 0x4acc). LIVE-OUT: the flag cell, the two stored bytes, and the last byte read.
 */

import { fetchTableByte } from "./fetchTableByte.js";
import { COINAGE_SETTINGS, COIN_SLOT_1_RATIO, COIN_SLOT_2_RATIO, FREE_PLAY, COINAGE_VALUE_TABLE } from "./names.js";

// One four-bit setting (ROM `and 0x0f`).
const NIBBLE = 0x0f;
// The setting that means free play (ROM `cp 0x0f`), and the value FREE_PLAY is raised to.
const RAISING_VALUE = 15;
const RAISED = 255;

/** One nibble's worth, identical for both slots in the ROM (0x4AD1-0x4AE1 and 0x4AEA-0x4AFA). */
function unpackNibble(m, setting, destination) {
  const { mem8 } = m;
  // Free play: raise the flag first (`ld hl,0xa9c0 / ld (hl),0xff`); nothing ever lowers it here.
  if (setting === RAISING_VALUE) mem8[FREE_PLAY] = RAISED;
  // Then always look the setting up (the table-fetch restart at 0x0008) and store the result.
  mem8[destination] = fetchTableByte(m, COINAGE_VALUE_TABLE, setting);
}

export function unpackCoinage(m) {
  const { mem8 } = m;
  // Coin A: the low nibble, into slot 1's byte.
  unpackNibble(m, mem8[COINAGE_SETTINGS] & NIBBLE, COIN_SLOT_1_RATIO);
  // Coin B: the high nibble, re-read and brought down by four `rrca`s + `and 0x0f`, into slot 2's.
  unpackNibble(m, mem8[COINAGE_SETTINGS] >> 4, COIN_SLOT_2_RATIO);
}
