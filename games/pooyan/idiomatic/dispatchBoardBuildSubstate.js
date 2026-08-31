// SPDX-License-Identifier: GPL-3.0-only
import { PLAY_STATE_INDEX } from "./names.js";
import { primeTileFillCursorAndAdvanceBoardBuild } from "./primeTileFillCursorAndAdvanceBoardBuild.js";
import { fillIntroRowsThenBuildBoardIntro } from "./fillIntroRowsThenBuildBoardIntro.js";
import { queueCreditDisplayAndEnterBoardBuild } from "./queueCreditDisplayAndEnterBoardBuild.js";
import { startSelectedPlayerGameConsumingCredits } from "./startSelectedPlayerGameConsumingCredits.js";

/**
 * dispatchBoardBuildSubstate — the board-build sub-state machine.
 *
 * WHAT IT IS
 *   The middle tier of the game's three-level state dispatch. It runs once per frame from the vblank
 *   service epilogue while the top-level selector MAIN_GAME_STATE (0x8805) sits in state 2 — the
 *   "board build" / level-intro phase that paints a fresh playfield and its intro banner before live
 *   play begins. Where the top level decides *which phase of the whole game* is running, this routine
 *   decides *which step of building the board* is running.
 *
 * ROLE IN THE MACHINE
 *   Building a board is not instantaneous. The hardware tile map is filled a few rows at a time,
 *   spread across many frames, so the fill never outruns what the display can show. Board-build is
 *   therefore split into three sub-states that each do one frame's worth of work and then advance the
 *   selector so the next step runs on the next frame (sub-state 0 -> 1 -> 2). Each frame this routine
 *   reads the current sub-state, runs exactly that step, and then falls through to the shared
 *   coin/credit tail that every board-build frame ends on.
 *
 * ROM ADDRESS: 0x0c4e (reached from the vblank service epilogue).
 * Grounding: [seen]
 * LIVE-OUT: memory only. The sub-state handlers mutate the board-build work cells — the tile-fill
 *   cursor TILE_FILL_PTR (0x880b), the row down-counter FILL_ROW_COUNTER (0x8809), the sub-state
 *   selector PLAY_STATE_INDEX (0x880a), and the display list — and the tail handler services coins
 *   and credits. Nothing meaningful is handed back to the caller in a register.
 */
export function dispatchBoardBuildSubstate(m) {
  // Pick the board-build step for this frame from the sub-state selector PLAY_STATE_INDEX (0x880a).
  // The three sub-states form a self-advancing chain: each one bumps the selector as it finishes, so
  // successive frames walk 0 -> 1 -> 2. Any value outside 0..2 runs no step here (the tail below
  // still runs).
  switch (m.mem8[PLAY_STATE_INDEX]) {
    // Sub-state 0: seat the tile-fill write cursor TILE_FILL_PTR (0x880b) at the top of the
    // playfield, seed the row down-counter FILL_ROW_COUNTER (0x8809), and step PLAY_STATE_INDEX
    // (0x880a) to 1 so the fill begins on the next frame.
    case 0: primeTileFillCursorAndAdvanceBoardBuild(m); break;
    // Sub-state 1: paint two tile-fill runs into the tile map this frame and decrement the row
    // counter FILL_ROW_COUNTER (0x8809). While the counter is still nonzero the board keeps filling
    // on later frames; once it reaches zero the fill is complete, so this step builds the level-intro
    // display and steps PLAY_STATE_INDEX (0x880a) to 2.
    case 1: fillIntroRowsThenBuildBoardIntro(m); break;
    // Sub-state 2: the coin-jingle / credit-display step. On a nonzero credit count it queues a
    // credit-display command (a distinct one for exactly one credit vs. more) followed by a fixed
    // command, and sets the top-level state MAIN_GAME_STATE (0x8805) to 2; it is inert when no credit
    // is banked.
    case 2: queueCreditDisplayAndEnterBoardBuild(m); break;
  }
  // Shared post-dispatch tail that every board-build frame ends on: the coin/credit post-handler
  // reads the debounced IN0 edge bits at INPUT_PORT0 (0x8810) and, on a start press with a credit
  // banked, spends the credit and begins the selected player's game. Running it last means a coin or
  // start button pressed during the board build is serviced on the very frame the board is drawn.
  return startSelectedPlayerGameConsumingCredits(m);
}
