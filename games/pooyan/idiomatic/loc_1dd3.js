// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import {
  ROUND_IN_PROGRESS,
  GAME_ACTIVE_FLAG,
  ROUND_COUNTER,
  PLAY_MODE_LATCH,
  ATTRIB_MAP_BASE,
  FIELD_ATTRIB_SRC_A,
  FIELD_ATTRIB_SRC_B,
  FIELD_ATTRIB_SRC_C,
  FIELD_C_ATTRIB_DEST,
} from "./names.js";
/**
 * loc_1dd3 — paint the playfield colour/attribute map for the current field variant.
 *
 * Chooses between two jobs from the in-progress and active flags and the round counter. The
 * default job floods the attribute columns from a round-parity source table, then stamps a
 * short two-column marker. The alternate job (idle, on an even/first round, and only outside
 * attract) floods a different source table and stamps a taller single-column strip. Memory-only:
 * it writes the colour/attribute map only.
 */

const ROW_STRIDE = 0x20; // one attribute-map row
const FIELD_TILE = 0x0f; // colour code for the default two-column marker
const ALT_TILE = 0x09; // colour code for the alternate strip
const MARKER_ROWS = 4; // rows in the default marker
const STRIP_ROWS = 0x10; // rows in the alternate strip

export function loc_1dd3(m) {
  const { mem8 } = m;
  const round = mem8[ROUND_COUNTER];

  let takeAlt = false;
  if (mem8[ROUND_IN_PROGRESS] === 0 && mem8[GAME_ACTIVE_FLAG] !== 0) {
    takeAlt = (round & 0x01) !== 0 || round === 0;
  }

  if (takeAlt && mem8[PLAY_MODE_LATCH] === 0) {
    fillAttributeColumns(m, FIELD_ATTRIB_SRC_C);
    let cell = FIELD_C_ATTRIB_DEST;
    for (let row = 0; row < STRIP_ROWS; row++) {
      mem8[cell] = ALT_TILE;
      cell = u16(cell + ROW_STRIDE);
    }
    return;
  }

  fillAttributeColumns(m, (round & 0x01) !== 0 ? FIELD_ATTRIB_SRC_A : FIELD_ATTRIB_SRC_B);
  for (const col of [5, 6]) {
    let cell = ATTRIB_MAP_BASE + col;
    for (let row = 0; row < MARKER_ROWS; row++) {
      mem8[cell] = FIELD_TILE;
      cell = u16(cell + ROW_STRIDE);
    }
  }
}
