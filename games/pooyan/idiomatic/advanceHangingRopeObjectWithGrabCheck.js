// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_305f } from "./loc_305f.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { FORMATION_TABLE, ROPE_SEGMENT_TILE_SRC } from "./names.js";
/**
 * advanceHangingRopeObjectWithGrabCheck — rope-cell timer handler gated by the grab test.
 *
 * First runs the rope-grab trigger test; if a grab fires it abandons the cell update entirely.
 * Otherwise it ticks the cell's frame timer and, while that has not reached zero, returns. On the
 * frame it reaches zero it re-arms the timer cell to a fixed reload, walks into the formation
 * table by the byte following the timer to drop one record's tile field, force its position byte,
 * and bump another field, advances the cell state (ix+0), then blits the segment's 2x2 tile square
 * to its video-RAM column.
 *
 * LIVE-OUT: on the not-yet-zero path HL = the timer cell and the Z flag = not-zero, both bridged
 * by the timer tick. On the zero path HL = the blit's advanced column pointer, IY = the indexed
 * formation record, and B = 0. On the grab path nothing is bridged (the update is abandoned).
 */
const RELOAD = 0x0c; //             fixed timer reload written on the zero frame
const FORMATION_STRIDE = 0x18; //   per-record stride in the formation table
const RECORD_TILE_FIELD = 0x0f; //  record tile byte (dropped by one)
const RECORD_POS_FIELD = 0x05; //   record position byte (forced)
const RECORD_DROP_FIELD = 0x06; //  record field bumped by one
const RECORD_POS_VALUE = 0xc0; //   value forced into the position byte

export function advanceHangingRopeObjectWithGrabCheck(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if (!loc_305f(m, ix & 0xff)) return; // grab fired: abandon the cell update

  const [timerAddr, reachedZero] = tickRopeCellFrameTimer(m, ix & 0xff);
  if (!reachedZero) return timerAddr; // timer still counting: HL + Z already bridged

  mem8[timerAddr] = RELOAD;

  const recordCount = (mem8[timerAddr + 1] + 1) & 0xff;
  const passes = recordCount === 0 ? 256 : recordCount;
  const record = u16(FORMATION_TABLE + FORMATION_STRIDE * passes);

  mem8[record + RECORD_TILE_FIELD] = mem8[record + RECORD_TILE_FIELD] - 1;
  mem8[record + RECORD_POS_FIELD] = RECORD_POS_VALUE;
  mem8[record + RECORD_DROP_FIELD] = mem8[record + RECORD_DROP_FIELD] + 1;
  mem8[ix] = mem8[ix] + 1;

  const columnBase = computeRopeCellVramColumn(m, ix & 0xff);
  const advancedHl = blit2x2TileBlock(m, columnBase, ROPE_SEGMENT_TILE_SRC);

  return [(m.regs.hl = advancedHl), (m.regs.iy = record), (m.regs.b = 0)];
}
