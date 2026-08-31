// SPDX-License-Identifier: GPL-3.0-only
import { clearBoardRamAndBlankFillRow } from "./clearBoardRamAndBlankFillRow.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { renderPlayTimerNibblesAndGuardChecksum } from "./renderPlayTimerNibblesAndGuardChecksum.js";
import {
  FIELD_ATTRIB_SRC_0819,
  DISPLAY_CMD_0600,
  DISPLAY_CMD_0603,
  PLAY_STATE_INDEX,
  PHASE_TIMER,
} from "./names.js";
/**
 * floodFieldAndLatchPlayStatePhaseTimer -- a screen-clear teardown handler that runs when a round
 * ends.
 *
 * WHAT IT IS
 *   One frame's worth of the round-teardown state. A round is driven by an in-play sub-state index
 *   held at PLAY_STATE_INDEX (0x880a): once per frame the play dispatcher masks that index to five
 *   bits and jumps through the word table at ROM 0x15a8 to the matching handler. This routine is the
 *   handler for index 9 -- the second of two sibling "screen clear" states (index 8 is
 *   rebuildFieldAndLatchPlayStateWithTamperCheck, which does the same wipe plus a code-integrity
 *   checksum). Both wipe the playfield away at the end of a round on the way to the high-score /
 *   player-switch phases.
 *
 * ROLE IN THE MACHINE
 *   The tilemap is not cleared in a single frame; a companion helper blanks exactly one tilemap row
 *   per frame and counts down a row counter. This handler therefore returns early on every frame
 *   while the clear is still draining, so the wipe animates over many frames. On the frame the last
 *   row is blanked it finishes the teardown: it repaints the colour/attribute layer, pushes the two
 *   display commands that redraw the now-empty frame, runs the shared integrity + play-timer render
 *   step, and then hands the round on to the next sub-state.
 *
 * ROM ADDRESS: 0x1b8c-0x1baa.
 * Grounding: [seen]
 *
 * LIVE-OUT
 *   On the completing frame: PLAY_STATE_INDEX (0x880a) = 0x0c and PHASE_TIMER (0x8808) = 0x60.
 *   Advancing the sub-state index to 0x0c (12) points the next-frame dispatch at the high-score
 *   entry handler, and seeding the phase timer to 0x60 gives that state its countdown to run against.
 *   On a draining (non-final) frame it leaves only the one blanked row and the decremented row
 *   counter written by the clear helper. No register/flag result is consumed -- the dispatcher
 *   discards whatever the handler returns.
 */

const NEXT_SUBSTATE = 0x0c; // play sub-state index latched on completion: index 12, the high-score-entry state
const PHASE_RELOAD = 0x60; //  phase timer reload value handed to the next state as its countdown

export function floodFieldAndLatchPlayStatePhaseTimer(m) {
  const { mem8 } = m;

  // Tick the row-by-row tilemap clear (ROM 0x02c9). Each frame this blanks one tilemap row at the
  // fill cursor and decrements the fill-row counter; it reports drained (true) only on the frame it
  // blanks the final row. While the wipe is still in progress it returns not-drained.
  const drained = clearBoardRamAndBlankFillRow(m); // Z live-out: the tilemap clear reached its last row
  if (!drained) return; // still draining -> bail this frame and let the wipe keep animating

  // --- The clear has finished; run the one-shot teardown below on this single frame. ---

  // Repaint the colour/attribute layer for the cleared frame from the ROM column-source table at
  // 0x0819 (fillAttributeColumns, ROM 0x075d), so the emptied playfield is drawn in the right colours.
  fillAttributeColumns(m, FIELD_ATTRIB_SRC_0819);

  // Queue the two display commands that the video layer consumes to redraw the frame. Each is a
  // two-byte word (0x06:0x00 then 0x06:0x03) appended to the page-0x88 display-command ring by
  // enqueueDisplayCommand (ROM 0x0038).
  enqueueDisplayCommand(m, DISPLAY_CMD_0600);
  enqueueDisplayCommand(m, DISPLAY_CMD_0603);

  // Run the shared integrity + play-timer step (ROM 0x7960): it enqueues a display command, verifies
  // a code-block checksum, renders the active player's play-timer BCD digits as nibble tiles (then
  // clears them), and scans a flag block that can divert to a tail checksum.
  renderPlayTimerNibblesAndGuardChecksum(m);

  // Latch the round forward. Writing PLAY_STATE_INDEX (0x880a) = 0x0c makes next frame's dispatch
  // select the high-score-entry handler (index 12)...
  mem8[PLAY_STATE_INDEX] = NEXT_SUBSTATE;
  // ...and seeding PHASE_TIMER (0x8808) = 0x60 gives that state its per-frame countdown reload. This
  // is the one point where the two sibling teardown states differ: this one reloads the phase timer,
  // whereas the tamper-check sibling clears it.
  mem8[PHASE_TIMER] = PHASE_RELOAD;
}
