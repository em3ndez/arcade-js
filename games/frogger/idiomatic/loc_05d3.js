// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05d3  —  ROM 0x05d3  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The board-completion re-arm handler. In Frogger a board is finished when all five home bays across
 *   the top row are filled. The moment the active player's home tally reaches five, the machine calls
 *   this routine once to flip the game out of ordinary play and into the "all frogs home" end-of-board
 *   sequence: it requests the next-board advance, freezes the live frog, asks for a fresh board layout,
 *   and seeds the two timers that pace the left-to-right home-reveal animation.
 *
 * WHERE IT SITS
 *   Reached from the per-frame in-play service cascade (under serviceVblankNmi, ROM 0x0066). That cascade
 *   watches the per-player filled-bay count PLAYER1_SLOT (0x825c) / PLAYER2_SLOT (0x825d); when the active
 *   player's count hits 5 it first zeros that player's five home-bay occupancy gates and their slot count,
 *   then calls loc_05d3 to arm the reveal. It fires exactly once per completed board, for whichever player
 *   just filled their fifth bay. Everything it writes is consumed on later frames by other routines — this
 *   handler itself does no animation, it only sets the stage.
 *
 * LIVE-OUT
 *   Memory only. Seven cells written, no register the caller reads, no return value.
 */
import { BOARD_ADVANCE_REQUEST, PLAYER_START_DEMO_FLAG, FROG_STATE_DEMO_FLAG, TWO_PLAYER_START_FLAG, BOARD_LAYOUT_GATE, HOME_REVEAL_COUNTDOWN, HOME_REVEAL_DELAY_TIMER } from "./names.js";

export function loc_05d3(m) {
  const { mem8 } = m;

  // ── Request the board advance ────────────────────────────────────────────────────────
  // BOARD_ADVANCE_REQUEST (0x826d) is the "board-complete pending / advance next board" flag. Raising it
  // here is the signal picked up later by the board-start dispatcher setUpBoardOrContinueLife (ROM 0x0425),
  // which sees the pending request, runs the board-advance foreground, and clears the flag again (0x0448).
  // (Note: the imported const name PLAYER-/TWO_PLAYER- naming below is legacy — MAME grounding overturned
  // the old "2-player-mode flag" reading of 0x826d; it is purely the board-advance request.)
  mem8[BOARD_ADVANCE_REQUEST] = 1;

  // ── Freeze the frog for the reveal ───────────────────────────────────────────────────
  // Two demo/start flags go up so the frog stops behaving as a live playable object while the reveal plays:
  //   • PLAYER_START_DEMO_FLAG   (0x825a) — the per-player start/demo flag.
  //   • FROG_STATE_DEMO_FLAG     (0x83cd) — the frog-state demo gate. Numerous per-frame routines return
  //     early while this is set (the frog-vs-lane resolver dispatchFrogMoveAgainstLanes 0x11bf, the timer
  //     tick in renderFrogSceneAndTickTimer 0x0942, the score-display driver driveScoreDisplayCountdown
  //     0x0870), so raising it effectively suspends input, movement, collision and the countdown timer
  //     while the completed board animates. resetFrogObject (0x09aa) clears it when the next board resets.
  mem8[PLAYER_START_DEMO_FLAG] = 1;
  mem8[FROG_STATE_DEMO_FLAG] = 1;

  // ── Drop the 2-player start flag ─────────────────────────────────────────────────────
  // TWO_PLAYER_START_FLAG (0x825b) is cleared so it does not leak into the between-board handoff; it is
  // re-raised on the next start path (raiseTwoPlayerStartFlag 0x07ce, guarded by BOARD_ADVANCE_REQUEST).
  mem8[TWO_PLAYER_START_FLAG] = 0;

  // ── Ask for a fresh board layout ─────────────────────────────────────────────────────
  // BOARD_LAYOUT_GATE (0x83ea) latches whether the current board has already been drawn. Clearing it to 0
  // requests a from-scratch layout: setUpBoardOrContinueLife reads this gate each frame (0x040b) and, when
  // it is 0, routes to the fresh-board setup path (it re-sets the gate to 1 at 0x042f once the board is
  // laid). So clearing it now is what makes the *next* board be built cleanly after the reveal finishes.
  mem8[BOARD_LAYOUT_GATE] = 0;

  // ── Seed the home-reveal animation timers ────────────────────────────────────────────
  // The "all frogs home" reveal is paced by two counters, drained on later frames by the service cascade:
  //   • HOME_REVEAL_DELAY_TIMER (0x8298) = 64 (0x40) — a lead-in delay. While it is nonzero the service
  //     routine just decrements it and does nothing to the bays, holding the completed board on screen for
  //     a beat before the sweep begins.
  //   • HOME_REVEAL_COUNTDOWN  (0x8297) = 255 — the reveal countdown, which doubles as a home-column
  //     selector. Once the delay has drained this decrements one per frame, and each frame its current
  //     value is handed to stampHomeBayFrogByColumn (0x06a2). As the value sweeps down from 255 it crosses
  //     each bay's threshold (192→bay1, 144→bay2, 112→bay3, 80→bay4, 48→bay5), dropping a frog-in-home
  //     graphic into each bay left-to-right; passing 16 delegates to fillAllHomeSlotsAndAwardLife, which
  //     resets the bays and awards the extra life. Seeding 255 here is what starts that whole sequence.
  mem8[HOME_REVEAL_COUNTDOWN] = 255;
  mem8[HOME_REVEAL_DELAY_TIMER] = 64;
}
