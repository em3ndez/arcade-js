// SPDX-License-Identifier: GPL-3.0-only
import { blankFillRowAndStepCounter } from "./blankFillRowAndStepCounter.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  GAME_ACTIVE_FLAG,
  MAIN_GAME_STATE,
  PLAY_STATE_INDEX,
  ATTRACT_SUBSTATE,
  ROM_SELFTEST_TALLY,
  ATTRACT_FIELD_ATTRIB_SRC,
  ATTRACT_SETUP_DISPLAY_CMD_A,
  ATTRACT_SETUP_DISPLAY_CMD_B,
  ATTRACT_SETUP_DISPLAY_CMD_C,
} from "./names.js";
/**
 * blankFillRowThenFinishAttractSetup — attract state-0 handler: blank one tilemap row, then finish the board setup.
 *
 * Blanks one row of the row-by-row tilemap fill. While rows remain it returns and waits to be
 * called again. Once the fill drains, a boot self-test tally decides the rest: unless it reads
 * as passed the routine abandons setup and resumes the main loop; when it does, the routine
 * finishes the attract-to-play handoff — clears the in-play flag, advances the top-level state,
 * resets the play sub-state, floods the colour/attribute map from a fixed source, enqueues
 * three display commands, and clears the attract sub-state.
 *
 * LIVE-OUT: none — it runs inside the frame interrupt, whose register file is saved and restored
 * around it, so only its memory writes survive.
 */

const ROW_FILL_COUNT = 0x20; // cells blanked per row
const SELFTEST_PASSED = 0x10; // tally value that lets the setup finish

export function blankFillRowThenFinishAttractSetup(m) {
  const { mem8 } = m;
  if (!blankFillRowAndStepCounter(m, ROW_FILL_COUNT)) return; // rows remain: wait for the next call
  if (mem8[ROM_SELFTEST_TALLY] !== SELFTEST_PASSED) return; // not passed: resume the main loop

  mem8[GAME_ACTIVE_FLAG] = 0x00;
  mem8[MAIN_GAME_STATE] = 0x01;
  mem8[PLAY_STATE_INDEX] = 0x00;
  fillAttributeColumns(m, ATTRACT_FIELD_ATTRIB_SRC);
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_A);
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_B);
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_C);
  mem8[ATTRACT_SUBSTATE] = 0x00;
}
