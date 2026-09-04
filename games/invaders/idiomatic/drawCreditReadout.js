// SPDX-License-Identifier: GPL-3.0-only
import { clearGameActive } from "./clearGameActive.js";
import { drawCreditCount } from "./drawCreditCount.js";
import { drawCreditLabel } from "./drawCreditLabel.js";

/**
 * drawCreditReadout — refresh the bottom-of-screen credit readout for boot/attract.
 *
 * WHAT IT IS
 *   Repaints the "CREDIT nn" line at the foot of the screen and drops the game-active flag. The credit
 *   readout is two pieces of fixed furniture: the running BCD credit tally and the static "CREDIT"
 *   label beside it. This routine drives both, after first clearing GAME_ACTIVE so the machine is left
 *   in a not-in-a-game state — it fires at boot and on the attract/no-game path.
 *
 * ROLE IN THE MACHINE
 *   A small composite:
 *     1. clearGameActive (0x19d7) stores 0 -> GAME_ACTIVE (0x20e9), the master "a game is live" gate.
 *     2. drawCreditCount (0x1947) draws the BCD tally CREDIT_COUNT (0x20eb) as two decimal glyphs at
 *        CREDIT_COUNT_SCREEN_ADDR (0x3c01).
 *     3. drawCreditLabel (0x193c) draws the seven-glyph "CREDIT" label to CREDIT_LABEL_SCREEN_ADDR,
 *        as the tail call (its result is returned).
 *   It shares the same static credit-line frame as redrawScorePanel — both paint this CREDIT label and
 *   BCD tally — but the two run them in reversed tail order: redrawScorePanel finishes on drawCreditCount,
 *   this routine on drawCreditLabel.
 *
 * ROM 0x1979.  Grounding: [seen].
 *
 * LIVE-OUT: whatever drawCreditLabel returns (RAM-only effects; video RAM is repainted).
 */
export function drawCreditReadout(m) {
  // Drop the master game-active gate (GAME_ACTIVE 0x20e9 := 0): this readout is a no-game screen.
  clearGameActive(m);
  // Repaint the numeric credit tally (BCD CREDIT_COUNT) as two digits at its fixed screen address.
  drawCreditCount(m);
  // Tail: draw the static "CREDIT" label; its return value is this routine's result.
  return drawCreditLabel(m);
}
