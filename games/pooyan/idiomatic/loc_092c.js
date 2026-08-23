// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_02ce } from "./loc_02ce.js";
import { loc_02e3 } from "./loc_02e3.js";
import { loc_02b9 } from "./loc_02b9.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0038 } from "./loc_0038.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import {
  ATTRACT_SUBSTATE,
  COPY_PROTECT_STALL_BYTE,
  SIGNATURE_WORD_TABLE,
  SIGNATURE_EXPECTED_TOP,
  FIELD_ATTRIB_SRC_07D9,
  DISPLAY_CMD_068B,
  DISPLAY_CMD_068E,
  DISPLAY_CMD_0200,
} from "./names.js";

/**
 * loc_092c — attract sub-state 2 (dispatched from the attract state table).
 *
 * Frame-gated by the row-by-row tilemap clear: ticks one row-batch and returns while rows remain.
 * Once drained it re-arms the fill, advances the attract sub-state, and zeroes the board-init RAM.
 * Then the anti-tamper checks: spin until the copy-protect image byte reads its expected value,
 * then verify seven signature bytes — each expected byte (descending from the top of the block)
 * must equal the byte a fixed offset past word-table[b], for b = 7..1. A mismatch jumps into the
 * data table (a corrupting trap), modeled as a throw. On success it floods the attribute map and
 * queues three display commands. LIVE-OUT: none — a void attract handler.
 */

const CLEAR_TILES_PER_FRAME = 0x19; // row-batch width fed to the tilemap clear
const STALL_MATCH = 0x11; // the copy-protect image byte's expected value
const SIG_COUNT = 0x07; // signature bytes verified (b = 7..1; index 0 skipped)
const SIG_FIELD_OFFSET = 0x1c; // byte offset inside each word-table[b] record

export function loc_092c(m) {
  const { mem8 } = m;

  if (!loc_02ce(m, CLEAR_TILES_PER_FRAME)) return; // rows still draining -> wait a frame
  loc_02e3(m); // re-arm the fill from the fixed start
  mem8[ATTRACT_SUBSTATE] = u8(mem8[ATTRACT_SUBSTATE] + 1); // advance the attract sub-state
  loc_02b9(m); // zero the board-init RAM regions

  while (mem8[COPY_PROTECT_STALL_BYTE] !== STALL_MATCH) { /* copy-protect stall */ }

  let sample = SIGNATURE_EXPECTED_TOP;
  for (let b = SIG_COUNT; b !== 0; b--) {
    const entry = loc_0c45(m, b, SIGNATURE_WORD_TABLE); // word-table[b]
    if (mem8[sample] !== mem8[u16(entry + SIG_FIELD_OFFSET)])
      throw new Error("loc_092c: program-signature mismatch -> tamper-trap jump into the data table");
    sample = u16(sample - 1);
  }

  fillAttributeColumns(m, FIELD_ATTRIB_SRC_07D9); // paint the attribute map
  loc_0038(m, DISPLAY_CMD_068B); // queue three display commands
  loc_0038(m, DISPLAY_CMD_068E);
  loc_0038(m, DISPLAY_CMD_0200);
}
