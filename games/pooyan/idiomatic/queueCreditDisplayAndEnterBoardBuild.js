// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  CREDIT_COUNT,
  MAIN_GAME_STATE,
  DISPLAY_CMD_0618,
  DISPLAY_CMD_0619,
  DISPLAY_CMD_0300,
} from "./names.js";
/**
 * queueCreditDisplayAndEnterBoardBuild — the coin-jingle / credit-acknowledgement step.
 *
 * ROM address: 0x0d61.   Grounding: [seen].
 *
 * WHAT IT IS: a handler in the attract sub-state machine. While the machine sits in attract, a
 * sub-state selector picks one of a few small handlers each frame; this is the one that runs once a
 * coin has been accepted and a credit is on the books. Its whole job is to acknowledge that credit
 * — put the credit tally on screen (with its coin-drop jingle) — and then push the machine out of
 * attract and into the sequence that builds a board and starts a game.
 *
 * ITS ROLE IN THE MACHINE: the top-level game runs off the master state selector MAIN_GAME_STATE
 * (0x8805), where state 0/1 are attract, state 2 is the board-build / level-intro sequence, state 3
 * is live play, and state 4 is idle. This routine is the bridge from attract into a fresh game: it
 * queues the credit visuals and sound, then writes MAIN_GAME_STATE = 2 so the next frame's top-level
 * dispatch lands on the board-build sub-state machine instead of the attract one.
 *
 * The two visuals it queues are two-byte display/sound command words handed to the display-command
 * ring (a small circular buffer in RAM page 0x88 that a separate consumer drains each frame to fire
 * sounds and paint text). The first word is the credit-count acknowledgement, and it differs by
 * whether there is exactly one credit or more than one; the second is a fixed follow-up that
 * completes the coin jingle.
 *
 * On a zero credit count the routine does nothing and returns — there is no credit to acknowledge,
 * so the machine is left in attract untouched.
 *
 * LIVE-OUT: none — memory only (the display-command ring and MAIN_GAME_STATE).
 */
export function queueCreditDisplayAndEnterBoardBuild(m) {
  const { mem8 } = m;

  // Read the credit counter CREDIT_COUNT (0x8802): the BCD tally of credits currently banked (a
  // coin drop bumps it, a start press consumes it). If it is zero there is nothing to acknowledge,
  // so return inert and leave the machine in attract — nothing queued, no state change.
  const credits = mem8[CREDIT_COUNT];
  if (credits === 0) return;
  // Queue the credit-count acknowledgement command. The word depends on the amount banked: exactly
  // one credit uses DISPLAY_CMD_0618 (0x0618), while any larger count uses DISPLAY_CMD_0619
  // (0x0619). Handing it to the display-command ring lets the frame's ring-consumer draw the credit
  // count and sound the coin jingle.
  enqueueDisplayCommand(m, credits === 1 ? DISPLAY_CMD_0618 : DISPLAY_CMD_0619);
  // Queue the fixed follow-up command DISPLAY_CMD_0300 (0x0300) — the second half of the coin
  // jingle, always the same word regardless of credit count.
  enqueueDisplayCommand(m, DISPLAY_CMD_0300);
  // Drive the master state selector MAIN_GAME_STATE (0x8805) to 2, the board-build / level-intro
  // state. From the next frame the top-level dispatch stops running attract and hands control to the
  // board-build sub-state machine — the machine has left attract and is starting a game.
  mem8[MAIN_GAME_STATE] = 2;
}
