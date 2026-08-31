// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { resetBoardRamAndReseedSpawnCounters } from "./resetBoardRamAndReseedSpawnCounters.js";
import { BOARD_CLEAR_FLAG, TAMPER_STRIKES_TERMINATOR } from "./names.js";
/**
 * copyDisplayTilesIntoActorRecords — stamp a run of display tiles into successive actor records,
 * then tear the board down if it is being cleared.  ROM 0x2514-0x2526.  Grounding: [seen].
 *
 * WHAT IT IS
 *   The actor-shape painter.  Every actor -- the player, the enemies, the ropes, the objects that
 *   sail across the screen -- owns one 0x18-byte record in the arena based at 0x8a80, and the byte at
 *   offset +0x0f in a record is the display byte the video hardware reads when it draws that actor.
 *   This routine walks a run of `count` records and copies one source byte into the +0x0f display
 *   byte of each, so a whole group of actors takes on a new on-screen shape in a single pass.
 *
 * ROLE IN THE MACHINE
 *   It is entered two ways, each handing it a source row of tile codes together with a record count:
 *     - as the tail of the shape-loader seedFourRecordsAndCopyDisplayTiles (0x250f), which seats a
 *       stride of exactly one record (0x18) and a count of four and then falls straight in here to
 *       paint four actor records from a ROM tile/shape table; and
 *     - from the countdown-gated sprite-frame applier cycleActorGroupSpriteFramesOnTimer (0x66a1),
 *       which on its timer expiry picks one of two 3-tile source rows by an animation-phase bit and
 *       paints three actor records with it, cycling their animation frame.
 *   After the paint it asks whether the board it just drew into is still alive: when the board is on
 *   its way out it throws the work away and diverts into the board/HUD reset instead.
 *
 * LIVE-OUT
 *   IX = the record pointer advanced past the whole run (start + count*stride); B = 0 (the count has
 *   drained).  On the plain-return path HL = the board-clear flag address (0x89e5) and A = 0 (the
 *   teardown OR came up clear).  On the divert path A/HL/B are whatever the board/HUD reset leaves.
 */

const RECORD_TILE_FIELD = 0x0f; // +0x0f within a 0x18-byte actor record: the display byte the video hardware reads to draw that actor -- the copied source tile is stamped here

export function copyDisplayTilesIntoActorRecords(m, src = m.regs.hl, count = m.regs.b, stride = m.regs.de, ix = m.regs.ix, cmdLow = m.regs.e) {
  const { mem8 } = m;

  // Paint the run.  `src` (HL) points at the first byte of the tile-code source row; `ix` points at
  // the first actor record to paint; `stride` (DE) is one record's width (0x18) so each step lands on
  // the next record in the arena; `count` (B) is how many records to paint.  Each pass copies one
  // source byte into the current record's +0x0f display byte, then advances the source pointer by one
  // byte and the record pointer by one whole record.  The count is decremented with 8-bit wrap and
  // the run ends when it reaches zero (at least one record is always painted).
  let source = src;
  let record = ix;
  let remaining = count;
  do {
    mem8[record + RECORD_TILE_FIELD] = mem8[source];
    source = u16(source + 1);
    record = u16(record + stride);
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);

  // Board-teardown check.  Two flags decide whether the records just painted are about to be thrown
  // away.  TAMPER_STRIKES_TERMINATOR (0x8df9) is the anti-tamper strike counter the terminator
  // match-scan guard bumps; BOARD_CLEAR_FLAG (0x89e5) is set when the board is being cleared and the
  // per-frame object updates are frozen for the level-intro path.  OR them together: if either is
  // non-zero the paint went into a board that is on its way out.
  const divert = mem8[TAMPER_STRIKES_TERMINATOR] | mem8[BOARD_CLEAR_FLAG];
  if (divert !== 0) {
    // Board going away: hand off to the board/HUD reset (0x2527), which enqueues the reset display
    // command (class 0x08, its low byte supplied by `cmdLow` -- the E register) then reseeds the
    // spawn-phase / rope-draw counters and clears the board RAM.  It produces the A/HL/B result and
    // leaves the record pointer alone, so IX still carries where this paint finished.
    const fill = resetBoardRamAndReseedSpawnCounters(m, cmdLow); // sets A/HL/B for the reset; leaves IX alone
    return [(m.regs.ix = record), fill];
  }
  // Board still alive: nothing to tear down.  Leave IX advanced past the run, park HL on the
  // board-clear flag address, zero B (the count is fully drained), and A carries the teardown OR
  // result, which is 0 on this path.
  return [(m.regs.ix = record), (m.regs.hl = BOARD_CLEAR_FLAG), (m.regs.b = 0), (m.regs.a = divert)];
}
