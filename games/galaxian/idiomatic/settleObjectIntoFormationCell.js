// SPDX-License-Identifier: GPL-3.0-only
/**
 * settleObjectIntoFormationCell — state-6 handler: fly a returning diver home into its formation cell.
 *
 * WHAT IT IS
 *   One of the sixteen object-AI state handlers, dispatched from the 0x0ce6 rst-28 jump table on a
 *   record's state index (record byte 2 == 6). It is how an alien that peeled off and dived comes back
 *   to rest: each frame it re-derives where the sprite belongs from its packed grid cell, advances the
 *   record's frame counter one tick, and — once the counter catches up to the just-computed target —
 *   retires the object back into the standing formation (see mechanisms.md "The object-AI driver",
 *   state 6).
 *
 * ROLE IN THE MACHINE
 *   Runs on one object record per call (IX). positionObjectFromGridCell (record's packed cell -> screen
 *   X/Y) is the same reposition the renderer's field convention uses. When the object has arrived, its
 *   formation-cell flag in FLAG_BITS_BASE (0x4100 — the 128-byte live-alien bitmap) is set to 1, so the
 *   block-occupancy summaries and the sway see the alien back in the grid; the landing is announced by
 *   enqueueing a command word keyed by the cell. A not-yet-arrived object with a small even gap gets its
 *   phase nudged so the settle animates smoothly; a large (>=25) or odd gap is left to close on later
 *   frames.
 *
 * ROM 0x0f07.  Grounding: [seen]. Cell: FLAG_BITS_BASE (0x4100).
 *
 * LIVE-OUT: the object record (fields 0/3/5), FLAG_BITS_BASE+cell on arrival, and the command queue. No
 * register contract; obj defaults to m.regs.ix.
 */
import { positionObjectFromGridCell } from "./positionObjectFromGridCell.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { FLAG_BITS_BASE } from "./names.js";

// Object-record field offsets (base = obj).
const ACTIVE = 0;    // primary active flag
const FRAME = 3;     // frame counter (also the position field the reposition rewrites)
const PHASE = 5;     // phase value nudged up/down
const DIRECTION = 6; // bit0 picks the nudge direction
const CELL = 7;      // packed grid cell

const GAP_LIMIT = 25; // gaps at or above this are ignored

export function settleObjectIntoFormationCell(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Advance the frame counter by one (8-bit wrap). Snapshot it now, because the reposition below
  // overwrites the same field (record+3 doubles as the counter and the position field it rewrites), so
  // we must re-store our incremented value afterward.
  const frame = (mem8[obj + FRAME] + 1) & 0xff;
  positionObjectFromGridCell(m, obj);      // rewrites the position fields from the cell
  // The reposition just parked the target value into record+3; read it back as the "arrived" mark, then
  // restore our advancing frame counter over it.
  const positioned = mem8[obj + FRAME];
  mem8[obj + FRAME] = frame;

  // Gap = how far the counter still is from the target (8-bit). Zero means the object has arrived home.
  const gap = (positioned - frame) & 0xff;
  if (gap === 0) {
    // Counter caught up: deactivate, flag the cell, enqueue the command word (D:E = 0:cell).
    // Clear the primary active flag (record+0): the diver is no longer a moving object.
    mem8[obj + ACTIVE] = 0;
    // Read the packed grid cell (record+7) and light its bit in the live-alien bitmap, putting the
    // alien back into the standing formation the occupancy summaries scan.
    const cell = mem8[obj + CELL];
    mem8[FLAG_BITS_BASE + cell] = 1;
    // Announce the landing: the command word's high byte is 0 (channel) and low byte is the cell; the
    // trailing FLAG_BITS_BASE+cell is the caller pointer enqueueCommandWord preserves and returns.
    return enqueueCommandWord(m, cell, FLAG_BITS_BASE + cell);
  }

  // Not arrived yet. Only a small, even gap animates the phase; a gap at/above GAP_LIMIT (25) or an odd
  // gap is left untouched so the object keeps closing without a phase kick this frame.
  if (gap >= GAP_LIMIT || (gap & 1)) return; // large or odd gap: no nudge

  // Small even gap: nudge the phase counter (record+5) one step in the direction the record's direction
  // bit (record+6 bit0) selects — down if set, up if clear — smoothing the approach into the cell.
  if (mem8[obj + DIRECTION] & 0x01) {
    mem8[obj + PHASE]--; // direction bit set: step down
  } else {
    mem8[obj + PHASE]++; // direction bit clear: step up
  }
}
