// SPDX-License-Identifier: GPL-3.0-only
import { loc_02c9 } from "./loc_02c9.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_7960 } from "./loc_7960.js";
import {
  FIELD_ATTRIB_SRC_0819,
  DISPLAY_CMD_0600,
  DISPLAY_CMD_0603,
  PLAY_STATE_INDEX,
  PHASE_TIMER,
} from "./names.js";
/**
 * loc_1b8c — a play-state dispatch handler (a sibling play-state handler).
 *
 * Ticks one row of the tilemap clear and bails while the fill is still draining. Once drained it
 * floods the colour/attribute columns, enqueues two display commands, runs the shared integrity /
 * timer handler, then latches the play sub-state index to 0x0c and the phase timer to 0x60.
 *
 * LIVE-OUT: none — a jump-table handler whose caller discards register/flag results.
 */

const NEXT_SUBSTATE = 0x0c; // play sub-state index latched on completion
const PHASE_RELOAD = 0x60; //  phase timer reload

export function loc_1b8c(m) {
  const { mem8 } = m;

  const drained = loc_02c9(m); // Z live-out: the tilemap clear reached its last row
  if (!drained) return; // still draining -> bail (the `ret nz` path)

  fillAttributeColumns(m, FIELD_ATTRIB_SRC_0819);
  loc_0038(m, DISPLAY_CMD_0600);
  loc_0038(m, DISPLAY_CMD_0603);
  loc_7960(m);
  mem8[PLAY_STATE_INDEX] = NEXT_SUBSTATE;
  mem8[PHASE_TIMER] = PHASE_RELOAD;
}
