// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0010 } from "./loc_0010.js";
import { loc_5433 } from "./loc_5433.js";
import { ROUND_COUNTER, FORMATION_TABLE, FORMATION_SPAWN_INDEX, FORMATION_STATE_ROW2 } from "./names.js";
/**
 * loc_540d — enemy-formation spawn driver.
 *
 * Gated on the round counter's low bit: an even round does nothing. On an odd round it blanks two
 * six-byte state rows (the formation spawn-index row and the second state row), then initialises the
 * three formation records (stride RECORD_STRIDE) in turn. Each init reads and bumps the spawn index
 * the blank just zeroed, so the three records draw successive parameter-table entries.
 *
 * LIVE-OUT: none — a void per-frame driver; its caller reads nothing back.
 */

const RECORD_STRIDE = 0x18; // formation record stride
const RECORD_COUNT = 3;
const ROW_BYTES = 6;

export function loc_540d(m) {
  const { mem8 } = m;
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return; // even round -> gate closed

  loc_0010(m, FORMATION_SPAWN_INDEX, 0x00, ROW_BYTES);
  loc_0010(m, FORMATION_STATE_ROW2, 0x00, ROW_BYTES);

  let rec = FORMATION_TABLE;
  for (let n = 0; n < RECORD_COUNT; n++) {
    loc_5433(m, rec); // init one record (bumps the shared spawn index)
    rec = u16(rec + RECORD_STRIDE);
  }
}
