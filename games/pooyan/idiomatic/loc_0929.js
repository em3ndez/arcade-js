// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_02ce } from "./loc_02ce.js";
import { loc_02e3 } from "./loc_02e3.js";
import { loc_02b9 } from "./loc_02b9.js";
import { loc_0c45 } from "./loc_0c45.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { loc_0038 } from "./loc_0038.js";
import {
  ATTRACT_SUBSTATE,
  COPY_PROTECT_STALL_BYTE,
  SIGNATURE_EXPECTED_TOP,
  SIGNATURE_WORD_TABLE,
  FIELD_ATTRIB_SRC_07D9,
  DISPLAY_CMD_068B,
  DISPLAY_CMD_068E,
  DISPLAY_CMD_0200,
} from "./names.js";
/**
 * loc_0929 — guarded screen/attribute setup with an overlapping-decode protection arm.
 *
 * Carry-clear (normal): fill one tile row and bail if the row counter has not drained, re-arm the
 * fill, then bump the attract sub-state cell. Carry-set: an overlapping-decode arm that only bumps
 * the byte at the incoming pointer. Both arms then zero the board arena, stall until the protection
 * cell reads its ready value, verify a seven-entry signature (a mismatch is an unreachable tamper
 * trap), flood the attribute map, and enqueue three display commands.
 *
 * LIVE-OUT: memory only — the bumped cell, the zeroed arena, the attribute map, and the display
 * ring. Register outputs are dead (callers reload). Inputs bridged: entry carry and pointer.
 */
const FILL_ROW_BLANKS = 0x19; //   one row's worth of blank cells
const SIGNATURE_COUNT = 7; //      signature entries checked
const ENTRY_OFFSET = 0x1c; //      per-entry byte offset added to the looked-up word
const STALL_READY = 0x11; //       value the protection cell must reach

export function loc_0929(m, carry = m.regs.fC, ptr = m.regs.hl) {
  const { mem8 } = m;

  if (carry) {
    mem8[ptr] = mem8[ptr] + 1; // overlapping-decode arm: bump the incoming cell (write wraps to a byte)
  } else {
    if (!loc_02ce(m, FILL_ROW_BLANKS)) return; // row counter not drained -> bail
    loc_02e3(m);
    mem8[ATTRACT_SUBSTATE] = mem8[ATTRACT_SUBSTATE] + 1;
  }

  loc_02b9(m);

  while (mem8[COPY_PROTECT_STALL_BYTE] !== STALL_READY) { /* stall until ready */ }

  let entry = SIGNATURE_EXPECTED_TOP;
  for (let index = SIGNATURE_COUNT; index >= 1; index--) {
    const word = loc_0c45(m, index, SIGNATURE_WORD_TABLE);
    const expected = mem8[u16(word + ENTRY_OFFSET)];
    if (mem8[entry] !== expected) throw new Error("loc_0929: ROM signature mismatch (integrity guard)");
    entry = u16(entry - 1);
  }

  fillAttributeColumns(m, FIELD_ATTRIB_SRC_07D9);
  loc_0038(m, DISPLAY_CMD_068B);
  loc_0038(m, DISPLAY_CMD_068E);
  loc_0038(m, DISPLAY_CMD_0200);
}
