// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { queueSoundCommand0D } from "./queueSoundCommand0D.js";
import {
  GRAB_WINDOW_TABLE,
  PLAYER_Y,
  FORMATION_STATE,
  WAVE_TEARDOWN_STATE,
  GRAB_ACTIVE_FLAG,
} from "./names.js";
/**
 * testHangingRopeGrabConnect — rope-grab trigger test for the object hanging on one descending rope cell.
 *
 * WHAT IT IS
 *   The catch test that decides, on a single rope cell's update frame, whether the player has
 *   lined up under the object riding that cell closely enough to snatch it off the rope. Enemies
 *   descend on a growing vertical rope, each carrying a grabbable object; this routine is the
 *   moment-of-catch check for one of those objects. It answers a single yes/no question — did the
 *   grab connect this frame? — and reports it as a boolean.
 *
 * ROLE IN THE MACHINE
 *   This is the gate at the head of the state-3 rope-cell handler, advanceHangingRopeObjectWithGrabCheck.
 *   That handler runs this test first: if the grab connects, the handler abandons the rest of the
 *   cell's update for the frame (the object is caught, so there is nothing left to advance). If the
 *   grab does not connect, the handler proceeds to tick the cell timer and carry the object one
 *   step further down the rope. When a grab does fire, it also latches the whole grab subsystem
 *   busy (GRAB_ACTIVE_FLAG), which other per-frame routines watch to suspend spawning and wave
 *   events while the catch animation plays out.
 *
 * ROM: 0x305f-0x3086.  The catch-window reference values live in the ROM table at
 *   GRAB_WINDOW_TABLE (0x3087), immediately after this routine.
 * GROUNDING: [seen].
 *
 * RETURN CONTRACT
 *   true  = no grab this frame (the caller continues its normal cell update).
 *   false = grab connected (the caller abandons the cell update for this frame).
 *
 * LIVE-OUT: none — the boolean return is the only result; no register value is read back after it.
 *   The one side effect on the grab path is in memory: GRAB_ACTIVE_FLAG (0x8d32) is raised and a
 *   sound command is enqueued.
 */
const LOW_MARGIN = 0x07; //  the catch window starts this far below the player coordinate
const WINDOW_SPAN = 0x0e; //  fixed width of the catch window, from its low edge to its high edge

export function testHangingRopeGrabConnect(m, ixl = m.regs.ix & 0xff) {
  const { mem8 } = m;

  // Pick this cell's catch reference from the ROM window table at GRAB_WINDOW_TABLE (0x3087),
  // indexed by the low two bits of the cell index (IXL & 3) — the four rope columns each carry
  // their own catch position. This is a straight byte-table lookup: table + index -> the byte there.
  const [halfWidth] = fetchByteFromTableIndex(m, GRAB_WINDOW_TABLE, ixl & 0x03);

  // Build a fixed-width catch window around the player's position. PLAYER_Y (0x8a84) is the tracked
  // player coordinate read here as the player's location across the rope columns; the window is a
  // 0x0e-wide band that begins 0x07 below it. loEdge is the near edge, hiEdge the far edge.
  const loEdge = (mem8[PLAYER_Y] - LOW_MARGIN) & 0xff;
  const hiEdge = (loEdge + WINDOW_SPAN) & 0xff;

  // The grab can only connect while the cell's catch reference falls inside that window. If the
  // reference sits beyond the far edge the player is too far past the object to grab it — no grab,
  // take the normal path.
  if (hiEdge < halfWidth) return true; // player beyond the far edge

  // If the reference sits at or below the near edge the player has not reached the object yet —
  // again no grab, normal path.
  if (loEdge >= halfWidth) return true; // player before the near edge

  // Position lines up, but the grab is suppressed while the wave machinery is mid-transition:
  // FORMATION_STATE (0x8f08) nonzero means an enemy formation is gathering/dispatching, and
  // WAVE_TEARDOWN_STATE (0x8f24) nonzero means the wave is being torn down or the boss walked off.
  // If either is busy, defer — no grab this frame, normal path.
  if ((mem8[FORMATION_STATE] | mem8[WAVE_TEARDOWN_STATE]) !== 0) return true;

  // The grab connects. Latch the grab subsystem busy: GRAB_ACTIVE_FLAG (0x8d32) reads 1 while a
  // grab is in progress, and the spawn/event routines gate on it to hold off while the catch plays.
  mem8[GRAB_ACTIVE_FLAG] = 0x01; // raise the grab-active latch

  // Enqueue the grab sound command so the audio side plays the catch effect.
  queueSoundCommand0D(m); // enqueue the grab command

  // Report the grab: the caller abandons the cell update for this frame.
  return false;
}
