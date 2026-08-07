// SPDX-License-Identifier: GPL-3.0-only
/** loadDifficultyRecord — copy the four-byte record an index selects out of a fixed table and into the four
 * cells that hold the settings in force. Scaling the index by the record width is done as a byte,
 * so an index of sixty-four or more selects a record a wider multiply would not. Nothing is read
 * back and the four cells are overwritten whole. LIVE-OUT: memory-only. */

import { offsetAddress } from "./offsetAddress.js";
import { u8 } from "../../../core/int.js";
import { START_RUNG_ROUNDS_1_5 } from "./names.js";

const RECORD_TABLE = 0x186a;
const RECORD_BYTES = 4;

export function loadDifficultyRecord(m, index = m.regs.a) {
  const { mem8 } = m;
  const record = tableEntry(m, RECORD_TABLE, u8(index * RECORD_BYTES));
  for (let i = 0; i < RECORD_BYTES; i++) mem8[START_RUNG_ROUNDS_1_5 + i] = mem8[record + i];
}

/** The address step wants its base and its offset in the registers it reads them from. */
function tableEntry(m, base, offset) {
  m.regs.hl = base;
  m.regs.a = offset;
  return offsetAddress(m);
}
