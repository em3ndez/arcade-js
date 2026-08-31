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
 * floodFieldAndLatchPlayStatePhaseTimer — a play-state dispatch handler (a sibling play-state handler).
 *
 * Ticks one row of the tilemap clear and bails while the fill is still draining. Once drained it
 * floods the colour/attribute columns, enqueues two display commands, runs the shared integrity /
 * timer handler, then latches the play sub-state index to 0x0c and the phase timer to 0x60.
 *
 * LIVE-OUT: none — a jump-table handler whose caller discards register/flag results.
 */

const NEXT_SUBSTATE = 0x0c; // play sub-state index latched on completion
const PHASE_RELOAD = 0x60; //  phase timer reload

export function floodFieldAndLatchPlayStatePhaseTimer(m) {
  const { mem8 } = m;

  const drained = clearBoardRamAndBlankFillRow(m); // Z live-out: the tilemap clear reached its last row
  if (!drained) return; // still draining -> bail (the `ret nz` path)

  fillAttributeColumns(m, FIELD_ATTRIB_SRC_0819);
  enqueueDisplayCommand(m, DISPLAY_CMD_0600);
  enqueueDisplayCommand(m, DISPLAY_CMD_0603);
  renderPlayTimerNibblesAndGuardChecksum(m);
  mem8[PLAY_STATE_INDEX] = NEXT_SUBSTATE;
  mem8[PHASE_TIMER] = PHASE_RELOAD;
}
