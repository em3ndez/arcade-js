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
 * blankFillRowThenFinishAttractSetup -- top-level state-0 handler: blank one tilemap row, then
 * (once the whole screen is blanked and the boot self-test reads as passed) finish the attract setup.
 *
 * WHAT IT IS
 *   Pooyan's per-frame heartbeat branches on a single master selector, MAIN_GAME_STATE (0x8805),
 *   and runs exactly one handler each frame. This is the handler for state 0 -- the idle / attract
 *   entry that the machine sits in at power-on and between attract cycles. Its job has two halves:
 *
 *     1. Wipe the tilemap clean, one row per frame. A full-screen blank is too much work for a
 *        single frame, so the clear is spread out: each time state 0 runs it blanks one row of tiles
 *        and returns, leaving the master selector at 0 so the same handler runs again next frame and
 *        clears the next row. The screen wipes itself top-to-bottom over many frames.
 *
 *     2. Once the wipe drains, hand off to attract. But only if the machine is healthy: the boot
 *        self-test tally must show every program-memory bank verified intact. If it does, this
 *        finishes the attract setup -- points the machine at the attract sub-state machine, paints
 *        the field colours, and queues the screen redraw. If it does not, the handoff is abandoned
 *        and the machine keeps cycling the main loop instead of ever reaching play.
 *
 * ROLE IN THE MACHINE
 *   State 0 is the funnel every cold start and every finished attract cycle passes through before the
 *   attract demo (state 1) runs. It is where the screen is cleared and the attract screen's colour
 *   and tile layout are (re)established.
 *
 * ROM ADDRESS: 0x072d-0x075c.
 * GROUNDING: [seen] -- role confirmed by observation of the running machine.
 *
 * LIVE-OUT (memory this leaves behind on the finish path):
 *   - GAME_ACTIVE_FLAG (0x8806) = 0    -- not in live play; gameplay handlers stay gated off.
 *   - MAIN_GAME_STATE  (0x8805) = 1    -- next frame runs the attract-mode sub-state machine.
 *   - PLAY_STATE_INDEX (0x880a) = 0    -- play sub-state rewound to its first phase.
 *   - the tile colour/attribute map flooded from the attract colour source.
 *   - three two-byte display commands queued in the display-command ring for the main loop to draw.
 *   - ATTRACT_SUBSTATE (0x8e51) = 0    -- attract sub-state machine rewound to its first demo phase.
 *   (Nothing is returned to the caller; this handler communicates entirely through those cells.)
 */

// One tilemap row is 0x20 (32) tiles wide, so 0x20 cells are blanked per pass -- exactly one row.
const ROW_FILL_COUNT = 0x20; // cells blanked per row
// The self-test tally reaches this value (twice the program-bank count) only when every program-memory
// bank verified intact at boot; any other value means the ROM image is not trustworthy for play.
const SELFTEST_PASSED = 0x10; // tally value that lets the setup finish

export function blankFillRowThenFinishAttractSetup(m) {
  // The machine's byte-addressable memory: work RAM at 0x8800+, video/tile RAM at 0x8000+, ROM below.
  const { mem8 } = m;

  // STEP 1 -- blank one row of the screen wipe.
  // blankFillRowAndStepCounter blanks ROW_FILL_COUNT tiles at the fill cursor TILE_FILL_PTR (0x880b),
  // advances that cursor one row forward (+0x20), and decrements the fill row counter FILL_ROW_COUNTER
  // (0x8809). It reports whether the counter has drained: false while rows remain. When rows remain we
  // return with MAIN_GAME_STATE still 0, so this same handler runs next frame and wipes the next row.
  if (!blankFillRowAndStepCounter(m, ROW_FILL_COUNT)) return; // rows remain: wait for the next call

  // STEP 2 -- integrity gate. The screen is fully blanked at this point. Before finishing setup, require a
  // clean boot self-test: ROM_SELFTEST_TALLY (0x8fff) is seeded to the program-bank count and bumped
  // once per intact bank, so it reads SELFTEST_PASSED only for a wholly-good image. (This cell is
  // parked at the very top of the page, above the stack, so the per-frame register-save cannot clobber
  // it.) A bad image never advances to play -- we bail and let the machine keep running the main loop.
  if (mem8[ROM_SELFTEST_TALLY] !== SELFTEST_PASSED) return; // not passed: resume the main loop

  // STEP 3 -- leave live play. Clear the in-play gate GAME_ACTIVE_FLAG (0x8806): the machine is
  // entering attract, not a game, so every gameplay handler that early-returns when this is 0 stays off.
  mem8[GAME_ACTIVE_FLAG] = 0x00;
  // STEP 4 -- advance the master state selector MAIN_GAME_STATE (0x8805) from 0 (this state) to 1, the
  // attract-mode sub-state machine that runs the demo. This is the actual attract handoff.
  mem8[MAIN_GAME_STATE] = 0x01;
  // STEP 5 -- rewind the play sub-state index PLAY_STATE_INDEX (0x880a) to 0, so that when play is
  // eventually entered its sub-state machine starts from its first phase rather than a stale index.
  mem8[PLAY_STATE_INDEX] = 0x00;

  // STEP 6 -- paint the attract field colours. fillAttributeColumns floods the tile colour/attribute
  // map (the ATTRIB_MAP_BASE region on the 0x8000 video page) from the ROM colour-column source table
  // ATTRACT_FIELD_ATTRIB_SRC (0x0779), laying down the attract screen's colour layout across the field.
  fillAttributeColumns(m, ATTRACT_FIELD_ATTRIB_SRC);

  // STEP 7 -- queue the screen redraw. Each enqueueDisplayCommand pushes one two-byte display command
  // into the display-command ring (0x88c0), the queue the main loop drains to redraw tiles. These three
  // commands (0x0604, 0x0500, 0x0502) build the attract screen's tile layout on the next drain.
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_A);
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_B);
  enqueueDisplayCommand(m, ATTRACT_SETUP_DISPLAY_CMD_C);

  // STEP 8 -- rewind the attract sub-state selector ATTRACT_SUBSTATE (0x8e51) to 0, so the attract
  // sub-state machine selected by MAIN_GAME_STATE=1 begins from its first demo phase.
  mem8[ATTRACT_SUBSTATE] = 0x00;
}
