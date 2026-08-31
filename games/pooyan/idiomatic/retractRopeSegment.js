// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { fillByteRun } from "./fillByteRun.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  ROPE_SEGMENT_COUNT, ROUND_COUNTER, DIFFICULTY_DSW, FORMATION_TABLE,
  RETRACT_ANIM_TABLE, ROPE_RETRACT_TILE_SRC,
} from "./names.js";
/**
 * retractRopeSegment — the state-4 handler for a single rope cell.  ROM 0x2f2f.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The rope is the vertical column of segments that grows down the playfield and carries the
 *   grabbable hanging objects.  Each active segment is tracked by a per-cell record; the rope driver
 *   walks those records every frame and dispatches each one by its state byte.  A cell's state byte
 *   equal to 4 selects THIS handler, whose job is to pull one segment back up (retract it): update
 *   the segment's attribute, wipe the formation record it was feeding, recycle the cell, and repaint
 *   the tile.
 *   The cell record is addressed through the index register (its low byte selects one of the four
 *   stride-2 frame timers), and `rec` points at the cell's state byte (record + 0).
 *
 * ROLE IN THE MACHINE
 *   One of the small family of per-cell rope handlers.  A segment is not yanked instantly: retract
 *   runs once per elapsed cell-timer tick, and each pass handles exactly one segment, recycling the
 *   cell back to state 1 so the machine keeps re-entering here until the rope is empty.
 *
 * LIVE-OUT
 *   None — this is a void handler.  Its whole effect is side effects in RAM and video RAM: it writes
 *   the merged attribute into the timer cell, zeroes one formation record, resets the cell's state
 *   byte to 1, and blits the 2x2 retract tile into the cell's video-RAM column.
 */

// The retract-animation table (0x2f93) is indexed by (round>>2); values past index 3 do not exist,
// so the round term is clamped here.
const ANIM_ROW_CLAMP = 3;
// The per-segment attribute table has 0x20 entries; a segment index beyond the last is clamped to
// the final entry so a long rope keeps reusing the last attribute rather than reading past the table.
const SEG_ATTR_CLAMP = 0x1f;
// Each formation-object record is 0x18 bytes; this is the stride used to index and to clear one.
const RECORD_STRIDE = 0x18;
// A timer-cell address whose low byte is 0x28 marks the terminal (last) rope column — its paired
// cell does not exist, so the attribute-merge step is skipped for it.
const TERMINAL_COLUMN = 0x28;
// When merging, only these bits of the paired cell's byte are carried across into the new attribute.
const ATTR_MERGE_MASK = 0x1c;

export function retractRopeSegment(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Tick this cell's frame timer (the record's low byte picks one of the four stride-2 timers) and
  // learn whether it just reached zero.  `timer` is the address of the selected timer cell.  The
  // segment is retracted only on the frame the timer expires — otherwise leave the rope untouched.
  const [timer, expired] = tickRopeCellFrameTimer(m, rec & 0xff);
  if (!expired) return;
  // Nothing to retract once the rope has fully collapsed: ROPE_SEGMENT_COUNT (0x8931) is the number
  // of extended segments, and a zero count means the column is already empty.
  if (mem8[ROPE_SEGMENT_COUNT] === 0) return;

  // Choose the retract-animation pointer.  ROUND_COUNTER (0x8907) advances the difficulty of the
  // animation as the game progresses: round>>2 selects the row, clamped so it never runs off the
  // 4-row table.
  const row = Math.min(mem8[ROUND_COUNTER] >> 2, ANIM_ROW_CLAMP);
  // The cabinet difficulty bit (bit 2 of DIFFICULTY_DSW, 0x8820) shifts the selection to a harder
  // set of animations: (bit2)>>1 contributes 0 or 2 to the index into RETRACT_ANIM_TABLE (0x2f93),
  // a word table whose entry is the base pointer of this round's per-segment attribute list.
  const animPtr = fetchWordFromTableIndex(m, ((mem8[DIFFICULTY_DSW] & 0x04) >> 1) + row, RETRACT_ANIM_TABLE);
  // Pick which segment's attribute to read: the topmost still-extended segment (count - 1), clamped
  // to the last table entry so an over-long rope reuses the final attribute instead of overrunning.
  const seg = Math.min((mem8[ROPE_SEGMENT_COUNT] - 1) & 0xff, SEG_ATTR_CLAMP);
  // Read that segment's attribute byte out of the animation list selected above.
  const [attr] = fetchByteFromTableIndex(m, animPtr, seg);

  // Merge the attribute into the timer cell.  The segment's own attribute is the base value;
  // for every column except the terminal one the paired (previous) cell two bytes back contributes
  // its masked attribute bits so adjacent segments stay consistent.
  let merged = attr;
  if ((timer & 0xff) !== TERMINAL_COLUMN) {
    merged = (mem8[timer - 2] & ATTR_MERGE_MASK) + attr; // carry the paired cell's bits
  }
  mem8[timer] = merged;

  // Clear the formation record this segment was feeding.  The byte just after the timer cell is the
  // record index (biased by 1); it selects one 0x18-byte slot in FORMATION_TABLE (0x8c30), which is
  // then wiped to zero so the hanging object it carried is removed as the segment is pulled up.
  const iterations = ((mem8[u16(timer + 1)] + 1) & 0xff) || 256; // djnz: 0 wraps to 256
  fillByteRun(m, u16(FORMATION_TABLE + RECORD_STRIDE * iterations), 0, RECORD_STRIDE);

  // Recycle the cell: reset its state byte (record + 0) to 1 so the rope driver re-enters the normal
  // per-cell cycle on the next tick, then repaint the segment with the 2x2 retract tile
  // (ROPE_RETRACT_TILE_SRC, 0x2e1a) at the video-RAM column computed from this cell's index.
  mem8[rec] = 1;
  blit2x2TileBlock(m, computeRopeCellVramColumn(m, rec & 0xff), ROPE_RETRACT_TILE_SRC);
}
