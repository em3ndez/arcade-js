// SPDX-License-Identifier: GPL-3.0-only
/** unpackCoinage — unpack a byte holding two four-bit settings into the two bytes the machine works from,
 * one nibble at a time. Each nibble is looked up in a small table and the byte it lands on is stored in
 * that nibble's own destination, so the table turns a setting into a value and this routine only routes it.
 * One nibble value is special: it raises a flag cell to all-ones BEFORE the lookup, and both nibbles raise
 * the SAME cell, so either one on its own is enough and the lookup still happens afterwards. The source
 * byte is re-read for the second nibble rather than kept. LIVE-OUT: the flag cell, the two stored bytes,
 * the table pointer, and the last byte read. */

import { fetchTableByte } from "./fetchTableByte.js";
import { COINAGE_SETTINGS, COIN_SLOT_1_RATIO, COIN_SLOT_2_RATIO, FREE_PLAY, COINAGE_VALUE_TABLE } from "./names.js";

const NIBBLE = 0x0f;
const RAISING_VALUE = 15;
const RAISED = 255;

function unpackNibble(m, setting, destination) {
  const { mem8, regs } = m;
  if (setting === RAISING_VALUE) mem8[FREE_PLAY] = RAISED;
  regs.hl = COINAGE_VALUE_TABLE;
  regs.a = setting;
  mem8[destination] = fetchTableByte(m);
}

export function unpackCoinage(m) {
  const { mem8 } = m;
  unpackNibble(m, mem8[COINAGE_SETTINGS] & NIBBLE, COIN_SLOT_1_RATIO);
  unpackNibble(m, mem8[COINAGE_SETTINGS] >> 4, COIN_SLOT_2_RATIO);
}
