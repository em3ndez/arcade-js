// SPDX-License-Identifier: GPL-3.0-only
import { tickActivePlayerPlayTimer } from "./tickActivePlayerPlayTimer.js";
import { resetToBoardBuildToContinuePlay } from "./resetToBoardBuildToContinuePlay.js";
import { dispatchInPlaySubState } from "./dispatchInPlaySubState.js";
/**
 * runPlayStateFrame -- one frame of live gameplay (top-level game state 3).
 *
 * WHAT IT IS
 *   The per-frame handler for the machine's "play" state. The vblank interrupt runs a fixed
 *   script every frame and, near its end, dispatches on the master state selector
 *   MAIN_GAME_STATE (0x8805): 0 = attract/boot, 1 = attract sub-state machine, 2 = board build,
 *   3 = live play, 4 = idle. When that selector holds 3 -- i.e. a game is running -- the frame is
 *   handed here.
 *
 * ROLE IN THE MACHINE
 *   This is a thin shell around a SECOND, finer state machine. Where MAIN_GAME_STATE picks the
 *   coarse mode, an in-play sub-state index PLAY_STATE_INDEX (0x880a) walks a single round from
 *   its first setup frame, through active play, and out through teardown and the player-switch
 *   decision. Each frame this shell does exactly three things, in order:
 *     1. tick the active player's wall-clock play timer,
 *     2. dispatch the current in-play sub-state (which advances the round),
 *     3. run the end-of-life housekeeping step that hands a finished game back to board build.
 *   So the whole per-frame flow reads: vblank interrupt -> dispatch MAIN_GAME_STATE -> (state 3)
 *   here -> dispatch PLAY_STATE_INDEX -> the selected handler updates the world -> control unwinds
 *   back into the interrupt service, which re-arms itself for the next frame.
 *
 * ROM 0x159b.
 * Grounding: [seen].
 * LIVE-OUT: none -- a per-frame state handler; it leaves no value for its caller. It drives the
 *   world through the sub-state handlers and the shared work-RAM cells they touch, then returns
 *   into the interrupt-service epilogue that dispatched it.
 */

export function runPlayStateFrame(m) {
  // STEP 1 -- tick the active player's wall-clock play timer.
  // Each player keeps a BCD play timer (a frame sub-counter, then BCD seconds and BCD minutes).
  // This advances the ACTIVE_PLAYER's (0x880d) timer once per play frame: it bails immediately if
  // GAME_ACTIVE_FLAG (0x8806) is clear, honours that player's gate byte (a nonzero gate freezes one
  // player's clock while the other plays), rolls the frame sub-counter at 0x3b/0x3c frames (the
  // extra frame chosen by bit 0 of the seconds byte, so the roll averages ~1 second at the ~60 Hz
  // frame rate), and BCD-carries seconds into minutes. These accrued play-times ride alongside the
  // high-score table and are stored with a new entry when one is inserted.
  tickActivePlayerPlayTimer(m); // tick the BCD play-timer
  // STEP 2 -- dispatch the current in-play sub-state.
  // Reads PLAY_STATE_INDEX (0x880a), masks it to five bits ((0x880a)&0x1f), and uses that as an
  // index into the ROM word-address jump table at 0x15a8. That table holds nineteen live handlers
  // (indices 0..0x12): round init, display-list select, the intro hold, wave spawn, the active
  // gameplay frame, the phase-gauge drain, the per-player bank snapshots, high-score entry, the
  // round-end teardown, and the deep round-2/bonus-stage paths. Before dispatching, the ROM seats
  // this shell's OWN post-dispatch continuation address (0x15d1) in HL, so the selected handler
  // advances its slice of the round and then returns HERE -- the dispatch is not a never-return
  // tail. Handlers step the round forward by writing the NEXT index into PLAY_STATE_INDEX before
  // they return, so the sequence of indices is the shape of a round.
  dispatchInPlaySubState(m); // in-play sub-state dispatch (tail dispatch; the handler returns here)
  // STEP 3 -- end-of-life housekeeping (the dispatch continuation, ROM 0x15d1).
  // Runs after the sub-state handler on every play frame. While GAME_ACTIVE_FLAG (0x8806) is still
  // set it does nothing and returns straight back. Once the game has gone inactive it decides what
  // comes next: on free play (COINAGE_CONFIG (0x882c) == 0x0f) it tails into the shared attract
  // epilogue; with no credit banked it simply returns, leaving the machine parked; with a credit
  // banked it drops MAIN_GAME_STATE (0x8805) back to 2 (board build) with PLAY_STATE_INDEX cleared,
  // runs the board/HUD reset and the arena clear, and blanks an eight-tile attribute column --
  // staging the next game's board build. This is the hand-off from a finished game to the board-
  // build subsystem; its own return unwinds into the interrupt-service epilogue.
  return resetToBoardBuildToContinuePlay(m); // post-dispatch continuation -> NMI epilogue
}
