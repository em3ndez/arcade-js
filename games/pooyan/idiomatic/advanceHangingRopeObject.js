// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { ROUND_COUNTER, FORMATION_TABLE, ROPE_SEGMENT_TILE_SRC_ALT } from "./names.js";
/**
 * advanceHangingRopeObject — rope-cell state-2 timer handler (carry the hung object down).
 *
 * ROM 0x2ecb-0x2f00. Grounding: [seen].
 *
 * WHAT IT IS
 *   One of the four per-rope-cell handlers. Pooyan's playfield hangs a set of vertical ropes;
 *   an object rides each active rope and is carried down it a step at a time. Every active rope
 *   cell keeps a small record whose first byte is its STATE (0..4); a cell dispatcher reads that
 *   state and, on state-minus-one, routes the cell to one of four handlers. This is the handler
 *   for state 2 — the "carry down" step for a cell whose object is already on the rope.
 *
 * ITS ROLE IN THE MACHINE
 *   The cell has a frame timer that paces the animation. On most frames this handler just ticks
 *   that timer and leaves; only on the frame the timer runs out does it do one animation step:
 *     - stamps a round-derived value into the just-elapsed timer cell,
 *     - walks into the enemy-formation record table by a per-cell index and nudges that record's
 *       tile / position / drop fields to move the hung object down one notch,
 *     - advances the cell's own STATE byte from 2 to 3 (so next time the cell is handled by the
 *       grab-check variant of this step), and
 *     - repaints the rope segment's 2x2 tile block at the cell's on-screen column.
 *   The picture lives in two parallel planes over one 32x32 cell grid: colour RAM at
 *   0x8000-0x83FF and the tile-code video RAM at 0x8400-0x87FF (page 0x84); the blit here writes
 *   the video-RAM (tile-code) plane.
 *
 * LIVE-OUT
 *   On the not-yet-zero path: HL = the timer cell address and the Z flag = not-zero, both bridged
 *   by the timer tick (the cell dispatch returns on not-zero). On the zero (animation-step) path:
 *   HL = the blit's advanced column pointer, IY = the indexed formation record, and B = 0 (the
 *   record-walk repeat counter, drained to zero by the walk). All three are bridged for the
 *   rope-cell dispatch that follows.
 */

const ROUND_CLAMP = 0x10; //        round ceiling: the round is pinned to at most 0x10 before forming the value
const TILE_BIAS = 0x18; //          added after doubling to form the value stamped into the timer cell
const FORMATION_STRIDE = 0x18; //   per-record stride in the enemy-formation record table (0x8c30)
const RECORD_TILE_FIELD = 0x0f; //  formation record's tile byte (bumped up one, moving the object's tile)
const RECORD_POS_FIELD = 0x05; //   formation record's position byte (cleared to 0 on this step)
const RECORD_DROP_FIELD = 0x06; //  formation record's drop/height field (dropped by one on this step)

export function advanceHangingRopeObject(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Tick this cell's frame timer. The cell record is seated in the IX index register, and its
  // low byte (IX & 0xff) carries the low two bits that pick which of the four stride-2 rope-cell
  // timers to decrement. The tick hands back that timer's address and whether it just hit zero.
  const [timerAddr, reachedZero] = tickRopeCellFrameTimer(m, ix & 0xff);
  if (!reachedZero) return timerAddr; // timer still counting: return this frame, HL + Z already bridged

  // --- The timer just elapsed: perform one animation step for the hung object. ---

  // Form a value from the round counter ROUND_COUNTER (0x8907): pin the round to at most 0x10,
  // double it, then bias by 0x18. Higher rounds therefore make a larger value, up to the clamp.
  const round = mem8[ROUND_COUNTER];
  const clamped = round < ROUND_CLAMP ? round : ROUND_CLAMP;
  // Stamp that round-derived value into the cell's just-elapsed timer byte (HL). On this step the
  // timer cell carries the object's animation value rather than a fresh countdown.
  mem8[timerAddr] = (clamped << 1) + TILE_BIAS;

  // Select which enemy-formation record this cell's object belongs to. The byte immediately after
  // the timer in the stride-2 timer bank holds this cell's record index; add one to it (a zero
  // repeat count means a full 256 passes, matching the count-down-then-loop walk below).
  const recordCount = (mem8[timerAddr + 1] + 1) & 0xff;
  const passes = recordCount === 0 ? 256 : recordCount;
  // Step that many 0x18-byte strides from the formation table base FORMATION_TABLE (0x8c30) to
  // land on the record. u16 keeps the pointer inside the 16-bit address space.
  const record = u16(FORMATION_TABLE + FORMATION_STRIDE * passes);

  // Nudge the record to carry its object one notch down the rope: bump the tile byte (+0x0f) up,
  // clear the position byte (+0x05) to 0, and drop the height/drop field (+0x06) by one.
  mem8[record + RECORD_TILE_FIELD] = mem8[record + RECORD_TILE_FIELD] + 1;
  mem8[record + RECORD_POS_FIELD] = 0x00;
  mem8[record + RECORD_DROP_FIELD] = mem8[record + RECORD_DROP_FIELD] - 1;
  // Advance the cell's own STATE byte (the record's first byte, at IX+0) from 2 to 3, so on a later
  // frame this cell is handled by the state-3 grab-check step instead of this one.
  mem8[ix] = mem8[ix] + 1;

  // Repaint the rope segment. First turn this cell's low-two-bit column index into its video-RAM
  // column base (page 0x84), then stamp the 2x2 rope-segment tile block from the ROM source
  // ROPE_SEGMENT_TILE_SRC_ALT (0x2e1e) at that column. The blit returns the column pointer
  // advanced one row down.
  const columnBase = computeRopeCellVramColumn(m, ix & 0xff);
  const advancedHl = blit2x2TileBlock(m, columnBase, ROPE_SEGMENT_TILE_SRC_ALT);

  // Bridge the three values the rope-cell dispatch reads after this step: HL = advanced column
  // pointer, IY = the indexed formation record, B = 0 (the drained record-walk counter).
  return [(m.regs.hl = advancedHl), (m.regs.iy = record), (m.regs.b = 0)];
}
