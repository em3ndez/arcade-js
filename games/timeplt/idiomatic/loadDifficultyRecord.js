// SPDX-License-Identifier: GPL-3.0-only
/** loadDifficultyRecord — copy the four-byte record an index selects out of a fixed table and into the four
 * cells that hold the settings in force. Scaling the index by the record width is done as a byte,
 * so an index of sixty-four or more selects a record a wider multiply would not. Nothing is read
 * back and the four cells are overwritten whole.
 *
 * ROM 0x0F7B-0x0F8C (frozen lift translated/loc_0f7b.js). Grounding: [seen] (names.js ROUTINES 0x0f7b).
 *
 * Role in the machine: loads the cabinet's difficulty setting. names.js records that the index it
 * is normally handed is the three-bit Difficulty DIP field, and the table (DIFFICULTY_RECORD_TABLE,
 * 0x186A) has eight records. The four cells from START_RUNG_ROUNDS_1_5 (0xA9D3) are three
 * escalation rungs a round starts on, bracketed by round number, and the rung period.
 *
 * LIVE-OUT: memory-only. */

import { offsetAddress } from "./offsetAddress.js";
import { u8 } from "../../../core/int.js";
import { START_RUNG_ROUNDS_1_5, DIFFICULTY_RECORD_TABLE } from "./names.js";

// Four bytes per record.
const RECORD_TABLE = DIFFICULTY_RECORD_TABLE;
const RECORD_BYTES = 4;

export function loadDifficultyRecord(m, index = m.regs.a) {
  const { mem8 } = m;
  // The record's address: index times four, kept to a byte (the ROM's two `add a,a`), added to
  // the table base (`rst 0x18`). `index` arrives in the accumulator on the Z80.
  const record = offsetAddress(m, RECORD_TABLE, u8(index * RECORD_BYTES));
  // Copy the four bytes into the settings cells (four LDIs).
  for (let i = 0; i < RECORD_BYTES; i++) mem8[START_RUNG_ROUNDS_1_5 + i] = mem8[record + i];
}
