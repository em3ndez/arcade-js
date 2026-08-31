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
 * paintPlayfieldAttributeMapForVariant — repaint the playfield colour/attribute plane for the
 * current field variant.
 *
 * WHAT IT IS
 *   The screen is built from two parallel 32x32 cell planes that share one cell grid: a tile-code
 *   plane (which glyph shows in each cell) and a colour/attribute plane (the drawing recipe for
 *   that cell — its low nibble picks the 16-pen colour set, bit 6 flips the tile horizontally and
 *   bit 7 flips it vertically). This routine repaints the colour/attribute plane. It picks one of
 *   two paint jobs from the current game situation and the field variant, floods the plane with a
 *   flat background colour pattern, then stamps a small foreground colour marker on top.
 *
 * ROLE IN THE MACHINE
 *   Runs during a round/phase setup step — right after the row-by-row tile fill is armed and just
 *   before the display-list pointers for the new phase are chosen. It is the colour-plane half of
 *   staging the next field: it lays down the field's background colour bands and its marker so the
 *   tiles that get filled in are drawn in the right colours.
 *
 * ROM ADDRESS: 0x1dd3-0x1e2b.
 * GROUNDING: [seen].
 *
 * THE DECISION (which job to run)
 *   Three cells select the job: ROUND_IN_PROGRESS (0x8904), GAME_ACTIVE_FLAG (0x8806) and the low
 *   bit of ROUND_COUNTER (0x8907). The ALTERNATE job is eligible only between rounds (no round in
 *   progress) while a game is nonetheless active, and only on an odd round or on round 0. Even
 *   when eligible it is suppressed while the play-mode latch (0x8f50) is nonzero, in which case the
 *   default job runs instead. Every other situation takes the DEFAULT job.
 *
 * THE TWO JOBS
 *   DEFAULT — flood the whole colour plane in vertical bands from a round-parity source table
 *     (FIELD_ATTRIB_SRC_A on an odd round, FIELD_ATTRIB_SRC_B on an even one), then stamp a short
 *     two-column marker of colour code 0x0f, four rows tall, over columns 5 and 6.
 *   ALTERNATE — flood the colour plane from a different source table (FIELD_ATTRIB_SRC_C), then
 *     stamp a taller single-column strip of colour code 0x09, sixteen rows tall.
 *
 * LIVE-OUT: memory only — it writes the colour/attribute plane and leaves nothing a caller reads.
 */

const ROW_STRIDE = 0x20; // stride from one attribute-map cell to the cell one row below it (the plane is 0x20 cells wide)
const FIELD_TILE = 0x0f; // colour/attribute code stamped for the default job's two-column marker
const ALT_TILE = 0x09; // colour/attribute code stamped for the alternate job's vertical strip
const MARKER_ROWS = 4; // height, in rows, of the default two-column marker
const STRIP_ROWS = 0x10; // height, in rows, of the alternate single-column strip (16 rows)

export function paintPlayfieldAttributeMapForVariant(m) {
  const { mem8 } = m;
  // The round counter's low bit selects the field variant throughout: it steers both which source
  // table the flood reads and (in the eligibility test below) whether the alternate job is offered.
  const round = mem8[ROUND_COUNTER];

  // Decide whether the alternate job is eligible. It is offered only in the gap between rounds
  // (ROUND_IN_PROGRESS == 0) while a game is still active (GAME_ACTIVE_FLAG != 0), and then only on
  // an odd round or on round 0. Mid-round, or with no active game, the default job always wins.
  let takeAlt = false;
  if (mem8[ROUND_IN_PROGRESS] === 0 && mem8[GAME_ACTIVE_FLAG] !== 0) {
    takeAlt = (round & 0x01) !== 0 || round === 0;
  }

  // ALTERNATE job — taken only when eligible AND the play-mode latch (0x8f50) is clear; a nonzero
  // latch suppresses it and drops through to the default job below. Flood the colour plane from
  // source table FIELD_ATTRIB_SRC_C, then stamp a single-column vertical strip on top of it.
  if (takeAlt && mem8[PLAY_MODE_LATCH] === 0) {
    fillAttributeColumns(m, FIELD_ATTRIB_SRC_C);
    // Stamp colour code 0x09 straight down one column, 16 cells tall, from FIELD_C_ATTRIB_DEST
    // (0x811c). Each step drops one row further, which is ROW_STRIDE bytes on in the plane.
    let cell = FIELD_C_ATTRIB_DEST;
    for (let row = 0; row < STRIP_ROWS; row++) {
      mem8[cell] = ALT_TILE;
      cell = u16(cell + ROW_STRIDE);
    }
    return;
  }

  // DEFAULT job — flood the colour plane in vertical bands, choosing the source table by round
  // parity: FIELD_ATTRIB_SRC_A on an odd round, FIELD_ATTRIB_SRC_B on an even one.
  fillAttributeColumns(m, (round & 0x01) !== 0 ? FIELD_ATTRIB_SRC_A : FIELD_ATTRIB_SRC_B);
  // Stamp the two-column marker of colour code 0x0f over columns 5 and 6, four rows tall each.
  // Column N sits at ATTRIB_MAP_BASE (0x8040) + N, and each successive row is ROW_STRIDE bytes on.
  for (const col of [5, 6]) {
    let cell = ATTRIB_MAP_BASE + col;
    for (let row = 0; row < MARKER_ROWS; row++) {
      mem8[cell] = FIELD_TILE;
      cell = u16(cell + ROW_STRIDE);
    }
  }
}
