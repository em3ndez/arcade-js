// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { testHangingRopeGrabConnect } from "./testHangingRopeGrabConnect.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { FORMATION_TABLE, ROPE_SEGMENT_TILE_SRC } from "./names.js";
/**
 * advanceHangingRopeObjectWithGrabCheck — rope-cell state-3 handler, gated by the grab test.
 *
 * ROM 0x2f01-0x2f2e. Grounding: [seen].
 *
 * WHAT IT IS
 *   One of the four per-rope-cell handlers. Pooyan's playfield hangs a set of vertical ropes down
 *   through the field; an object rides each active rope and is carried down it a step at a time.
 *   Every active rope cell keeps a small record whose first byte is its STATE (0..4); a cell
 *   dispatcher reads that state and, on state-minus-one, routes the cell to one of four handlers.
 *   This is the handler for state 3 — the "carry down" step for a cell whose hung object has
 *   already been carried once (state 2), and which is now close enough that the player may grab it.
 *
 * ITS ROLE IN THE MACHINE
 *   This is the state-2 carry-down step with one addition: before doing anything else it runs the
 *   rope-grab trigger test testHangingRopeGrabConnect. That test looks a catch-window half-width up from a per-cell
 *   table (keyed by the cell index) and compares it against a window around the player coordinate
 *   PLAYER_Y (0x8a84) — a cell labelled a vertical position but read here as the player's
 *   horizontal position for the catch window. With the player standing inside that window, and only
 *   when neither the wave-teardown state WAVE_TEARDOWN_STATE (0x8f24) nor the formation-launch state
 *   0x8f08 is busy, the test fires the grab: it sets GRAB_ACTIVE_FLAG (0x8d32) and takes over, and
 *   this handler abandons the cell update for the frame — the caught object stops descending.
 *
 *   When no grab fires, the cell behaves exactly like its state-2 sibling. A frame timer paces the
 *   animation: on most frames this handler just ticks the timer and leaves; only on the frame the
 *   timer runs out does it do one animation step:
 *     - reloads the just-elapsed timer cell to a fixed 0x0c,
 *     - walks into the enemy-formation record table FORMATION_TABLE (0x8c30) by a per-cell index
 *       and nudges that record's tile / position / drop fields to move the hung object down a notch,
 *     - advances the cell's own STATE byte from 3 to 4 (so next time the cell is handled by the
 *       retract step), and
 *     - repaints the rope segment's 2x2 tile block at the cell's on-screen column.
 *   The picture lives in two parallel planes over one 32x32 cell grid: colour RAM at 0x8000-0x83FF
 *   and the tile-code video RAM at 0x8400-0x87FF (page 0x84); the blit here writes the video-RAM
 *   (tile-code) plane.
 *
 * LIVE-OUT
 *   On the grab path: nothing is bridged — the update is abandoned. On the not-yet-zero path: HL =
 *   the timer cell address and the Z flag = not-zero, both bridged by the timer tick (the cell
 *   dispatch returns on not-zero). On the zero (animation-step) path: HL = the blit's advanced
 *   column pointer, IY = the indexed formation record, and B = 0 (the record-walk repeat counter,
 *   drained to zero by the walk). All three are bridged for the rope-cell dispatch that follows.
 */
const RELOAD = 0x0c; //             fixed timer reload written on the zero frame
const FORMATION_STRIDE = 0x18; //   per-record stride in the formation table
const RECORD_TILE_FIELD = 0x0f; //  record tile byte (dropped by one)
const RECORD_POS_FIELD = 0x05; //   record position byte (forced)
const RECORD_DROP_FIELD = 0x06; //  record field bumped by one
const RECORD_POS_VALUE = 0xc0; //   value forced into the position byte

export function advanceHangingRopeObjectWithGrabCheck(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Grab gate. Run the rope-grab trigger test first. The cell record is seated in the IX index
  // register; its low byte (IX & 0xff) carries the low two bits that key the per-cell catch-window
  // table. If the player is inside the window (and no teardown/formation-launch state is busy) the
  // test fires the grab itself and reports caller-skip, and this handler returns at once, leaving
  // the descent frozen for the caught object. Only a clear test (no grab) falls through.
  if (!testHangingRopeGrabConnect(m, ix & 0xff)) return; // grab fired: abandon the cell update

  // Tick this cell's frame timer. The same low two bits of IX pick which of the four stride-2
  // rope-cell timers to decrement. The tick hands back that timer's address and whether it just
  // hit zero.
  const [timerAddr, reachedZero] = tickRopeCellFrameTimer(m, ix & 0xff);
  if (!reachedZero) return timerAddr; // timer still counting: HL + Z already bridged

  // --- The timer just elapsed: perform one animation step for the hung object. ---

  // Reload the cell's just-elapsed timer byte (HL) to the fixed cadence 0x0c, so the next carry-down
  // step is timed the same fixed number of frames out.
  mem8[timerAddr] = RELOAD;

  // Select which enemy-formation record this cell's object belongs to. The byte immediately after
  // the timer in the stride-2 timer bank holds this cell's record index; add one to it (a zero
  // repeat count means a full 256 passes, matching the count-down-then-loop walk it stands in for).
  const recordCount = (mem8[timerAddr + 1] + 1) & 0xff;
  const passes = recordCount === 0 ? 256 : recordCount;
  // Step that many 0x18-byte strides from the formation table base FORMATION_TABLE (0x8c30) to land
  // on the record. u16 keeps the pointer inside the 16-bit address space.
  const record = u16(FORMATION_TABLE + FORMATION_STRIDE * passes);

  // Nudge the record to carry its object one notch down the rope. State 3 moves it the opposite way
  // from state 2: drop the tile byte (+0x0f) by one, force the position byte (+0x05) to 0xc0, and
  // bump the height/drop field (+0x06) up by one.
  mem8[record + RECORD_TILE_FIELD] = mem8[record + RECORD_TILE_FIELD] - 1;
  mem8[record + RECORD_POS_FIELD] = RECORD_POS_VALUE;
  mem8[record + RECORD_DROP_FIELD] = mem8[record + RECORD_DROP_FIELD] + 1;
  // Advance the cell's own STATE byte (the record's first byte, at IX+0) from 3 to 4, so on a later
  // frame this cell is handled by the state-4 retract step instead of this one.
  mem8[ix] = mem8[ix] + 1;

  // Repaint the rope segment. First turn this cell's low-two-bit column index into its video-RAM
  // column base (page 0x84), then stamp the 2x2 rope-segment tile block from the ROM source
  // ROPE_SEGMENT_TILE_SRC (0x2dfe) at that column. The blit returns the column pointer advanced one
  // row down.
  const columnBase = computeRopeCellVramColumn(m, ix & 0xff);
  const advancedHl = blit2x2TileBlock(m, columnBase, ROPE_SEGMENT_TILE_SRC);

  // Bridge the three values the rope-cell dispatch reads after this step: HL = advanced column
  // pointer, IY = the indexed formation record, B = 0 (the drained record-walk counter).
  return [(m.regs.hl = advancedHl), (m.regs.iy = record), (m.regs.b = 0)];
}
