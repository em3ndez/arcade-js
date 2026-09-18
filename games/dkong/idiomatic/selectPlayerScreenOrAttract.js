// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayerScreenOrAttract — the game-over sub-state handler. Each frame it redraws the
 * "CREDIT nn" line and counts the hold timer down; on expiry it blanks the screen, clears the
 * two-byte player index, and scans the five player-context records for the first still-in-play
 * one: a record == 1 composes player 1's screen (flip key 1), else == 3 selects player 2, else
 * it returns to attract.
 *
 * LIVE-OUT: memory, plus the flip-screen latch the composing outcomes drive.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX, PLAYER_SLOT_RECORDS } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { configureFlipScreenAndComposeScreen } from "./configureFlipScreenAndComposeScreen.js";
import { selectPlayer2AndComposeScreen } from "./selectPlayer2AndComposeScreen.js";
import { enterAttractMode } from "./enterAttractMode.js";

const RECORD_STRIDE = 0x22;
const RECORD_COUNT = 5;

/** True if any of the five records holds `value`. */
function anyRecordEquals(mem8, value) {
  let addr = PLAYER_SLOT_RECORDS;
  for (let i = 0; i < RECORD_COUNT; i++, addr = (addr + RECORD_STRIDE) & 0xffff) {
    if (mem8[addr] === value) return true;
  }
  return false;
}

export function selectPlayerScreenOrAttract(m) {
  const { mem8 } = m;

  drawCreditDisplay(m);

  if (!tickSubstateTimer(m)) return;

  clearPlayfieldAndSprites(m);

  // Clear the two-byte player index; each active-player arm rewrites it.
  mem8[ACTIVE_PLAYER_INDEX] = 0x00;
  mem8[CURRENT_PLAYER] = 0x00;

  // Player 1 still up (a record == 1) -> compose player 1's screen with flip key 1.
  if (anyRecordEquals(mem8, 0x01)) {
    configureFlipScreenAndComposeScreen(m, 0x01);
    return;
  }

  // Player 2 still up (a record == 3) -> select player 2.
  if (anyRecordEquals(mem8, 0x03)) {
    selectPlayer2AndComposeScreen(m);
    return;
  }

  enterAttractMode(m);
}
