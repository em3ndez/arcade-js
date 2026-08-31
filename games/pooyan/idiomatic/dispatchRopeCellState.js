// SPDX-License-Identifier: GPL-3.0-only
import { spawnHangingRopeObject } from "./spawnHangingRopeObject.js";
import { advanceHangingRopeObject } from "./advanceHangingRopeObject.js";
import { advanceHangingRopeObjectWithGrabCheck } from "./advanceHangingRopeObjectWithGrabCheck.js";
import { retractRopeSegment } from "./retractRopeSegment.js";

/**
 * dispatchRopeCellState — per-rope-cell state dispatcher.
 *
 * ROM 0x2e36-0x2e3c. Grounding: [seen].
 *
 * WHAT IT IS
 *   Pooyan's playfield hangs a set of vertical ropes down the screen; a grabbable object rides
 *   each active rope and is carried down it one notch at a time. Every active rope cell keeps a
 *   small record whose first byte is the cell's STATE (a value 0..4). The rope driver walks the
 *   array of cell records once per pass and hands each record here. This routine is the tiny
 *   gatekeeper: it reads one cell's state byte and routes the cell to the single handler that
 *   owns that state. It decides; it does not itself touch the rope.
 *
 * ITS ROLE IN THE MACHINE
 *   Four handlers make up the whole life of one rope cell, and this dispatcher is what sequences
 *   them from frame to frame as each cell walks its own state byte forward:
 *     - state 1  spawnHangingRopeObject                — seed a hung object onto the rope and
 *                                                        blit its first segment,
 *     - state 2  advanceHangingRopeObject              — carry the object down one step,
 *     - state 3  advanceHangingRopeObjectWithGrabCheck — carry it down, but first test whether
 *                                                        the player has caught it,
 *     - state 4  retractRopeSegment                    — pull a spent segment back up and recycle
 *                                                        the cell.
 *   A cell whose state is 0 is inactive and is skipped outright. For any live cell the state byte
 *   MINUS ONE is the selector, so states 1..4 map to selectors 0..3 and thus to the four handlers
 *   above, in order (this mirrors the hardware jump table that sits inline in ROM right after the
 *   dispatch, at 0x2e3d, whose entries point at 0x2e5e / 0x2ecb / 0x2f01 / 0x2f2f). The cell
 *   record pointer is passed straight through to whichever handler is chosen.
 *
 * LIVE-OUT
 *   None of its own — a void dispatcher. Every effect belongs to the handler it hands off to, and
 *   whatever that handler leaves behind — in the cell record, in work RAM, and in the tile-code
 *   video RAM on page 0x84 — is the whole result of this call.
 */
export function dispatchRopeCellState(m, rec = m.regs.ix) {
  // Read the cell record's first byte: the cell STATE. By default `rec` is the index register the
  // rope driver was walking, so this reads the state byte of the cell currently being serviced.
  const state = m.mem8[rec];
  // State 0 marks an inactive cell — no object rides this rope right now, so there is nothing to
  // animate and we return immediately, leaving the record untouched.
  if (state === 0) return; // inactive cell
  // States 1..4 pick the four handlers in order. The selector is (state - 1), masked to a byte to
  // match the 8-bit index the hardware jump table uses; states 1,2,3,4 become selectors 0,1,2,3.
  // Each arm tail-calls its handler with the SAME cell record, and that handler returns straight
  // back to the rope driver that invoked us — this routine adds no work of its own around the call.
  switch ((state - 1) & 0xff) {
    // Selector 0 = cell state 1: seed a hung object into a free spawn-object slot and blit the
    // rope's first segment tile.
    case 0: return spawnHangingRopeObject(m, rec);
    // Selector 1 = cell state 2: on the frame the cell timer elapses, nudge the object one notch
    // down the rope and repaint the segment.
    case 1: return advanceHangingRopeObject(m, rec);
    // Selector 2 = cell state 3: the same "carry down" step, but gated first by the player-grab
    // test — if the player is under the falling object it is caught instead of carried.
    case 2: return advanceHangingRopeObjectWithGrabCheck(m, rec);
    // Selector 3 = cell state 4: retract one spent rope segment and recycle the cell back to the
    // start of its state cycle.
    case 3: return retractRopeSegment(m, rec);
  }
}
