// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceGameStateOnCredit (ROM 0x03d7) -- leave the attract/demo loop for the press-start screen
 * once a coin has been banked.
 *
 * WHAT IT IS
 *   This is the RST continuation that runAttractSequenceAndAdvanceOnCredit pushes as its
 *   post-dispatch return, so it runs at the end of every attract (game-state 1) frame. Its job is a
 *   single gated transition: if there is a credit on the machine, step the top-level game state
 *   forward (out of attract, into the "press start" screen) and wipe the attract sub-state cluster
 *   so the next frame comes up clean; with no credit it does nothing.
 *
 * ROLE IN THE MACHINE
 *   Tail-run from the attract handler (mechanisms.md, "The attract / sequence state machine ...
 *   credit transition"). loc_4002 (0x4002) is the credit count (corroborated by clampCreditsToMax /
 *   driveStartButtonLamps / incrementCreditCount). The reset cluster it clears is exactly the attract
 *   sub-state: loc_4007 (a state flag), SEQUENCE_STATE (0x400a, the sequence step index), loc_41c2
 *   (the sweep-voice countdown), loc_41df (the sound-sweep request selector), and
 *   MESSAGE_SCROLL_ENABLE (0x40b0, the scrolling-text enable).
 *
 * Grounding: [seen] (names.js cert for 0x03d7).
 *
 * LIVE-OUT (credit present): GAME_STATE incremented; loc_4007, SEQUENCE_STATE, loc_41c2, loc_41df,
 *   MESSAGE_SCROLL_ENABLE all zeroed. No credit: no writes at all.
 */
import {
  loc_4002,
  GAME_STATE,
  loc_4007,
  SEQUENCE_STATE,
  loc_41c2,
  loc_41df,
  MESSAGE_SCROLL_ENABLE,
} from "./names.js";

export function advanceGameStateOnCredit(m) {
  const { mem8 } = m;

  // Gate: no credit banked (loc_4002 == 0) -> stay in attract, nothing to do.
  if (mem8[loc_4002] === 0) return;

  // A credit is present: advance the top-level game state one step (attract -> press-start screen).
  mem8[GAME_STATE] = mem8[GAME_STATE] + 1; // byte store wraps 255 -> 0
  // Now clear the attract sub-state cluster so the press-start screen starts from a clean slate.
  // A per-sequence state flag.
  mem8[loc_4007] = 0;
  // Rewind the sequence state-machine step index.
  mem8[SEQUENCE_STATE] = 0;
  // Reset the sweep-voice countdown.
  mem8[loc_41c2] = 0;
  // Clear the pending sound-sweep request selector.
  mem8[loc_41df] = 0;
  // Stop any scrolling attract text.
  mem8[MESSAGE_SCROLL_ENABLE] = 0;
}
