// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { ROUND_COUNTER, FORMATION_TABLE, ROPE_SEGMENT_TILE_SRC_ALT } from "./names.js";
/**
 * advanceHangingRopeObject — rope-cell timer handler.
 *
 * Ticks the cell's frame timer; while it has not reached zero the routine returns. On the frame it
 * hits zero it writes a tile index derived from the round counter (doubled, then biased, with the
 * round clamped) into the timer cell, walks into the formation table by the following byte to bump
 * that record's tile field, clear its position byte and drop another field, bumps the cell's own
 * count, and finally blits the segment's 2x2 tile square to its video-RAM column.
 *
 * LIVE-OUT: on the not-yet-zero path HL = the timer cell address and the Z flag = not-zero, both
 * bridged by the timer tick. On the zero path HL = the blit's advanced column pointer, IY = the
 * indexed formation record, and B = 0 (drained counter). All bridged for the rope-cell dispatch.
 */

const ROUND_CLAMP = 0x10; //     upper bound applied to the round before it forms the tile index
const TILE_BIAS = 0x18; //       added after doubling to form the tile index
const FORMATION_STRIDE = 0x18; // per-record stride in the formation table
const RECORD_TILE_FIELD = 0x0f; //  formation record's tile byte (bumped)
const RECORD_POS_FIELD = 0x05; //   formation record's position byte (cleared)
const RECORD_DROP_FIELD = 0x06; //  formation record's field dropped by one

export function advanceHangingRopeObject(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const [timerAddr, reachedZero] = tickRopeCellFrameTimer(m, ix & 0xff);
  if (!reachedZero) return timerAddr; // timer still counting: HL + Z already bridged

  const round = mem8[ROUND_COUNTER];
  const clamped = round < ROUND_CLAMP ? round : ROUND_CLAMP;
  mem8[timerAddr] = (clamped << 1) + TILE_BIAS;

  const recordCount = (mem8[timerAddr + 1] + 1) & 0xff;
  const passes = recordCount === 0 ? 256 : recordCount;
  const record = u16(FORMATION_TABLE + FORMATION_STRIDE * passes);

  mem8[record + RECORD_TILE_FIELD] = mem8[record + RECORD_TILE_FIELD] + 1;
  mem8[record + RECORD_POS_FIELD] = 0x00;
  mem8[record + RECORD_DROP_FIELD] = mem8[record + RECORD_DROP_FIELD] - 1;
  mem8[ix] = mem8[ix] + 1;

  const columnBase = computeRopeCellVramColumn(m, ix & 0xff);
  const advancedHl = blit2x2TileBlock(m, columnBase, ROPE_SEGMENT_TILE_SRC_ALT);

  return [(m.regs.hl = advancedHl), (m.regs.iy = record), (m.regs.b = 0)];
}
